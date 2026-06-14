-- =============================================================================
-- Migration 007 : Référentiel Client Patrimonial — Sessions de collecte
-- Dépend de   : 001_initial_schema.sql (clients, famille, fiscalite,
--               kyc_tokens, objectifs, dossiers, auth.users)
-- Idempotente : ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
--               DROP POLICY IF EXISTS, DROP TRIGGER IF EXISTS
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 7a. ENRICHISSEMENT DES TABLES EXISTANTES DU RÉFÉRENTIEL
-- Colonnes nullable sans DEFAULT obligatoire → aucun impact sur les lignes
-- existantes ni sur le code applicatif actuel.
-- ─────────────────────────────────────────────────────────────────────────────

-- famille : pays de naissance (lieu_naissance existant = ville uniquement)
-- et complément des données conjoint manquantes dans le schéma initial

ALTER TABLE famille
  ADD COLUMN IF NOT EXISTS pays_naissance                     TEXT,
  -- Pays de naissance du client. Distinct de lieu_naissance (ville).

  ADD COLUMN IF NOT EXISTS conjoint_pays_naissance            TEXT,
  -- Idem pour le conjoint/partenaire.

  ADD COLUMN IF NOT EXISTS conjoint_categorie_professionnelle TEXT;
  -- Catégorie professionnelle du conjoint (salarié, TNS, fonctionnaire, retraité…).
  -- Absente des colonnes conjoint_* initiales.
  -- Nécessaire pour estimer les droits retraite du foyer et la capacité d'épargne.


-- fiscalite : données manquantes pour reconstituer le barème IR du foyer

ALTER TABLE fiscalite
  ADD COLUMN IF NOT EXISTS nombre_parts   NUMERIC(4,1)
    CHECK (nombre_parts > 0),
  -- Nombre de parts fiscales du foyer (quotient familial IR).
  -- Indispensable pour calculer l'impôt théorique à partir de revenu_fiscal.
  -- Exemple : couple sans enfant = 2 parts, + 0,5 par enfant à charge.

  ADD COLUMN IF NOT EXISTS option_bareme  BOOLEAN;
  -- NULL  = information non collectée (état initial).
  -- TRUE  = option barème progressif exercée (art. 200 A CGI).
  -- FALSE = PFU 30 % retenu ou absence d'option explicite.
  -- Nullable intentionnel : distingue l'inconnu du choix délibéré.


-- ─────────────────────────────────────────────────────────────────────────────
-- 7b. TABLE PRINCIPALE : collecte_sessions
-- Une session = une instance de collecte d'informations patrimoniales.
-- Clé de voûte du module : toutes les autres tables du référentiel
-- patrimonial (questionnaire_reponses, session_ecarts, patrimoine_snapshots)
-- y sont rattachées.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collecte_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Lien vers le token d'accès envoyé au client pour le portail web.
  -- Nullable : une session menée en entretien direct n'a pas de token.
  kyc_token_id  UUID REFERENCES kyc_tokens(id) ON DELETE SET NULL,

  -- Rattachement optionnel à un dossier de suivi existant.
  dossier_id    UUID REFERENCES dossiers(id) ON DELETE SET NULL,

  -- questionnaire_version_id sera ajouté en migration 008
  -- une fois la table questionnaire_versions créée.


  -- ── Caractérisation de la collecte ───────────────────────────────────────

  type    TEXT NOT NULL DEFAULT 'bilan_initial'
          CHECK (type IN (
            'bilan_initial',        -- Premier bilan patrimonial complet
            'mise_a_jour',          -- Mise à jour périodique ou événementielle
            'pre_conseil',          -- Collecte avant émission d'une recommandation
            'verification_annuelle' -- Revue réglementaire annuelle
          )),

  canal   TEXT NOT NULL DEFAULT 'entretien'
          CHECK (canal IN (
            'portail_client', -- Client remplit en autonomie via lien sécurisé
            'entretien',      -- Conseiller saisit en direct lors d'un entretien
            'import_manuel'   -- Import depuis un dossier papier ou un ancien système
          )),

  perimetre TEXT NOT NULL DEFAULT 'foyer'
            CHECK (perimetre IN (
              'client_seul', -- Collecte limitée au client signataire
              'foyer'        -- Collecte incluant le conjoint / partenaire
            )),


  -- ── Cycle de vie ─────────────────────────────────────────────────────────
  --
  -- Transitions autorisées (enforced côté application) :
  --   brouillon → en_cours → soumis → en_revue → valide → archive
  --                                  └─────────────────┘
  --                                  (si 0 écart détecté, soumis → valide direct)

  statut  TEXT NOT NULL DEFAULT 'brouillon'
          CHECK (statut IN (
            'brouillon',    -- Session préparée, non encore active
            'en_cours',     -- Lien envoyé ou saisie conseiller en cours
            'soumis',       -- Client a confirmé — lecture seule côté client
            'en_revue',     -- Écarts détectés, le conseiller doit statuer
            'valide',       -- Tous les écarts traités, snapshot généré
            'archive'       -- Historisée définitivement, lecture seule
          )),


  -- ── Préremplissage et détection des écarts ───────────────────────────────

  snapshot_prefill    JSONB,
  -- Photographie de l'état référentiel au moment de la transition
  -- brouillon → en_cours. Sert simultanément à :
  --   1. Préremplir le questionnaire affiché au client.
  --   2. Constituer le baseline de comparaison pour la détection des écarts
  --      (stabilité garantie même si le référentiel évolue entre l'envoi et la
  --      soumission du client).
  -- NULL tant que la session est en statut brouillon.

  nb_ecarts_detectes  INTEGER NOT NULL DEFAULT 0
                      CHECK (nb_ecarts_detectes >= 0),
  -- Calculé à la soumission client par comparaison questionnaire_reponses
  -- vs snapshot_prefill. Vaut 0 si le client a tout confirmé sans modification.

  nb_ecarts_traites   INTEGER NOT NULL DEFAULT 0
                      CHECK (nb_ecarts_traites >= 0),
  -- Incrémenté à chaque écart statué (accepté ou rejeté) par le conseiller.
  -- Le bouton "Valider la session" n'est disponible que lorsque
  -- nb_ecarts_traites = nb_ecarts_detectes.


  -- ── Traçabilité des intervenants ─────────────────────────────────────────

  initie_par        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Conseiller ayant créé la session.

  valide_par        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Conseiller ayant validé la session (peut différer de initie_par).

  notes_conseiller  TEXT,
  -- Observations libres post-entretien, non visibles par le client.


  -- ── Horodatages des transitions clés ─────────────────────────────────────

  date_ouverture    TIMESTAMPTZ,
  -- Rempli à la transition brouillon → en_cours.

  date_soumission   TIMESTAMPTZ,
  -- Rempli à la transition en_cours → soumis.

  date_validation   TIMESTAMPTZ,
  -- Rempli à la transition en_revue/soumis → valide.

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7c. LIAISONS RETOUR SUR TABLES EXISTANTES
-- FK nullable vers collecte_sessions — aucune contrainte sur les lignes
-- existantes (ON DELETE SET NULL garantit la rétrocompatibilité).
-- ─────────────────────────────────────────────────────────────────────────────

