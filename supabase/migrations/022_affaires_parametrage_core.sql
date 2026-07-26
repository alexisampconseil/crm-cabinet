-- =============================================================================
-- Migration 022 : Module Affaires — Paramétrage principal (core)
-- Dépend de   : 001_initial_schema.sql (public.set_updated_at, public.get_user_role)
--               002_gouvernance_produits.sql (valeurs produits.categorie_reglementaire)
--               021_affaires_socle_securite.sql (public.peut_parametrer_affaires)
-- Idempotente : CREATE TABLE/INDEX IF NOT EXISTS, DROP TRIGGER/POLICY IF EXISTS
--               avant (re)création, REVOKE/GRANT rejouables, seeds ON CONFLICT DO NOTHING.
-- =============================================================================
--
-- Périmètre STRICT : quatre tables de paramétrage du module Affaires —
--   affaire_familles, affaire_types, partenaires, affaire_motifs_archivage —
--   avec contraintes, index, triggers updated_at, RLS, privilèges et seeds
--   (familles + motifs uniquement). Aucune table d'instance (affaires, étapes…),
--   aucun type d'affaire seedé, aucun partenaire seedé.
--
-- ── Robustesse UUID (leçon migration 001) ───────────────────────────────────
--   Les PK utilisent gen_random_uuid() — fonction CŒUR PostgreSQL (schéma
--   pg_catalog, toujours dans le search_path implicite), et NON
--   uuid_generate_v4() (extension uuid-ossp, schéma `extensions`, qui a échoué
--   sur base vierge sans ALTER DATABASE search_path). Cette migration est donc
--   reproductible sur une base Supabase vierge SANS aucun réglage de search_path.
--
-- ── Fonctions schéma-qualifiées ─────────────────────────────────────────────
--   set_updated_at, get_user_role et peut_parametrer_affaires sont appelées avec
--   leur schéma explicite (public.*) dans les triggers et policies, pour ne
--   dépendre d'aucun search_path particulier.
--
-- ── Règle sur `code` ────────────────────────────────────────────────────────
--   Les colonnes `code` (familles, types, motifs) sont des identifiants métier
--   STABLES. Elles ne doivent pas être modifiées librement une fois référencées
--   par des affaires : les futures FK en ON DELETE RESTRICT (migrations 023+)
--   garantiront l'intégrité et empêcheront toute suppression d'une ligne utilisée.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 22a. TABLE : affaire_familles
-- Familles réglementaires configurables (Immobilier, Assurance, Épargne…).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_familles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        NOT NULL,
  libelle    TEXT        NOT NULL,
  ordre      INTEGER     NOT NULL DEFAULT 0,
  actif      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_af_code    UNIQUE (code),
  CONSTRAINT chk_af_ordre  CHECK (ordre >= 0)
);

CREATE INDEX IF NOT EXISTS idx_af_actif_ordre
  ON public.affaire_familles (actif, ordre);

DROP TRIGGER IF EXISTS trg_af_updated_at ON public.affaire_familles;
CREATE TRIGGER trg_af_updated_at
  BEFORE UPDATE ON public.affaire_familles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 22b. TABLE : affaire_types
-- Types d'affaires rattachés à une famille. Correspondances patrimoniale et
-- produit FACULTATIVES (nullable).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_types (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  famille_id             UUID        NOT NULL,
  code                   TEXT        NOT NULL,
  libelle                TEXT        NOT NULL,
  ordre                  INTEGER     NOT NULL DEFAULT 0,
  actif                  BOOLEAN     NOT NULL DEFAULT TRUE,
  categorie_patrimoniale TEXT,
  categorie_produit      TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_at_famille
    FOREIGN KEY (famille_id) REFERENCES public.affaire_familles (id) ON DELETE RESTRICT,

  -- Unicité fonctionnelle : un code de type unique par famille.
  CONSTRAINT uq_at_famille_code UNIQUE (famille_id, code),

  -- Cible des futures FK composites du module (garantit qu'un type référencé
  -- appartient bien à la famille attendue) — cf. plan de conception.
  CONSTRAINT uq_at_id_famille UNIQUE (id, famille_id),

  CONSTRAINT chk_at_ordre CHECK (ordre >= 0),

  -- Catégorie patrimoniale : uniquement les entités réellement ciblables.
  CONSTRAINT chk_at_categorie_patrimoniale
    CHECK (categorie_patrimoniale IN (
      'actif_financier',
      'patrimoine_immobilier',
      'passif',
      'contrat_prevoyance'
    )),

  -- Catégorie produit : miroir EXACT de produits.categorie_reglementaire
  -- (migration 002) — correspondance facultative, aucune nouvelle classification.
  CONSTRAINT chk_at_categorie_produit
    CHECK (categorie_produit IN (
      'OPCVM',
      'FIA',
      'assurance_vie',
      'capitalisation',
      'per_individuel',
      'per_collectif',
      'scpi',
      'opci',
      'produit_structure',
      'autre'
    ))
);

