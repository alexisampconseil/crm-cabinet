-- =============================================================================
-- Migration 024 : Module Affaires — Socle d'exécution (runtime core)
-- Dépend de   : 001 (set_updated_at, clients, auth.users), 021 (schema private),
--               022 (affaire_familles/types/partenaires/motifs),
--               023 (frise_versions + modèles d'étapes/tâches/documents/contrôles,
--                    affaire_champ_defs)
-- Idempotente : CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP TRIGGER/POLICY IF EXISTS avant (re)création, REVOKE/GRANT.
-- =============================================================================
--
-- Périmètre STRICT : 7 tables d'exécution — affaires, affaire_etapes,
--   affaire_taches, affaire_documents, affaire_controles, affaire_champ_valeurs,
--   affaire_blocages — avec contraintes (dont FK composites d'appartenance),
--   index, triggers updated_at (+ version_row sur affaires), RLS et privilèges.
--   AUCUNE RPC métier, AUCUN seed, AUCUNE affaire persistante.
--
-- Sécurité : tables d'exécution. authenticated = LECTURE conseiller uniquement ;
--   aucun INSERT/UPDATE/DELETE direct (mutations via futures RPC SECURITY DEFINER).
--   anon : aucun accès. service_role : accès complet.
--
-- Robustesse : PK via pg_catalog.gen_random_uuid() ; fonctions qualifiées.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 24a. TABLE : affaires
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaires (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID          NOT NULL,
  famille_id            UUID          NOT NULL,
  type_id               UUID          NOT NULL,
  frise_version_id      UUID          NOT NULL,
  produit_id            UUID,
  partenaire_id         UUID,
  libelle               TEXT          NOT NULL,
  montant               NUMERIC(15,2),
  frais                 NUMERIC(15,2),
  revenu_previsionnel   NUMERIC(15,2),
  revenu_realise        NUMERIC(15,2),
  statut                TEXT          NOT NULL DEFAULT 'en_cours',
  motif_archivage_id    UUID,
  commentaire_archivage TEXT,
  date_ouverture        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  date_cloture          TIMESTAMPTZ,
  date_archivage        TIMESTAMPTZ,
  version_row           BIGINT        NOT NULL DEFAULT 1,
  created_by            UUID,
  updated_by            UUID,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT fk_aff_client     FOREIGN KEY (client_id)  REFERENCES public.clients (id)           ON DELETE RESTRICT,
  CONSTRAINT fk_aff_famille    FOREIGN KEY (famille_id) REFERENCES public.affaire_familles (id)  ON DELETE RESTRICT,
  -- Le type appartient à la famille (FK composite).
  CONSTRAINT fk_aff_type       FOREIGN KEY (type_id, famille_id)
    REFERENCES public.affaire_types (id, famille_id) ON DELETE RESTRICT,
  -- La version de frise appartient à la famille et reste référençable durablement.
  CONSTRAINT fk_aff_frise      FOREIGN KEY (frise_version_id, famille_id)
    REFERENCES public.frise_versions (id, famille_id) ON DELETE RESTRICT,
  CONSTRAINT fk_aff_produit    FOREIGN KEY (produit_id)    REFERENCES public.produits (id)    ON DELETE RESTRICT,
  CONSTRAINT fk_aff_partenaire FOREIGN KEY (partenaire_id) REFERENCES public.partenaires (id) ON DELETE RESTRICT,
  CONSTRAINT fk_aff_motif      FOREIGN KEY (motif_archivage_id)
    REFERENCES public.affaire_motifs_archivage (id) ON DELETE RESTRICT,
  CONSTRAINT fk_aff_created_by FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT fk_aff_updated_by FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL,

  -- Cible d'appartenance pour les tables d'instances enfants (FK composites).
  CONSTRAINT uq_aff_id_client UNIQUE (id, client_id),

  CONSTRAINT chk_aff_statut CHECK (statut IN ('en_cours','terminee','archivee')),
  -- Motif d'archivage obligatoire ssi archivée ; interdit sinon.
  CONSTRAINT chk_aff_archivage CHECK (
    (statut = 'archivee' AND motif_archivage_id IS NOT NULL)
    OR (statut <> 'archivee' AND motif_archivage_id IS NULL)
  ),
  CONSTRAINT chk_aff_montant  CHECK (montant             IS NULL OR montant             >= 0),
  CONSTRAINT chk_aff_frais    CHECK (frais               IS NULL OR frais               >= 0),
  CONSTRAINT chk_aff_rev_prev CHECK (revenu_previsionnel IS NULL OR revenu_previsionnel >= 0),
  CONSTRAINT chk_aff_rev_real CHECK (revenu_realise      IS NULL OR revenu_realise      >= 0)
);

CREATE INDEX IF NOT EXISTS idx_aff_client_statut ON public.affaires (client_id, statut);
CREATE INDEX IF NOT EXISTS idx_aff_statut        ON public.affaires (statut);
CREATE INDEX IF NOT EXISTS idx_aff_famille       ON public.affaires (famille_id);
CREATE INDEX IF NOT EXISTS idx_aff_type          ON public.affaires (type_id);
CREATE INDEX IF NOT EXISTS idx_aff_produit       ON public.affaires (produit_id)    WHERE produit_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aff_partenaire    ON public.affaires (partenaire_id) WHERE partenaire_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aff_date_ouv      ON public.affaires (date_ouverture);
CREATE INDEX IF NOT EXISTS idx_aff_date_clo      ON public.affaires (date_cloture)  WHERE date_cloture  IS NOT NULL;

-- version_row : incrément sur modification réelle (avant set_updated_at).
CREATE OR REPLACE FUNCTION private.fn_affaire_bump_version()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD IS DISTINCT FROM NEW THEN
    NEW.version_row := OLD.version_row + 1;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_affaire_bump_version() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_aff_bump_version ON public.affaires;   -- 'b' < 'u' : s'exécute avant updated_at
CREATE TRIGGER trg_aff_bump_version
  BEFORE UPDATE ON public.affaires
  FOR EACH ROW EXECUTE FUNCTION private.fn_affaire_bump_version();

DROP TRIGGER IF EXISTS trg_aff_updated_at ON public.affaires;
CREATE TRIGGER trg_aff_updated_at
  BEFORE UPDATE ON public.affaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 24b. TABLE : affaire_etapes (copie figée du modèle)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_etapes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id            UUID        NOT NULL,
  etape_modele_id       UUID,
  code                  TEXT        NOT NULL,
  libelle               TEXT        NOT NULL,
  description           TEXT,
  instructions          TEXT,
  ordre                 INTEGER     NOT NULL DEFAULT 0,
  delai_indicatif_jours INTEGER,
  validation_manuelle   BOOLEAN     NOT NULL DEFAULT TRUE,
  conditions_blocage    JSONB       NOT NULL DEFAULT '{}',
  statut                TEXT        NOT NULL DEFAULT 'a_faire',
  date_debut            TIMESTAMPTZ,
  date_fin              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_ae_affaire FOREIGN KEY (affaire_id) REFERENCES public.affaires (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ae_modele  FOREIGN KEY (etape_modele_id)
    REFERENCES public.frise_etapes_modele (id) ON DELETE SET NULL,
  CONSTRAINT chk_ae_statut CHECK (statut IN ('a_faire','en_cours','terminee','ignoree')),
  CONSTRAINT chk_ae_ordre  CHECK (ordre >= 0),
  CONSTRAINT uq_ae_affaire_code  UNIQUE (affaire_id, code),
  CONSTRAINT uq_ae_affaire_ordre UNIQUE (affaire_id, ordre),
  -- Cible d'appartenance : un enfant ne peut être rattaché qu'à une étape de SON affaire.
  CONSTRAINT uq_ae_id_affaire    UNIQUE (id, affaire_id)
);

CREATE INDEX IF NOT EXISTS idx_ae_affaire ON public.affaire_etapes (affaire_id, ordre);

DROP TRIGGER IF EXISTS trg_ae_updated_at ON public.affaire_etapes;
CREATE TRIGGER trg_ae_updated_at BEFORE UPDATE ON public.affaire_etapes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 24c. TABLES : affaire_taches / affaire_documents / affaire_controles
-- FK composite (etape_id, affaire_id) -> affaire_etapes(id, affaire_id) :
-- garantit qu'un enfant appartient à une étape de la même affaire.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_taches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id      UUID        NOT NULL,
  etape_id        UUID        NOT NULL,
  tache_modele_id UUID,
  code            TEXT        NOT NULL,
  libelle         TEXT        NOT NULL,
  obligatoire     BOOLEAN     NOT NULL DEFAULT TRUE,
  ordre           INTEGER     NOT NULL DEFAULT 0,
  statut          TEXT        NOT NULL DEFAULT 'a_faire',
  date_debut      TIMESTAMPTZ,
  date_fin        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_at_affaire FOREIGN KEY (affaire_id) REFERENCES public.affaires (id) ON DELETE RESTRICT,
  CONSTRAINT fk_at_etape   FOREIGN KEY (etape_id, affaire_id)
    REFERENCES public.affaire_etapes (id, affaire_id) ON DELETE RESTRICT,
  CONSTRAINT fk_at_modele  FOREIGN KEY (tache_modele_id)
    REFERENCES public.frise_taches_modele (id) ON DELETE SET NULL,
  CONSTRAINT chk_at_statut CHECK (statut IN ('a_faire','en_cours','terminee','ignoree')),
  CONSTRAINT chk_at_ordre  CHECK (ordre >= 0),
  CONSTRAINT uq_at_etape_code UNIQUE (etape_id, code)
);

