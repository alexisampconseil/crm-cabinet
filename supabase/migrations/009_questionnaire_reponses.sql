-- =============================================================================
-- Migration 009 : Référentiel Client Patrimonial — Réponses au questionnaire
-- Dépend de   : 007_collecte_sessions.sql (collecte_sessions)
--               008_questionnaire_versions.sql (questionnaire_versions)
-- Idempotente : CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP TRIGGER IF EXISTS, DROP POLICY IF EXISTS,
--               CREATE UNIQUE INDEX IF NOT EXISTS
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 9a. TABLE PRINCIPALE : questionnaire_reponses
--
-- Modèle de mutabilité retenu (Option A) :
--   Les réponses sont modifiables tant que la session est en 'brouillon'
--   ou 'en_cours'. Après passage en 'soumis', elles sont gelées définitivement.
--   Un UPDATE ou DELETE après soumission est intercepté par le trigger 9b.
--
--   Ce choix garantit une ligne courante par (session_id, question_code,
--   portee, groupe_instance_id), enforced par deux index UNIQUE partiels (§9c).
--
-- Groupes répétables :
--   groupe_instance_id UUID est généré par l'application à chaque "Ajouter
--   un enfant / un actif / un crédit…". Toutes les réponses de la même
--   occurrence partagent ce UUID. NULL pour les blocs non-répétables
--   (identite, fiscalite, prevoyance…).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS questionnaire_reponses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES collecte_sessions(id) ON DELETE CASCADE,


  -- ── Localisation de la réponse ───────────────────────────────────────────

  bloc TEXT NOT NULL
       CHECK (bloc IN (
         'identite',          -- Identité civile du client (et du conjoint si foyer)
         'foyer',             -- Situation familiale, matrimoniale, enfants
         'situation_pro',     -- Profession, statut, employeur
         'revenus',           -- Revenus du client et du conjoint
         'charges',           -- Charges courantes du foyer
         'actifs_financiers', -- Placements (AV, PER, SCPI, PEA, CTO, Livret…)
         'immobilier',        -- Patrimoine immobilier
         'passifs',           -- Crédits et dettes
         'fiscalite',         -- Situation fiscale (IR, IFI, dispositifs)
         'prevoyance',        -- Prévoyance existante (descriptif uniquement)
         'objectifs'          -- Objectifs patrimoniaux
       )),

  question_code VARCHAR(100) NOT NULL,
  -- Identifiant stable de la question, ex : 'rev_salaire_net_annuel'.
  -- Ne change pas entre versions : permet de comparer des réponses issues
  -- de versions différentes du questionnaire.

  portee TEXT NOT NULL DEFAULT 'client'
         CHECK (portee IN (
           'client',   -- Réponse relative au client signataire
           'conjoint', -- Réponse relative au conjoint / partenaire
           'foyer'     -- Réponse valable pour l'ensemble du foyer
         )),

  groupe_instance_id UUID,
  -- UUID généré côté application à chaque ajout d'une occurrence répétable.
  -- Toutes les réponses d'un même enfant, bien immobilier, crédit ou contrat
  -- partagent ce UUID. Permet de regrouper et de supprimer une occurrence
  -- entière sans renuméroter les autres.
  -- NULL pour les blocs non-répétables (identite, fiscalite, prevoyance…).
  -- La combinaison (session_id, question_code, portee, groupe_instance_id)
  -- est unique — voir index partiels § 9c.


  -- ── Valeur de la réponse ─────────────────────────────────────────────────

  reponse_type TEXT NOT NULL
               CHECK (reponse_type IN (
                 'texte',       -- Saisie libre
                 'nombre',      -- Valeur numérique (montant, durée, taux…)
                 'date',        -- Date au format ISO 8601 (YYYY-MM-DD)
                 'booleen',     -- Oui / Non ('true' ou 'false')
                 'liste',       -- Sélection unique parmi des options
                 'multi_liste'  -- Sélection multiple
               )),

  reponse_valeur TEXT,
  -- Représentation textuelle de la réponse telle que saisie ou sérialisée.
  -- Exemples : '48000', '2024-01-15', 'true', 'marie', 'deces'.
  -- NULL acceptable si toute l'information structurée est dans reponse_metadata.

  reponse_metadata JSONB NOT NULL DEFAULT '{}',
  -- Informations structurées complémentaires :
  --   - valeur typée parsée (numeric pour nombre, date pour date)
  --   - unité (€, %, ans…)
  --   - options disponibles lors de la saisie (pour multi_liste)
  --   - tableau des sélections (pour multi_liste)
  -- Exemples :
  --   type='nombre'     → {"valeur": 48000, "unite": "EUR/an"}
  --   type='multi_liste'→ {"selected": ["deces","invalidite"],
  --                        "options":  ["deces","incapacite","invalidite","dependance"]}


  -- ── Traçabilité de version ────────────────────────────────────────────────

  questionnaire_version_id UUID REFERENCES questionnaire_versions(id) ON DELETE SET NULL,
  -- FK directe vers la version utilisée — facilite les jointures et les
  -- requêtes du type "toutes les réponses soumises avec la version 1.0"
  -- sans passer par collecte_sessions.
  -- ON DELETE SET NULL : une version archivée ne supprime pas les réponses.

  version_questionnaire VARCHAR(20),
  -- Copie dénormalisée de questionnaire_versions.version ('1.0', '2.0'…).
  -- Lisible sans JOIN, résistante à tout changement de structure de la table.
  -- Pattern identique à documents_extraits.version_prompt (migration 004).


  -- ── Traçabilité de saisie ─────────────────────────────────────────────────

  saisi_par TEXT NOT NULL DEFAULT 'client'
            CHECK (saisi_par IN (
              'client',     -- Saisie via le portail (route API + service_role)
              'conseiller'  -- Saisie directe lors d'un entretien (auth Supabase)
            )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  -- updated_at présent car Option A : la réponse est modifiable avant soumission.
  -- Permet de tracer la dernière correction et d'ordonner les lignes si nécessaire.
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9b. TRIGGER DE GARDE
-- Intercepte INSERT, UPDATE et DELETE.
-- Vérifie que la session est en 'brouillon' ou 'en_cours' avant d'autoriser
-- toute modification. Toute tentative sur une session 'soumis', 'en_revue',
-- 'valide' ou 'archive' lève une exception.
--
-- SECURITY DEFINER + SET search_path = public : lit collecte_sessions en
-- contournant le RLS, cohérent avec fn_snapshot_gouvernance (migration 002)
-- et fn_guard_questionnaire_version (migration 008).
--
-- Ordre de déclenchement sur UPDATE (alphabétique par nom de trigger) :
--   1. trg_guard_reponse_session   → vérifie l'autorisation
--   2. trg_qr_updated_at           → met à jour updated_at
-- Si le garde lève une exception, updated_at ne s'exécute jamais.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_guard_reponse_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_statut     TEXT;
BEGIN
  -- Résoudre le session_id selon le type d'opération
  v_session_id := CASE TG_OP WHEN 'DELETE' THEN OLD.session_id ELSE NEW.session_id END;

  SELECT statut INTO v_statut
  FROM collecte_sessions
  WHERE id = v_session_id;

  IF v_statut IS NULL THEN
    RAISE EXCEPTION
      'questionnaire_reponses : session introuvable (id = %).',
      v_session_id;
  END IF;

  IF v_statut NOT IN ('brouillon', 'en_cours') THEN
    RAISE EXCEPTION
      'questionnaire_reponses : session % (statut "%") — les réponses sont gelées. Aucun INSERT, UPDATE ni DELETE autorisé après soumission.',
      v_session_id, v_statut;
  END IF;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_reponse_session ON questionnaire_reponses;
CREATE TRIGGER trg_guard_reponse_session
  BEFORE INSERT OR UPDATE OR DELETE ON questionnaire_reponses
  FOR EACH ROW EXECUTE FUNCTION fn_guard_reponse_session();


-- updated_at — réutilise set_updated_at() de migration 001
-- Nom préfixé 'trg_qr_' pour garantir un ordre alphabétique après le guard.
DROP TRIGGER IF EXISTS trg_qr_updated_at ON questionnaire_reponses;
CREATE TRIGGER trg_qr_updated_at
  BEFORE UPDATE ON questionnaire_reponses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 9c. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- Chargement complet d'une session
CREATE INDEX IF NOT EXISTS idx_qr_session_id
  ON questionnaire_reponses (session_id);

-- Affichage d'un bloc dans l'interface (conseiller ou portail)
CREATE INDEX IF NOT EXISTS idx_qr_session_bloc
  ON questionnaire_reponses (session_id, bloc);

-- Regroupement de toutes les réponses d'une occurrence répétable
CREATE INDEX IF NOT EXISTS idx_qr_groupe_instance
  ON questionnaire_reponses (session_id, groupe_instance_id)
  WHERE groupe_instance_id IS NOT NULL;

-- Jointure vers questionnaire_versions (requêtes cross-version)
CREATE INDEX IF NOT EXISTS idx_qr_questionnaire_version_id
  ON questionnaire_reponses (questionnaire_version_id)
  WHERE questionnaire_version_id IS NOT NULL;

-- Audit : qui a saisi quoi dans cette session
CREATE INDEX IF NOT EXISTS idx_qr_saisi_par
  ON questionnaire_reponses (session_id, saisi_par);

-- ── Index UNIQUE partiels — intégrité de la réponse courante ─────────────────
--
-- Deux index distincts pour gérer la sémantique du NULL dans PostgreSQL :
-- les NULL ne sont pas égaux dans un index UNIQUE, ce qui rendrait un index
-- unique sur (session_id, question_code, portee, groupe_instance_id) inopérant
-- pour les lignes où groupe_instance_id IS NULL.

-- Questions non-répétables : groupe_instance_id IS NULL
-- Garantit une seule réponse par (session, question, portée) hors groupes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_unique_non_repeatable
  ON questionnaire_reponses (session_id, question_code, portee)
  WHERE groupe_instance_id IS NULL;

-- Questions répétables : groupe_instance_id IS NOT NULL
-- Garantit une seule réponse par (session, question, portée, instance).
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_unique_repeatable
  ON questionnaire_reponses (session_id, question_code, portee, groupe_instance_id)
  WHERE groupe_instance_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9d. ROW LEVEL SECURITY
--
-- UPDATE inclus dans la policy conseiller car Option A (modifiable avant
-- soumission). Le trigger fn_guard_reponse_session enforce le gel post-soumis
-- au niveau base, indépendamment du RLS.
--
-- Les soumissions client (portail) passent par une route API avec service_role
-- qui contourne le RLS — cohérent avec le traitement de kyc_responses
-- (migration 001). Aucune policy INSERT/UPDATE dédiée aux clients n'est
-- nécessaire ici.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE questionnaire_reponses ENABLE ROW LEVEL SECURITY;

-- Conseillers : accès complet (SELECT + INSERT + UPDATE + DELETE)
-- Le trigger de garde (§9b) est le vrai verrou post-soumission.
DROP POLICY IF EXISTS "conseiller_all" ON questionnaire_reponses;
CREATE POLICY "conseiller_all" ON questionnaire_reponses
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

-- Clients : lecture seule sur leurs propres sessions
-- La sous-requête est elle-même protégée par le RLS de collecte_sessions.
DROP POLICY IF EXISTS "client_own_data" ON questionnaire_reponses;
CREATE POLICY "client_own_data" ON questionnaire_reponses
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'client' AND
    session_id IN (
      SELECT id FROM collecte_sessions
      WHERE client_id = get_user_client_id()
    )
  );