-- Lecture par famille, statut actif et ordre (liste des types d'une famille).
CREATE INDEX IF NOT EXISTS idx_at_famille_actif_ordre
  ON public.affaire_types (famille_id, actif, ordre);

DROP TRIGGER IF EXISTS trg_at_updated_at ON public.affaire_types;
CREATE TRIGGER trg_at_updated_at
  BEFORE UPDATE ON public.affaire_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 22c. TABLE : partenaires
-- Référentiel léger (assureur, plateforme, courtier, banque, société de gestion).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partenaires (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT        NOT NULL,
  type_partenaire TEXT        NOT NULL,
  actif           BOOLEAN     NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_part_type
    CHECK (type_partenaire IN (
      'assureur',
      'plateforme',
      'courtier',
      'banque',
      'societe_gestion',
      'autre'
    ))
);

-- Anti-doublon raisonnable : un même nom (insensible à la casse) ne peut exister
-- deux fois pour un même type. Deux partenaires de types différents peuvent
-- légitimement porter le même nom.
CREATE UNIQUE INDEX IF NOT EXISTS uq_partenaires_nom_type
  ON public.partenaires (lower(nom), type_partenaire);

-- Lecture / filtrage par type et statut.
CREATE INDEX IF NOT EXISTS idx_part_type_actif
  ON public.partenaires (type_partenaire, actif);

DROP TRIGGER IF EXISTS trg_part_updated_at ON public.partenaires;
CREATE TRIGGER trg_part_updated_at
  BEFORE UPDATE ON public.partenaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 22d. TABLE : affaire_motifs_archivage
-- Motifs d'archivage configurables ; `necessite_commentaire` impose un
-- commentaire côté affaire (enforcé en migration 023+).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_motifs_archivage (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT        NOT NULL,
  libelle               TEXT        NOT NULL,
  ordre                 INTEGER     NOT NULL DEFAULT 0,
  actif                 BOOLEAN     NOT NULL DEFAULT TRUE,
  necessite_commentaire BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ma_code   UNIQUE (code),
  CONSTRAINT chk_ma_ordre CHECK (ordre >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ma_actif_ordre
  ON public.affaire_motifs_archivage (actif, ordre);

DROP TRIGGER IF EXISTS trg_ma_updated_at ON public.affaire_motifs_archivage;
CREATE TRIGGER trg_ma_updated_at
  BEFORE UPDATE ON public.affaire_motifs_archivage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 22e. PRIVILÈGES DE TABLE
-- Supabase accorde par défaut ALL à anon/authenticated/service_role sur les
-- tables du schéma public. On retire tout accès à anon et PUBLIC (paramétrage
-- interne), on accorde explicitement le nécessaire à authenticated (la RLS
-- filtre ensuite), et ALL à service_role (administration).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'public.affaire_familles',
    'public.affaire_types',
    'public.partenaires',
    'public.affaire_motifs_archivage'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO authenticated;', t);
    EXECUTE format('GRANT ALL ON TABLE %s TO service_role;', t);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 22f. ROW LEVEL SECURITY
-- V1 :
--   SELECT : conseillers (tous) — le paramétrage n'est pas exposé aux clients.
--   INSERT/UPDATE/DELETE : conseillers possédant peut_parametrer_affaires().
--   Aucun accès client, aucun accès anon (déjà révoqué en privilèges).
-- Fonctions schéma-qualifiées (public.*) — aucune dépendance au search_path.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'affaire_familles',
    'affaire_types',
    'partenaires',
    'affaire_motifs_archivage'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- SELECT : conseiller
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_conseiller" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_select_conseiller" ON public.%1$I
        FOR SELECT TO authenticated
        USING (public.get_user_role() = 'conseiller');
    $p$, t);

    -- INSERT : conseiller + permission
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_param" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_insert_param" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (public.get_user_role() = 'conseiller' AND public.peut_parametrer_affaires() = TRUE);
    $p$, t);

    -- UPDATE : conseiller + permission (USING + WITH CHECK)
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_param" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_update_param" ON public.%1$I
        FOR UPDATE TO authenticated
        USING      (public.get_user_role() = 'conseiller' AND public.peut_parametrer_affaires() = TRUE)
        WITH CHECK (public.get_user_role() = 'conseiller' AND public.peut_parametrer_affaires() = TRUE);
    $p$, t);

    -- DELETE : conseiller + permission (les FK RESTRICT futures bloqueront les lignes utilisées)
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_param" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_delete_param" ON public.%1$I
        FOR DELETE TO authenticated
        USING (public.get_user_role() = 'conseiller' AND public.peut_parametrer_affaires() = TRUE);
    $p$, t);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 22g. SEEDS (idempotents — ON CONFLICT (code) DO NOTHING)