CREATE TABLE IF NOT EXISTS public.affaire_documents (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id         UUID        NOT NULL,
  etape_id           UUID        NOT NULL,
  document_modele_id UUID,
  code               TEXT        NOT NULL,
  libelle            TEXT        NOT NULL,
  type_document      TEXT,
  obligatoire        BOOLEAN     NOT NULL DEFAULT TRUE,
  ordre              INTEGER     NOT NULL DEFAULT 0,
  statut             TEXT        NOT NULL DEFAULT 'attendu',
  date_depot         TIMESTAMPTZ,
  date_decision      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_ad_affaire FOREIGN KEY (affaire_id) REFERENCES public.affaires (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ad_etape   FOREIGN KEY (etape_id, affaire_id)
    REFERENCES public.affaire_etapes (id, affaire_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ad_modele  FOREIGN KEY (document_modele_id)
    REFERENCES public.frise_documents_modele (id) ON DELETE SET NULL,
  CONSTRAINT chk_ad_statut CHECK (statut IN ('attendu','depose','valide','refuse','non_requis')),
  CONSTRAINT chk_ad_ordre  CHECK (ordre >= 0),
  CONSTRAINT uq_ad_etape_code UNIQUE (etape_id, code)
);

CREATE TABLE IF NOT EXISTS public.affaire_controles (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id         UUID        NOT NULL,
  etape_id           UUID        NOT NULL,
  controle_modele_id UUID,
  code               TEXT        NOT NULL,
  libelle            TEXT        NOT NULL,
  type_controle      TEXT,
  obligatoire        BOOLEAN     NOT NULL DEFAULT TRUE,
  ordre              INTEGER     NOT NULL DEFAULT 0,
  statut             TEXT        NOT NULL DEFAULT 'a_controler',
  date_controle      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_ac_affaire FOREIGN KEY (affaire_id) REFERENCES public.affaires (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ac_etape   FOREIGN KEY (etape_id, affaire_id)
    REFERENCES public.affaire_etapes (id, affaire_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ac_modele  FOREIGN KEY (controle_modele_id)
    REFERENCES public.frise_controles_modele (id) ON DELETE SET NULL,
  CONSTRAINT chk_ac_statut CHECK (statut IN ('a_controler','conforme','non_conforme','deroge')),
  CONSTRAINT chk_ac_ordre  CHECK (ordre >= 0),
  CONSTRAINT uq_ac_etape_code UNIQUE (etape_id, code)
);

CREATE INDEX IF NOT EXISTS idx_at_affaire ON public.affaire_taches    (affaire_id);
CREATE INDEX IF NOT EXISTS idx_at_etape   ON public.affaire_taches    (etape_id);
CREATE INDEX IF NOT EXISTS idx_ad_affaire ON public.affaire_documents (affaire_id);
CREATE INDEX IF NOT EXISTS idx_ad_etape   ON public.affaire_documents (etape_id);
CREATE INDEX IF NOT EXISTS idx_ac_affaire ON public.affaire_controles (affaire_id);
CREATE INDEX IF NOT EXISTS idx_ac_etape   ON public.affaire_controles (etape_id);

DROP TRIGGER IF EXISTS trg_at_updated_at ON public.affaire_taches;
CREATE TRIGGER trg_at_updated_at BEFORE UPDATE ON public.affaire_taches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_ad_updated_at ON public.affaire_documents;
CREATE TRIGGER trg_ad_updated_at BEFORE UPDATE ON public.affaire_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_ac_updated_at ON public.affaire_controles;
CREATE TRIGGER trg_ac_updated_at BEFORE UPDATE ON public.affaire_controles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 24d. TABLE : affaire_champ_valeurs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_champ_valeurs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id   UUID        NOT NULL,
  champ_def_id UUID        NOT NULL,
  valeur       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_acv_affaire   FOREIGN KEY (affaire_id)   REFERENCES public.affaires (id)          ON DELETE RESTRICT,
  CONSTRAINT fk_acv_champ_def FOREIGN KEY (champ_def_id) REFERENCES public.affaire_champ_defs (id) ON DELETE RESTRICT,
  -- Une seule valeur par affaire et définition de champ.
  CONSTRAINT uq_acv_affaire_champ UNIQUE (affaire_id, champ_def_id)
);

CREATE INDEX IF NOT EXISTS idx_acv_affaire ON public.affaire_champ_valeurs (affaire_id);

DROP TRIGGER IF EXISTS trg_acv_updated_at ON public.affaire_champ_valeurs;
CREATE TRIGGER trg_acv_updated_at BEFORE UPDATE ON public.affaire_champ_valeurs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 24e. TABLE : affaire_blocages
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_blocages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id       UUID        NOT NULL,
  etape_id         UUID,
  code             TEXT        NOT NULL,
  libelle          TEXT        NOT NULL,
  description      TEXT,
  actif            BOOLEAN     NOT NULL DEFAULT TRUE,
  deroge           BOOLEAN     NOT NULL DEFAULT FALSE,
  motif_derogation TEXT,
  deroge_par       UUID,
  deroge_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_ab_affaire FOREIGN KEY (affaire_id) REFERENCES public.affaires (id) ON DELETE RESTRICT,
  -- Étape éventuelle : doit appartenir à la même affaire (composite ; NULL toléré).
  CONSTRAINT fk_ab_etape   FOREIGN KEY (etape_id, affaire_id)
    REFERENCES public.affaire_etapes (id, affaire_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ab_deroge_par FOREIGN KEY (deroge_par) REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Une dérogation exige motif + auteur + date ; une non-dérogation n'en porte aucune.
  CONSTRAINT chk_ab_derogation CHECK (
    (deroge = TRUE  AND motif_derogation IS NOT NULL AND deroge_par IS NOT NULL AND deroge_at IS NOT NULL)
    OR
    (deroge = FALSE AND motif_derogation IS NULL     AND deroge_par IS NULL     AND deroge_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ab_affaire_actif ON public.affaire_blocages (affaire_id) WHERE actif;
CREATE INDEX IF NOT EXISTS idx_ab_etape         ON public.affaire_blocages (etape_id)   WHERE etape_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_ab_updated_at ON public.affaire_blocages;
CREATE TRIGGER trg_ab_updated_at BEFORE UPDATE ON public.affaire_blocages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 24f. PRIVILÈGES + RLS (lecture conseiller ; aucune écriture directe)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'affaires','affaire_etapes','affaire_taches','affaire_documents',
    'affaire_controles','affaire_champ_valeurs','affaire_blocages'
  ] LOOP
    -- Privilèges : lecture seule pour authenticated ; rien pour anon/PUBLIC ; tout pour service_role.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon;', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', t);

    -- RLS : SELECT conseiller uniquement ; aucune policy d'écriture (mutations via RPC futures).
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_conseiller" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_select_conseiller" ON public.%1$I
        FOR SELECT TO authenticated
        USING (public.get_user_role() = 'conseiller');
    $p$, t);
  END LOOP;
END $$;


-- =============================================================================
-- PLAN DE ROLLBACK  (manuel — non exécuté ici ; ordre inverse des dépendances)
-- =============================================================================
--   DROP TABLE IF EXISTS public.affaire_blocages      CASCADE;
--   DROP TABLE IF EXISTS public.affaire_champ_valeurs CASCADE;
--   DROP TABLE IF EXISTS public.affaire_controles     CASCADE;
--   DROP TABLE IF EXISTS public.affaire_documents     CASCADE;
--   DROP TABLE IF EXISTS public.affaire_taches        CASCADE;
--   DROP TABLE IF EXISTS public.affaire_etapes        CASCADE;
--   DROP TABLE IF EXISTS public.affaires              CASCADE;
--   DROP FUNCTION IF EXISTS private.fn_affaire_bump_version();
--
-- =============================================================================
-- FICHIERS MODIFIÉS
-- =============================================================================
-- + supabase/migrations/024_affaires_runtime_core.sql  (ce fichier — nouveau)
-- =============================================================================
