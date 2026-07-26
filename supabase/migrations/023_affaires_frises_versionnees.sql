-- =============================================================================
-- Migration 023 : Module Affaires — Modèles de frises réglementaires versionnés
-- Dépend de   : 001 (set_updated_at, get_user_role), 021 (schema private,
--               peut_parametrer_affaires), 022 (affaire_familles, affaire_types)
-- Idempotente : CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP TRIGGER/POLICY IF EXISTS avant (re)création, REVOKE/GRANT.
-- =============================================================================
--
-- Périmètre STRICT : six tables — frise_versions, frise_etapes_modele,
--   frise_taches_modele, frise_documents_modele, frise_controles_modele,
--   affaire_champ_defs — plus les fonctions/triggers d'immuabilité (schema
--   private) et les RPC contrôlées de publication/archivage (schema public).
--   Aucun seed de frise. Aucune table d'instance d'affaire.
--
-- Robustesse : PK via pg_catalog.gen_random_uuid() (aucune dépendance au
-- search_path) ; fonctions schéma-qualifiées (public.*, auth.*, private.*).
--
-- Modèle hybride (cf. conception) : une version de frise est immuable une fois
-- publiée ; les affaires instancieront des étapes propres (migration 024+).
--
-- Immuabilité :
--   - version 'brouillon' : INSERT/UPDATE/DELETE autorisés (droits paramétrage) ;
--   - version 'publie'/'archive' : structure figée (aucune modif de la version
--     ni de ses tables enfants), enforced par triggers private.fn_guard_frise_*;
--   - transitions de statut/activation réservées aux RPC contrôlées
--     public.fn_frise_publier / public.fn_frise_archiver (marqueur app.frise_ctx).
--   Le marqueur app.frise_ctx est un aiguillage interne (comme migration 021) :
--   les garanties DURES (structure figée, unicité de la version active) reposent
--   sur les vérifications d'invariants et l'index unique partiel, indépendamment
--   du marqueur.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 23a. TABLE : frise_versions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.frise_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  famille_id     UUID        NOT NULL,
  version        TEXT        NOT NULL,
  statut         TEXT        NOT NULL DEFAULT 'brouillon',
  actif          BOOLEAN     NOT NULL DEFAULT FALSE,
  version_schema VARCHAR(10) NOT NULL DEFAULT '1.0',
  publie_par     UUID,
  publie_le      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_fv_famille
    FOREIGN KEY (famille_id) REFERENCES public.affaire_familles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fv_publie_par
    FOREIGN KEY (publie_par) REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT chk_fv_statut CHECK (statut IN ('brouillon','publie','archive')),
  -- Une version active est nécessairement publiée.
  CONSTRAINT chk_fv_actif_publie CHECK (actif = FALSE OR statut = 'publie'),

  CONSTRAINT uq_fv_famille_version UNIQUE (famille_id, version),
  -- Cible des FK composites du module (une version appartient à une famille).
  CONSTRAINT uq_fv_id_famille UNIQUE (id, famille_id)
);

-- Une seule version ACTIVE par famille.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fv_active_par_famille
  ON public.frise_versions (famille_id) WHERE actif;

-- Lecture des versions d'une famille par statut.
CREATE INDEX IF NOT EXISTS idx_fv_famille_statut
  ON public.frise_versions (famille_id, statut);