-- Ne réécrasent jamais un libellé/ordre modifié volontairement dans le CRM.
-- Seuls familles + motifs sont seedés. Aucun type d'affaire, aucun partenaire.
-- ─────────────────────────────────────────────────────────────────────────────

-- Cinq familles réglementaires initiales.
INSERT INTO public.affaire_familles (code, libelle, ordre) VALUES
  ('immobilier',             'Immobilier',              1),
  ('assurance',              'Assurance',               2),
  ('conseil_investissement', 'Conseil en investissement', 3),
  ('epargne',                'Épargne',                 4),
  ('conseils',               'Conseils',                5)
ON CONFLICT (code) DO NOTHING;

-- Sept motifs d'archivage initiaux ; « autre » exige un commentaire.
INSERT INTO public.affaire_motifs_archivage (code, libelle, ordre, necessite_commentaire) VALUES
  ('refus_client',      'Refus du client',    1, FALSE),
  ('projet_abandonne',  'Projet abandonné',   2, FALSE),
  ('non_eligibilite',   'Non-éligibilité',    3, FALSE),
  ('absence_reponse',   'Absence de réponse', 4, FALSE),
  ('concurrent_retenu', 'Concurrent retenu',  5, FALSE),
  ('erreur_creation',   'Erreur de création', 6, FALSE),
  ('autre',             'Autre',              7, TRUE)
ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- PLAN DE ROLLBACK  (à exécuter manuellement — non exécuté ici)
-- =============================================================================
--   -- Les policies et triggers tombent avec les tables (DROP TABLE CASCADE).
--   DROP TABLE IF EXISTS public.affaire_types            CASCADE; -- avant familles (FK)
--   DROP TABLE IF EXISTS public.affaire_familles         CASCADE;
--   DROP TABLE IF EXISTS public.partenaires              CASCADE;
--   DROP TABLE IF EXISTS public.affaire_motifs_archivage CASCADE;
--
-- Impact du rollback :
--   Supprime les quatre tables de paramétrage et leurs seeds. Aucune autre table
--   n'est modifiée. À n'exécuter que si aucune migration 023+ ne référence encore
--   ces tables (sinon retirer d'abord les dépendances).
--
-- =============================================================================
-- FICHIERS MODIFIÉS
-- =============================================================================
-- + supabase/migrations/022_affaires_parametrage_core.sql  (ce fichier — nouveau)
--
-- Aucun fichier applicatif (lib/, app/, components/) modifié. Aucune table
-- d'instance du module Affaires créée à ce stade.
-- =============================================================================
