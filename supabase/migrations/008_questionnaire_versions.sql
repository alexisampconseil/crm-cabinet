-- =============================================================================
-- Migration 008 : Référentiel Client Patrimonial — Versions de questionnaires
-- Dépend de   : 007_collecte_sessions.sql (collecte_sessions)
-- Idempotente : ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
--               CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS,
--               DROP POLICY IF EXISTS
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 8a. TABLE PRINCIPALE : questionnaire_versions
-- Chaque ligne = un template figé du formulaire patrimonial.
-- Une version publiée est immuable : toute évolution crée une nouvelle version.
-- Le cycle de vie est enforced par la contrainte CHECK + le trigger 8c.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS questionnaire_versions (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  version VARCHAR(20) NOT NULL UNIQUE,
  -- Identifiant lisible et unique, ex : '1.0', '1.1', '2.0'.
  -- Géré manuellement par le cabinet pour conserver la signification
  -- sémantique (majeure.mineure) plutôt qu'un auto-incrément opaque.

  libelle TEXT NOT NULL,
  -- Nom descriptif, ex : 'Bilan patrimonial initial v1'.

  description TEXT,
  -- Notes internes sur les évolutions par rapport à la version précédente.
  -- Non affiché au client.

  version_schema VARCHAR(10) NOT NULL DEFAULT '1.0',
  -- Version du schéma JSONB de `structure`.
  -- Permet de faire évoluer le format du template sans casser la lecture
  -- des versions archivées (le parseur sait quel format attendre).


  -- ── Template du questionnaire ─────────────────────────────────────────────

  structure JSONB NOT NULL DEFAULT '{}',
  -- Définition complète du formulaire patrimonial.
  -- Format attendu (version_schema = '1.0') :
  -- {
  --   "blocs": [
  --     {
  --       "code": "identite",         -- code stable du bloc
  --       "libelle": "Identité",
  --       "ordre": 1,
  --       "questions": [
  --         {
  --           "code":        "id_pays_naissance",  -- stable entre versions
  --           "libelle":     "Pays de naissance",
  --           "type":        "texte",              -- texte|nombre|date|booleen|liste|multi_liste
  --           "portee":      "client",             -- client|conjoint|foyer
  --           "obligatoire": true,
  --           "conditions":  []                   -- règles de branchement
  --           -- ex : [{"champ":"perimetre","operateur":"=","valeur":"foyer"}]
  --         }
  --       ]
  --     }
  --   ]
  -- }


  -- ── Cycle de vie ─────────────────────────────────────────────────────────
  --
  -- brouillon ──→ publie ──→ archive
  --
  -- brouillon : en cours de rédaction — modifiable librement, non utilisable
  --             pour de nouvelles sessions.
  -- publie    : validé — utilisable pour les nouvelles sessions, contenu figé.
  -- archive   : remplacé — lecture seule, sessions existantes préservées.

  statut TEXT NOT NULL DEFAULT 'brouillon'
         CHECK (statut IN ('brouillon', 'publie', 'archive')),

  actif  BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE = cette version est sélectionnée pour les nouvelles sessions.
  -- Une seule version peut être active simultanément (index UNIQUE partiel, cf. 8d).
  -- Le passage actif = TRUE est réservé aux versions avec statut = 'publie'
  -- (contrainte chk_actif_implique_publie ci-dessous).

  CONSTRAINT chk_actif_implique_publie
    CHECK (NOT actif OR statut = 'publie'),
  -- Garde-fou déclaratif : actif = TRUE exige statut = 'publie'.
  -- Empêche qu'un brouillon soit accidentellement marqué actif.
  -- Complété par le trigger fn_guard_questionnaire_version (§8c)
  -- qui gère la logique de transition entre états.


  -- ── Métadonnées de publication ────────────────────────────────────────────

  date_publication TIMESTAMPTZ,
  -- Rempli par l'application lors du passage brouillon → publie.
  -- NULL pour les brouillons et les versions archivées sans date conservée.

  publie_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Conseiller ayant validé et publié cette version.

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Conseiller ayant créé le brouillon initial.

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8b. LIAISON VERS collecte_sessions
-- La colonne questionnaire_version_id ne pouvait pas être créée en migration 007
-- car questionnaire_versions n'existait pas encore.
-- ON DELETE RESTRICT : préserve la traçabilité — supprimer une version
-- référencée par des sessions est interdit, même si elle est archivée.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE collecte_sessions
  ADD COLUMN IF NOT EXISTS questionnaire_version_id UUID
    REFERENCES questionnaire_versions(id) ON DELETE RESTRICT;
-- Nullable : une session peut être créée (brouillon) avant que la version
-- du questionnaire soit choisie. La version est attachée à la transition
-- brouillon → en_cours (au moment de l'envoi du lien au client).


-- ─────────────────────────────────────────────────────────────────────────────
-- 8c. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- updated_at standard — réutilise set_updated_at() de migration 001
DROP TRIGGER IF EXISTS trg_questionnaire_versions_updated_at ON questionnaire_versions;
CREATE TRIGGER trg_questionnaire_versions_updated_at
  BEFORE UPDATE ON questionnaire_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Garde-fou d'immuabilité des versions publiées et archivées.
--
-- Transitions autorisées :
--   brouillon → brouillon (édition libre)
--   brouillon → publie    (validation)
--   publie    → archive   (remplacement par une nouvelle version)
--
-- Transitions bloquées :
--   publie  → brouillon  (réouverture interdite)
--   archive → tout       (état terminal)
--   tout    → modification du contenu si statut ∈ {publie, archive}
--
-- Champs de contenu protégés : structure, version, libelle, version_schema.
-- Champs non protégés : actif, notes, publie_par (métadonnées opérationnelles).

CREATE OR REPLACE FUNCTION fn_guard_questionnaire_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- Version archivée : aucune modification tolérée (état terminal)
  IF OLD.statut = 'archive' THEN
    RAISE EXCEPTION
      'Questionnaire version "%" (id=%) : état archive — lecture seule.',
      OLD.version, OLD.id;
  END IF;

  -- Version publiée : contenu figé, seul le passage vers archive est permis
  IF OLD.statut = 'publie' THEN

    -- Bloquer toute modification du contenu du template
    IF OLD.structure      IS DISTINCT FROM NEW.structure
    OR OLD.version        IS DISTINCT FROM NEW.version
    OR OLD.libelle        IS DISTINCT FROM NEW.libelle
    OR OLD.version_schema IS DISTINCT FROM NEW.version_schema
    THEN
      RAISE EXCEPTION
        'Questionnaire version "%" : le contenu d''une version publiée est immuable. Créer une nouvelle version pour apporter des modifications.',
        OLD.version;
    END IF;

    -- Bloquer toute transition de statut autre que publie → archive
    IF NEW.statut NOT IN ('publie', 'archive') THEN
      RAISE EXCEPTION
        'Questionnaire version "%" : transition "%" → "%" non autorisée. Seule la transition vers "archive" est permise depuis "publie".',
        OLD.version, OLD.statut, NEW.statut;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_questionnaire_version ON questionnaire_versions;
CREATE TRIGGER trg_guard_questionnaire_version
  BEFORE UPDATE ON questionnaire_versions
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION fn_guard_questionnaire_version();


-- ─────────────────────────────────────────────────────────────────────────────
-- 8d. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- Filtrage par état (liste brouillons / versions publiées / archivées)
CREATE INDEX IF NOT EXISTS idx_qv_statut
  ON questionnaire_versions (statut);

-- Index UNIQUE partiel : au plus une version active simultanément.
-- Technique : indexer la valeur constante TRUE pour les lignes où actif = TRUE.
-- L'unicité sur cette valeur interdit qu'une seconde ligne ait actif = TRUE.
-- Erreur produite : "duplicate key value violates unique constraint idx_qv_unique_actif"
CREATE UNIQUE INDEX IF NOT EXISTS idx_qv_unique_actif
  ON questionnaire_versions (actif)
  WHERE actif = TRUE;

-- Tri chronologique de création (liste des versions)
CREATE INDEX IF NOT EXISTS idx_qv_created_at
  ON questionnaire_versions (created_at DESC);

-- Tri par date de publication (historique des versions publiées)
CREATE INDEX IF NOT EXISTS idx_qv_date_publication
  ON questionnaire_versions (date_publication DESC)
  WHERE date_publication IS NOT NULL;

-- Jointure inverse depuis collecte_sessions
CREATE INDEX IF NOT EXISTS idx_cs_questionnaire_version_id
  ON collecte_sessions (questionnaire_version_id)
  WHERE questionnaire_version_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8e. ROW LEVEL SECURITY
-- Aligné sur le pattern produits (migration 001/002) :
--   lecture → tous les utilisateurs authentifiés
--   écriture → conseillers uniquement
-- Le client authentifié a besoin de lire la structure pour afficher
-- le questionnaire dans son portail. Les routes publiques (portail kyc_token)
-- passent par service_role et contournent le RLS.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE questionnaire_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read" ON questionnaire_versions;
CREATE POLICY "authenticated_read" ON questionnaire_versions
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "conseiller_write" ON questionnaire_versions;
CREATE POLICY "conseiller_write" ON questionnaire_versions
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');