DROP TRIGGER IF EXISTS trg_fv_updated_at ON public.frise_versions;
CREATE TRIGGER trg_fv_updated_at
  BEFORE UPDATE ON public.frise_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 23b. TABLE : frise_etapes_modele
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.frise_etapes_modele (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  frise_version_id      UUID        NOT NULL,
  code                  TEXT        NOT NULL,
  libelle               TEXT        NOT NULL,
  description           TEXT,
  instructions          TEXT,
  ordre                 INTEGER     NOT NULL DEFAULT 0,
  delai_indicatif_jours INTEGER,
  validation_manuelle   BOOLEAN     NOT NULL DEFAULT TRUE,
  conditions_blocage    JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_fem_version
    FOREIGN KEY (frise_version_id) REFERENCES public.frise_versions (id) ON DELETE CASCADE,

  CONSTRAINT chk_fem_ordre CHECK (ordre >= 0),
  CONSTRAINT chk_fem_delai CHECK (delai_indicatif_jours IS NULL OR delai_indicatif_jours >= 0),

  CONSTRAINT uq_fem_version_code  UNIQUE (frise_version_id, code),
  CONSTRAINT uq_fem_version_ordre UNIQUE (frise_version_id, ordre),
  -- Cible des FK composites des tables enfants (étape ↔ version cohérentes).
  CONSTRAINT uq_fem_id_version    UNIQUE (id, frise_version_id)
);

DROP TRIGGER IF EXISTS trg_fem_updated_at ON public.frise_etapes_modele;
CREATE TRIGGER trg_fem_updated_at
  BEFORE UPDATE ON public.frise_etapes_modele
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 23c. TABLES ENFANTS : tâches / documents / contrôles modèles
-- Cohérence (etape_modele_id, frise_version_id) garantie par FK composite.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.frise_taches_modele (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  etape_modele_id  UUID        NOT NULL,
  frise_version_id UUID        NOT NULL,
  code             TEXT        NOT NULL,
  libelle          TEXT        NOT NULL,
  obligatoire      BOOLEAN     NOT NULL DEFAULT TRUE,
  ordre            INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_ftm_etape
    FOREIGN KEY (etape_modele_id, frise_version_id)
    REFERENCES public.frise_etapes_modele (id, frise_version_id) ON DELETE CASCADE,
  CONSTRAINT chk_ftm_ordre CHECK (ordre >= 0),
  CONSTRAINT uq_ftm_etape_code UNIQUE (etape_modele_id, code)
);

CREATE TABLE IF NOT EXISTS public.frise_documents_modele (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  etape_modele_id  UUID        NOT NULL,
  frise_version_id UUID        NOT NULL,
  code             TEXT        NOT NULL,
  libelle          TEXT        NOT NULL,
  type_document    TEXT,
  obligatoire      BOOLEAN     NOT NULL DEFAULT TRUE,
  ordre            INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_fdm_etape
    FOREIGN KEY (etape_modele_id, frise_version_id)
    REFERENCES public.frise_etapes_modele (id, frise_version_id) ON DELETE CASCADE,
  CONSTRAINT chk_fdm_ordre CHECK (ordre >= 0),
  CONSTRAINT uq_fdm_etape_code UNIQUE (etape_modele_id, code)
);

CREATE TABLE IF NOT EXISTS public.frise_controles_modele (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  etape_modele_id  UUID        NOT NULL,
  frise_version_id UUID        NOT NULL,
  code             TEXT        NOT NULL,
  libelle          TEXT        NOT NULL,
  type_controle    TEXT,
  obligatoire      BOOLEAN     NOT NULL DEFAULT TRUE,
  ordre            INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_fcm_etape
    FOREIGN KEY (etape_modele_id, frise_version_id)
    REFERENCES public.frise_etapes_modele (id, frise_version_id) ON DELETE CASCADE,
  CONSTRAINT chk_fcm_ordre CHECK (ordre >= 0),
  CONSTRAINT uq_fcm_etape_code UNIQUE (etape_modele_id, code)
);

