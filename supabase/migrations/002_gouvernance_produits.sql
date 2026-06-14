-- =============================================================================
-- Migration 002 : Module Gouvernance Produits — AMP CONSEIL CRM
-- Dépend de : 001_initial_schema.sql
-- Idempotente : ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS, CREATE OR REPLACE
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 2a. COLONNES COMPLÉMENTAIRES SUR produits
-- categorie_reglementaire sur produits (attribut produit, pas seulement gouvernance)
-- pour filtrage catalogue et PDF sans JOIN obligatoire
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE produits
  ADD COLUMN IF NOT EXISTS isin                    VARCHAR(12)
    CHECK (isin ~ '^[A-Z]{2}[A-Z0-9]{10}$'),
  ADD COLUMN IF NOT EXISTS frais_entree            NUMERIC(5,3)
    CHECK (frais_entree    BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS frais_gestion           NUMERIC(5,3)
    CHECK (frais_gestion   BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS frais_sortie            NUMERIC(5,3)
    CHECK (frais_sortie    BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS duree_detention_min     INTEGER
    CHECK (duree_detention_min >= 0),
  ADD COLUMN IF NOT EXISTS date_agrement           DATE,
  ADD COLUMN IF NOT EXISTS encours_geres           NUMERIC(14,2)
    CHECK (encours_geres  >= 0),
  ADD COLUMN IF NOT EXISTS categorie_reglementaire TEXT
    CHECK (categorie_reglementaire IN (
      'OPCVM',            -- Organisme de Placement Collectif en VM (UCITS / MIF2)
      'FIA',              -- Fonds d'Investissement Alternatif (AIFM / MIF2)
      'assurance_vie',    -- Contrat d'assurance-vie (DDA)
      'capitalisation',   -- Contrat de capitalisation (DDA)
      'per_individuel',   -- Plan d'Épargne Retraite Individuel (DDA)
      'per_collectif',    -- Plan d'Épargne Retraite Collectif (DDA)
      'scpi',             -- Société Civile de Placement Immobilier (AMF)
      'opci',             -- Organisme de Placement Collectif Immobilier (AMF)
      'produit_structure',-- Produit structuré (MIF2)
      'autre'
    ));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. MÉTADONNÉES DOCUMENTS PRODUITS + correctif policy manquante (bug migration 001)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE produits_documents
  ADD COLUMN IF NOT EXISTS version          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS statut           TEXT DEFAULT 'actif'
    CHECK (statut IN ('actif', 'archive', 'expire')),
  ADD COLUMN IF NOT EXISTS date_expiration  DATE;

-- Bug migration 001 : conseiller_write manquait sur produits_documents
DROP POLICY IF EXISTS "conseiller_write" ON produits_documents;
CREATE POLICY "conseiller_write" ON produits_documents
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2c. TABLE PRINCIPALE : produits_gouvernance
-- Relation 1-to-1 avec produits (UNIQUE sur produit_id)
-- Mutualisée : pas de cabinet_id, cohérent avec le modèle mono-cabinet existant
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS produits_gouvernance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id  UUID NOT NULL UNIQUE REFERENCES produits(id) ON DELETE CASCADE,


  -- ── Conformité globale ────────────────────────────────────────────────────

  statut_conformite TEXT NOT NULL DEFAULT 'conforme'
    CHECK (statut_conformite IN (
      'conforme',
      'en_revision',
      'suspendu',
      'non_conforme'
    )),


  -- ── Marché cible émetteur brut (avant toute normalisation) ───────────────
  -- Conserve la source telle quelle pour démontrer la chaîne :
  --   mc_emetteur_texte / mc_emetteur_brut
  --     → mapping_ia (détail du mapping)
  --       → mc_pos_* / mc_neg_* (classification interne CRM)

  mc_emetteur_texte  TEXT,
  -- Extrait PDF ou saisie libre (non structuré, tel que rédigé par l'émetteur)

  mc_emetteur_brut   JSONB,
  -- Structure JSON si données disponibles numériquement (Excel, API émetteur)


  -- ── Marché cible POSITIF — référentiel interne normalisé ─────────────────

  mc_pos_connaissance     TEXT
    CHECK (mc_pos_connaissance IN (
      'basique',   -- Basique
      'informe',   -- Informé
      'expert'     -- Expert
    )),

  mc_pos_experience       TEXT
    CHECK (mc_pos_experience IN (
      'faible',    -- Faible
      'moyenne',   -- Moyenne
      'elevee'     -- Élevée
    )),

  mc_pos_capacite_pertes  TEXT
    CHECK (mc_pos_capacite_pertes IN (
      'aucune_perte',       -- Aucune perte en capital
      'pertes_limitees',    -- Pertes en capital limitées
      'perte_capital',      -- Perte du capital investi
      'pertes_superieures'  -- Pertes supérieures au capital investi
    )),

  mc_pos_tolerance_risque TEXT
    CHECK (mc_pos_tolerance_risque IN (
      'tres_faible',  -- SRI 1
      'faible',       -- SRI 2-3
      'moyenne',      -- SRI 4
      'elevee',       -- SRI 5-6
      'tres_elevee'   -- SRI 7
    )),

  mc_pos_horizon          TEXT
    CHECK (mc_pos_horizon IN (
      'moins_2_ans',
      'entre_2_et_5_ans',
      'plus_5_ans'
    )),

  mc_pos_sensibilite_esg  TEXT
    CHECK (mc_pos_sensibilite_esg IN ('aucune', 'moderee', 'forte')),


  -- ── Marché cible NÉGATIF — référentiel interne normalisé ─────────────────

  mc_neg_connaissance     TEXT
    CHECK (mc_neg_connaissance IN ('basique', 'informe', 'expert')),

  mc_neg_experience       TEXT
    CHECK (mc_neg_experience IN ('faible', 'moyenne', 'elevee')),

  mc_neg_capacite_pertes  TEXT
    CHECK (mc_neg_capacite_pertes IN (
      'aucune_perte', 'pertes_limitees', 'perte_capital', 'pertes_superieures'
    )),

  mc_neg_tolerance_risque TEXT
    CHECK (mc_neg_tolerance_risque IN (
      'tres_faible', 'faible', 'moyenne', 'elevee', 'tres_elevee'
    )),

  mc_neg_horizon          TEXT
    CHECK (mc_neg_horizon IN ('moins_2_ans', 'entre_2_et_5_ans', 'plus_5_ans')),

  mc_neg_sensibilite_esg  TEXT
    CHECK (mc_neg_sensibilite_esg IN ('aucune', 'moderee', 'forte')),


  -- ── Champs narratifs gouvernance ──────────────────────────────────────────

  public_exclu              TEXT,
  conditions_acces          TEXT,
  conflits_interet          TEXT,
  notes_gouvernance         TEXT,
  document_gouvernance_url  TEXT,


  -- ── Revues périodiques ───────────────────────────────────────────────────

  frequence_revue      TEXT
    CHECK (frequence_revue IN ('trimestrielle', 'semestrielle', 'annuelle')),
  date_derniere_revue  DATE,
  date_prochaine_revue DATE,
  responsable_revue    TEXT,
  alerte_revue         BOOLEAN DEFAULT FALSE,
  -- TRUE = produit affiché dans le dashboard "Produits à revoir"


  -- ── Traçabilité IA ───────────────────────────────────────────────────────

  source_marche_cible TEXT DEFAULT 'manuel'
    CHECK (source_marche_cible IN (
      'emetteur',   -- données fournies par la société de gestion
      'deduit_ia',  -- déduit par IA à partir d'un document source
      'manuel'      -- saisi manuellement par le conseiller
    )),

  source_document_id  UUID REFERENCES produits_documents(id) ON DELETE SET NULL,
  -- Document source utilisé par l'IA (nullable si saisie manuelle)

  extraits_sources    JSONB,
  -- [{document_id, page, texte}, ...]
  -- Passages textuels ayant servi à l'analyse IA

  justifications_ia   JSONB,
  -- {connaissance: "raison...", experience: "raison...", ...}
  -- Justification narrative par dimension

  mapping_ia          JSONB,
  -- Détail structuré du mapping source → interne, par dimension et par marché :
  -- {
  --   positif: {
  --     connaissance: { valeur_source, valeur_normalisee, confiance, justification },
  --     experience:   { valeur_source, valeur_normalisee, confiance, justification },
  --     ...
  --   },
  --   negatif: { ... }
  -- }

  score_confiance_ia  NUMERIC(4,3)
    CHECK (score_confiance_ia BETWEEN 0 AND 1),
  -- Score de confiance global 0.000 → 1.000

  date_analyse_ia     TIMESTAMPTZ,
  -- Horodatage de l'analyse IA (NULL si saisie manuelle)

  modele_ia           VARCHAR(100),
  -- Modèle utilisé : ex. "claude-sonnet-4-6", "claude-opus-4-7"


  -- ── Validation ───────────────────────────────────────────────────────────

  statut_validation TEXT NOT NULL DEFAULT 'a_valider'
    CHECK (statut_validation IN (
      'a_valider',  -- généré ou modifié, en attente de relecture conseiller
      'valide',     -- approuvé par un conseiller
      'a_revoir'    -- signalé comme incorrect ou incomplet
    )),

  motif_signalement TEXT,
  -- Dernier motif saisi par le conseiller lors d'un signalement "à revoir".
  -- Remis à NULL lors d'une revalidation.
  -- Archivé dans chaque snapshot historique via to_jsonb(OLD) — tracé dans le temps.

  valide_par  UUID,         -- auth.uid() du validateur (nullable)
  valide_le   TIMESTAMPTZ,


  -- ── Timestamps ───────────────────────────────────────────────────────────

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2d. TABLE HISTORIQUE : produits_gouvernance_historique
-- Alimentation exclusive par trigger SECURITY DEFINER
-- Aucune policy d'écriture directe — protection intentionnelle
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS produits_gouvernance_historique (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gouvernance_id  UUID NOT NULL REFERENCES produits_gouvernance(id) ON DELETE CASCADE,
  produit_id      UUID NOT NULL,       -- dénormalisé pour requêtes directes sans JOIN

  snapshot        JSONB NOT NULL,      -- copie intégrale de la ligne avant modification

  modifie_par     UUID,                -- auth.uid() — NULL si appel service_role/cron
  modifie_le      TIMESTAMPTZ DEFAULT NOW(),
  motif           TEXT,                -- raison optionnelle fournie par le conseiller

  -- Deltas de statut pour filtrage sans parser le snapshot
  statut_conformite_avant  TEXT,
  statut_conformite_apres  TEXT,
  statut_validation_avant  TEXT,
  statut_validation_apres  TEXT
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2e. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- updated_at automatique — réutilise set_updated_at() de migration 001
DROP TRIGGER IF EXISTS trg_produits_gouvernance_updated_at ON produits_gouvernance;
CREATE TRIGGER trg_produits_gouvernance_updated_at
  BEFORE UPDATE ON produits_gouvernance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Snapshot automatique AFTER UPDATE (uniquement si la ligne a réellement changé)
CREATE OR REPLACE FUNCTION fn_snapshot_gouvernance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER              -- contourne le RLS de la table historique
SET search_path = public      -- évite les injections de search_path
AS $$
BEGIN
  INSERT INTO produits_gouvernance_historique (
    gouvernance_id,
    produit_id,
    snapshot,
    modifie_par,
    modifie_le,
    statut_conformite_avant,
    statut_conformite_apres,
    statut_validation_avant,
    statut_validation_apres
  ) VALUES (
    OLD.id,
    OLD.produit_id,
    to_jsonb(OLD),
    auth.uid(),
    NOW(),
    OLD.statut_conformite,
    NEW.statut_conformite,
    OLD.statut_validation,
    NEW.statut_validation
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_gouvernance ON produits_gouvernance;
CREATE TRIGGER trg_snapshot_gouvernance
  AFTER UPDATE ON produits_gouvernance
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION fn_snapshot_gouvernance();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2f. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- produits — nouveau champ
CREATE INDEX IF NOT EXISTS idx_produits_categorie_reglementaire
  ON produits (categorie_reglementaire)
  WHERE categorie_reglementaire IS NOT NULL;

-- produits_gouvernance
CREATE INDEX IF NOT EXISTS idx_pg_statut_conformite
  ON produits_gouvernance (statut_conformite);
CREATE INDEX IF NOT EXISTS idx_pg_statut_validation
  ON produits_gouvernance (statut_validation);
CREATE INDEX IF NOT EXISTS idx_pg_alerte_revue
  ON produits_gouvernance (alerte_revue)
  WHERE alerte_revue = TRUE;
CREATE INDEX IF NOT EXISTS idx_pg_prochaine_revue
  ON produits_gouvernance (date_prochaine_revue)
  WHERE date_prochaine_revue IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pg_frequence_revue
  ON produits_gouvernance (frequence_revue)
  WHERE frequence_revue IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pg_source
  ON produits_gouvernance (source_marche_cible);
CREATE INDEX IF NOT EXISTS idx_pg_pos_tolerance
  ON produits_gouvernance (mc_pos_tolerance_risque)
  WHERE mc_pos_tolerance_risque IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pg_neg_tolerance
  ON produits_gouvernance (mc_neg_tolerance_risque)
  WHERE mc_neg_tolerance_risque IS NOT NULL;

-- produits_gouvernance_historique
CREATE INDEX IF NOT EXISTS idx_pgh_gouvernance_id
  ON produits_gouvernance_historique (gouvernance_id);
CREATE INDEX IF NOT EXISTS idx_pgh_produit_id
  ON produits_gouvernance_historique (produit_id);
CREATE INDEX IF NOT EXISTS idx_pgh_modifie_le
  ON produits_gouvernance_historique (modifie_le DESC);
CREATE INDEX IF NOT EXISTS idx_pgh_modifie_par
  ON produits_gouvernance_historique (modifie_par)
  WHERE modifie_par IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2g. RLS — pattern get_user_role() cohérent avec migration 001
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE produits_gouvernance             ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits_gouvernance_historique  ENABLE ROW LEVEL SECURITY;

-- produits_gouvernance : lecture tous les authentifiés (cohérent avec produits)
DROP POLICY IF EXISTS "pg_read_authenticated" ON produits_gouvernance;
CREATE POLICY "pg_read_authenticated" ON produits_gouvernance
  FOR SELECT TO authenticated USING (TRUE);

-- produits_gouvernance : écriture conseillers uniquement
DROP POLICY IF EXISTS "pg_write_conseiller" ON produits_gouvernance;
CREATE POLICY "pg_write_conseiller" ON produits_gouvernance
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

-- historique : lecture conseillers uniquement
DROP POLICY IF EXISTS "pgh_read_conseiller" ON produits_gouvernance_historique;
CREATE POLICY "pgh_read_conseiller" ON produits_gouvernance_historique
  FOR SELECT TO authenticated
  USING (get_user_role() = 'conseiller');

-- historique : pas de policy INSERT/UPDATE/DELETE directe
-- le trigger SECURITY DEFINER est le seul vecteur d'écriture autorisé