-- kyc_tokens : tracer quelle session a généré ce token
ALTER TABLE kyc_tokens
  ADD COLUMN IF NOT EXISTS collecte_session_id UUID
    REFERENCES collecte_sessions(id) ON DELETE SET NULL;
-- Nullable : les tokens créés avant ce module n'ont pas de session associée.
-- ON DELETE SET NULL : supprimer une session ne supprime pas le token.

-- objectifs : savoir dans quelle session cet objectif a été exprimé
ALTER TABLE objectifs
  ADD COLUMN IF NOT EXISTS collecte_session_id UUID
    REFERENCES collecte_sessions(id) ON DELETE SET NULL;
-- Nullable : les objectifs saisis manuellement hors session restent valides.


-- ─────────────────────────────────────────────────────────────────────────────
-- 7d. TRIGGER updated_at
-- Réutilise set_updated_at() définie en migration 001 — aucune duplication.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_collecte_sessions_updated_at ON collecte_sessions;
CREATE TRIGGER trg_collecte_sessions_updated_at
  BEFORE UPDATE ON collecte_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 7e. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- Lecture par client (dashboard conseiller, portail client)
CREATE INDEX IF NOT EXISTS idx_cs_client_id
  ON collecte_sessions (client_id);

-- Filtres de liste (statut, type)
CREATE INDEX IF NOT EXISTS idx_cs_statut
  ON collecte_sessions (statut);

CREATE INDEX IF NOT EXISTS idx_cs_type
  ON collecte_sessions (type);

-- Tri chronologique
CREATE INDEX IF NOT EXISTS idx_cs_created_at
  ON collecte_sessions (created_at DESC);

-- Jointures vers tables liées (partiels : évitent d'indexer les NULL)
CREATE INDEX IF NOT EXISTS idx_cs_kyc_token_id
  ON collecte_sessions (kyc_token_id)
  WHERE kyc_token_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cs_dossier_id
  ON collecte_sessions (dossier_id)
  WHERE dossier_id IS NOT NULL;

-- Index partiel pour le dashboard "Sessions en attente de revue" (requête fréquente)
CREATE INDEX IF NOT EXISTS idx_cs_en_revue
  ON collecte_sessions (client_id, created_at DESC)
  WHERE statut = 'en_revue';

-- Index sur les FK retour (lookup inverse depuis les tables liées)
CREATE INDEX IF NOT EXISTS idx_kyc_tokens_session_id
  ON kyc_tokens (collecte_session_id)
  WHERE collecte_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_objectifs_session_id
  ON objectifs (collecte_session_id)
  WHERE collecte_session_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7f. ROW LEVEL SECURITY
-- Pattern identique aux tables client-liées de migration 001 :
--   conseiller → accès complet
--   client     → lecture seule sur ses propres données
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE collecte_sessions ENABLE ROW LEVEL SECURITY;

-- Conseillers : lecture + écriture complètes
DROP POLICY IF EXISTS "conseiller_all" ON collecte_sessions;
CREATE POLICY "conseiller_all" ON collecte_sessions
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

-- Clients : lecture seule sur leurs propres sessions
-- Le client ne crée pas de session ; il y répond via le portail kyc_token.
DROP POLICY IF EXISTS "client_own_data" ON collecte_sessions;
CREATE POLICY "client_own_data" ON collecte_sessions
  FOR SELECT TO authenticated
  USING (get_user_role() = 'client' AND client_id = get_user_client_id());