DROP TRIGGER IF EXISTS trg_ftm_updated_at ON public.frise_taches_modele;
CREATE TRIGGER trg_ftm_updated_at BEFORE UPDATE ON public.frise_taches_modele
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_fdm_updated_at ON public.frise_documents_modele;
CREATE TRIGGER trg_fdm_updated_at BEFORE UPDATE ON public.frise_documents_modele
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_fcm_updated_at ON public.frise_controles_modele;
CREATE TRIGGER trg_fcm_updated_at BEFORE UPDATE ON public.frise_controles_modele
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ftm_etape ON public.frise_taches_modele (etape_modele_id);
CREATE INDEX IF NOT EXISTS idx_fdm_etape ON public.frise_documents_modele (etape_modele_id);
CREATE INDEX IF NOT EXISTS idx_fcm_etape ON public.frise_controles_modele (etape_modele_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 23d. TABLE : affaire_champ_defs (champs dynamiques versionnés)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_champ_defs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  famille_id        UUID        NOT NULL,
  frise_version_id  UUID        NOT NULL,
  portee            TEXT        NOT NULL,
  type_id           UUID,
  code              TEXT        NOT NULL,
  libelle           TEXT        NOT NULL,
  type_donnee       TEXT        NOT NULL,
  obligatoire       BOOLEAN     NOT NULL DEFAULT FALSE,
  ordre             INTEGER     NOT NULL DEFAULT 0,
  regles_validation JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- La version appartient à la famille déclarée.
  CONSTRAINT fk_acd_version
    FOREIGN KEY (frise_version_id, famille_id)
    REFERENCES public.frise_versions (id, famille_id) ON DELETE CASCADE,
  -- Un champ de portée 'type' référence un type de la MÊME famille.
  CONSTRAINT fk_acd_type
    FOREIGN KEY (type_id, famille_id)
    REFERENCES public.affaire_types (id, famille_id) ON DELETE RESTRICT,

  CONSTRAINT chk_acd_portee CHECK (portee IN ('famille','type')),
  CONSTRAINT chk_acd_type_donnee
    CHECK (type_donnee IN ('texte','nombre','montant','booleen','date','enum')),
  CONSTRAINT chk_acd_ordre CHECK (ordre >= 0),
  -- Portée 'famille' → pas de type_id ; portée 'type' → type_id obligatoire.
  CONSTRAINT chk_acd_portee_type CHECK (
    (portee = 'famille' AND type_id IS NULL)
    OR (portee = 'type' AND type_id IS NOT NULL)
  )
);

-- Unicité du code par version, distincte selon la portée (index partiels).
CREATE UNIQUE INDEX IF NOT EXISTS uq_acd_famille_code
  ON public.affaire_champ_defs (frise_version_id, code) WHERE portee = 'famille';
CREATE UNIQUE INDEX IF NOT EXISTS uq_acd_type_code
  ON public.affaire_champ_defs (frise_version_id, type_id, code) WHERE portee = 'type';

DROP TRIGGER IF EXISTS trg_acd_updated_at ON public.affaire_champ_defs;
CREATE TRIGGER trg_acd_updated_at
  BEFORE UPDATE ON public.affaire_champ_defs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 23e. IMMUABILITÉ — fonctions internes (schema private) + triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- Statut de la version (lecture DEFINER, contourne le RLS de façon fiable).
CREATE OR REPLACE FUNCTION private.fn_frise_version_statut(p_version_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT statut FROM public.frise_versions WHERE id = p_version_id;
$$;
REVOKE ALL ON FUNCTION private.fn_frise_version_statut(UUID) FROM PUBLIC, anon, authenticated;

-- Garde des tables ENFANTS : structure figée si la version n'est pas 'brouillon'.
CREATE OR REPLACE FUNCTION private.fn_guard_frise_child()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_vid UUID; v_statut TEXT;
BEGIN
  v_vid := COALESCE(NEW.frise_version_id, OLD.frise_version_id);
  v_statut := private.fn_frise_version_statut(v_vid);
  IF v_statut IS DISTINCT FROM 'brouillon' THEN
    RAISE EXCEPTION
      'Structure de frise figee : la version % est au statut % — insertion/modification/suppression interdite.',
      v_vid, COALESCE(v_statut, 'inexistant')
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_guard_frise_child() FROM PUBLIC, anon, authenticated;

-- Garde de frise_versions : transitions via RPC uniquement, structure figée après publication.
CREATE OR REPLACE FUNCTION private.fn_guard_frise_version()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut <> 'brouillon' THEN
      RAISE EXCEPTION 'frise_versions : suppression interdite (version % au statut %).', OLD.id, OLD.statut
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- Transitions (statut / actif / publication) réservées aux RPC contrôlées.
  IF ( NEW.statut     IS DISTINCT FROM OLD.statut
    OR NEW.actif      IS DISTINCT FROM OLD.actif
    OR NEW.publie_par IS DISTINCT FROM OLD.publie_par
    OR NEW.publie_le  IS DISTINCT FROM OLD.publie_le )
    AND COALESCE(current_setting('app.frise_ctx', true), '') = '' THEN
    RAISE EXCEPTION
      'frise_versions : transition (statut/activation/publication) reservee aux fonctions fn_frise_publier / fn_frise_archiver.'
      USING ERRCODE = '42501';
  END IF;

  -- Version archivee : terminale, immuable.
  IF OLD.statut = 'archive' THEN
    RAISE EXCEPTION 'frise_versions : version archivee, immuable (%).' , OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- Version publiee : structure figee ; seule la transition publie -> archive est possible.
  IF OLD.statut = 'publie' THEN
    IF NEW.id             IS DISTINCT FROM OLD.id
    OR NEW.famille_id     IS DISTINCT FROM OLD.famille_id
    OR NEW.version        IS DISTINCT FROM OLD.version
    OR NEW.version_schema IS DISTINCT FROM OLD.version_schema
    OR NEW.created_at     IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'frise_versions : version publiee, structure figee (%).', OLD.id
        USING ERRCODE = '42501';
    END IF;
    IF NEW.statut NOT IN ('publie','archive') THEN
      RAISE EXCEPTION 'frise_versions : transition de statut non autorisee depuis publie.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_guard_frise_version() FROM PUBLIC, anon, authenticated;

-- Attache des triggers de garde.
DROP TRIGGER IF EXISTS trg_guard_frise_version ON public.frise_versions;
CREATE TRIGGER trg_guard_frise_version
  BEFORE UPDATE OR DELETE ON public.frise_versions
  FOR EACH ROW EXECUTE FUNCTION private.fn_guard_frise_version();

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'frise_etapes_modele','frise_taches_modele','frise_documents_modele',
    'frise_controles_modele','affaire_champ_defs'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_frise_child ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_guard_frise_child BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION private.fn_guard_frise_child();', t);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 23f. RPC CONTRÔLÉES : publication / archivage (schema public)
-- SECURITY DEFINER + re-vérification identité/rôle/permission (règles 021).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_frise_publier(p_version_id UUID)
RETURNS public.frise_versions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.frise_versions;
BEGIN
  -- public.peut_parametrer_affaires() vérifie déjà : utilisateur existant (auth.uid()),
  -- rôle conseiller ET permission. Elle s'auto-qualifie (search_path propre) : aucune
  -- dépendance à public.get_user_role() dont le search_path n'est pas sécurisé.
  IF public.peut_parametrer_affaires() <> TRUE THEN
    RAISE EXCEPTION 'Permission de parametrage requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.frise_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version de frise introuvable: %', p_version_id USING ERRCODE = 'P0002';
  END IF;
  IF v_row.statut <> 'brouillon' THEN
    RAISE EXCEPTION 'Seule une version en brouillon peut etre publiee (statut actuel: %).', v_row.statut
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.frise_ctx', 'publier', true);

  -- Desactive l'eventuelle version active de la meme famille.
  UPDATE public.frise_versions
     SET actif = FALSE
   WHERE famille_id = v_row.famille_id AND actif = TRUE AND id <> p_version_id;

  -- Publie la version cible et l'active.
  UPDATE public.frise_versions
     SET statut = 'publie', actif = TRUE, publie_par = auth.uid(), publie_le = now()
   WHERE id = p_version_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_frise_publier(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_frise_publier(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_frise_archiver(p_version_id UUID)
RETURNS public.frise_versions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.frise_versions;
BEGIN
  -- public.peut_parametrer_affaires() vérifie déjà : utilisateur existant (auth.uid()),
  -- rôle conseiller ET permission. Elle s'auto-qualifie (search_path propre) : aucune
  -- dépendance à public.get_user_role() dont le search_path n'est pas sécurisé.
  IF public.peut_parametrer_affaires() <> TRUE THEN
    RAISE EXCEPTION 'Permission de parametrage requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.frise_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version de frise introuvable: %', p_version_id USING ERRCODE = 'P0002';
  END IF;
  IF v_row.statut = 'archive' THEN
    RAISE EXCEPTION 'Version deja archivee.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.frise_ctx', 'archiver', true);

  UPDATE public.frise_versions
     SET statut = 'archive', actif = FALSE
   WHERE id = p_version_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_frise_archiver(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_frise_archiver(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 23g. PRIVILÈGES DE TABLE (aucun accès anon ; authenticated filtré par RLS)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'public.frise_versions','public.frise_etapes_modele','public.frise_taches_modele',
    'public.frise_documents_modele','public.frise_controles_modele','public.affaire_champ_defs'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO authenticated;', t);
    EXECUTE format('GRANT ALL ON TABLE %s TO service_role;', t);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 23h. ROW LEVEL SECURITY
-- SELECT : conseillers. INSERT/UPDATE/DELETE : conseillers + peut_parametrer_affaires().
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'frise_versions','frise_etapes_modele','frise_taches_modele',
    'frise_documents_modele','frise_controles_modele','affaire_champ_defs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select_conseiller" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_select_conseiller" ON public.%1$I
        FOR SELECT TO authenticated
        USING (public.get_user_role() = 'conseiller');
    $p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_param" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_insert_param" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (public.get_user_role() = 'conseiller' AND public.peut_parametrer_affaires() = TRUE);
    $p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_update_param" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_update_param" ON public.%1$I
        FOR UPDATE TO authenticated
        USING      (public.get_user_role() = 'conseiller' AND public.peut_parametrer_affaires() = TRUE)
        WITH CHECK (public.get_user_role() = 'conseiller' AND public.peut_parametrer_affaires() = TRUE);
    $p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_param" ON public.%I;', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_delete_param" ON public.%1$I
        FOR DELETE TO authenticated
        USING (public.get_user_role() = 'conseiller' AND public.peut_parametrer_affaires() = TRUE);
    $p$, t);
  END LOOP;
END $$;


-- =============================================================================
-- PLAN DE ROLLBACK  (manuel — non exécuté ici)
-- =============================================================================
--   DROP FUNCTION IF EXISTS public.fn_frise_publier(UUID);
--   DROP FUNCTION IF EXISTS public.fn_frise_archiver(UUID);
--   DROP TABLE IF EXISTS public.affaire_champ_defs        CASCADE;
--   DROP TABLE IF EXISTS public.frise_controles_modele    CASCADE;
--   DROP TABLE IF EXISTS public.frise_documents_modele    CASCADE;
--   DROP TABLE IF EXISTS public.frise_taches_modele       CASCADE;
--   DROP TABLE IF EXISTS public.frise_etapes_modele       CASCADE;
--   DROP TABLE IF EXISTS public.frise_versions            CASCADE;
--   DROP FUNCTION IF EXISTS private.fn_guard_frise_version();
--   DROP FUNCTION IF EXISTS private.fn_guard_frise_child();
--   DROP FUNCTION IF EXISTS private.fn_frise_version_statut(UUID);
--
-- =============================================================================
-- FICHIERS MODIFIÉS
-- =============================================================================
-- + supabase/migrations/023_affaires_frises_versionnees.sql  (ce fichier — nouveau)
-- =============================================================================
