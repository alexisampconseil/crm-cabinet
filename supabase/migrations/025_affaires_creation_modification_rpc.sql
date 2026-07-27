-- =============================================================================
-- Migration 025 : Module Affaires — RPC de création et modification
-- Dépend de   : 021 (schema private), 022 (familles/types/partenaires),
--               023 (frise_versions + modèles + affaire_champ_defs),
--               024 (affaires + tables d'instances)
-- Idempotente : CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables.
-- =============================================================================
--
-- Périmètre STRICT : deux RPC publiques (création, modification d'infos) + un
--   petit helper interne de contrôle de rôle. Aucune table, aucun changement de
--   statut, aucune clôture/archive/avancement.
--
-- Sécurité : SECURITY DEFINER, search_path = '' (tous objets qualifiés), EXECUTE
--   réservé à authenticated + service_role (révoqué pour PUBLIC/anon). Le contrôle
--   d'accès est un simple « rôle conseiller » lu directement dans public.user_roles
--   (PAS public.get_user_role() — non sécurisé côté search_path ; PAS
--   peut_parametrer_affaires() — réservée au paramétrage).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 25a. HELPER INTERNE : exiger le rôle conseiller
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.fn_affaire_exige_conseiller()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'conseiller'
  ) THEN
    RAISE EXCEPTION 'Acces reserve aux conseillers.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_affaire_exige_conseiller() FROM PUBLIC, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 25b. RPC : création d'une affaire (+ instanciation de la frise active publiée)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_creer(
  p_client_id            UUID,
  p_famille_id           UUID,
  p_type_id              UUID,
  p_libelle              TEXT,
  p_montant              NUMERIC DEFAULT NULL,
  p_frais                NUMERIC DEFAULT NULL,
  p_revenu_previsionnel  NUMERIC DEFAULT NULL,
  p_produit_id           UUID    DEFAULT NULL,
  p_partenaire_id        UUID    DEFAULT NULL
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_famille_actif BOOLEAN;
  v_frise         UUID;
  v_affaire       UUID;
BEGIN
  PERFORM private.fn_affaire_exige_conseiller();

  -- Validations d'entrée
  IF coalesce(btrim(p_libelle), '') = '' THEN
    RAISE EXCEPTION 'Le libelle est obligatoire.' USING ERRCODE = 'P0001';
  END IF;
  IF (p_montant IS NOT NULL AND p_montant < 0)
     OR (p_frais IS NOT NULL AND p_frais < 0)
     OR (p_revenu_previsionnel IS NOT NULL AND p_revenu_previsionnel < 0) THEN
    RAISE EXCEPTION 'Les montants ne peuvent pas etre negatifs.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Client introuvable: %', p_client_id USING ERRCODE = 'P0002';
  END IF;

  SELECT actif INTO v_famille_actif FROM public.affaire_familles WHERE id = p_famille_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Famille introuvable: %', p_famille_id USING ERRCODE = 'P0002';
  END IF;
  IF v_famille_actif IS NOT TRUE THEN
    RAISE EXCEPTION 'Famille inactive: %', p_famille_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.affaire_types
    WHERE id = p_type_id AND famille_id = p_famille_id AND actif = TRUE
  ) THEN
    RAISE EXCEPTION 'Type introuvable, inactif, ou hors de la famille: %', p_type_id USING ERRCODE = 'P0001';
  END IF;

  IF p_produit_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.produits WHERE id = p_produit_id) THEN
    RAISE EXCEPTION 'Produit introuvable: %', p_produit_id USING ERRCODE = 'P0002';
  END IF;

  IF p_partenaire_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.partenaires WHERE id = p_partenaire_id AND actif = TRUE) THEN
    RAISE EXCEPTION 'Partenaire introuvable ou inactif: %', p_partenaire_id USING ERRCODE = 'P0001';
  END IF;

  -- Frise active ET publiée pour la famille (jamais brouillon/archive)
  SELECT id INTO v_frise
  FROM public.frise_versions
  WHERE famille_id = p_famille_id AND actif = TRUE AND statut = 'publie'
  LIMIT 1;
  IF v_frise IS NULL THEN
    RAISE EXCEPTION 'AFFAIRE_FRISE_ACTIVE_INTROUVABLE' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Création de l'affaire
  INSERT INTO public.affaires (
    client_id, famille_id, type_id, frise_version_id,
    produit_id, partenaire_id, libelle, montant, frais, revenu_previsionnel,
    statut, date_ouverture, version_row, created_by, updated_by
  ) VALUES (
    p_client_id, p_famille_id, p_type_id, v_frise,
    p_produit_id, p_partenaire_id, p_libelle, p_montant, p_frais, p_revenu_previsionnel,
    'en_cours', now(), 1, auth.uid(), auth.uid()
  )
  RETURNING id INTO v_affaire;

  -- 2. Copie des étapes modèles
  INSERT INTO public.affaire_etapes (
    affaire_id, etape_modele_id, code, libelle, description, instructions,
    ordre, delai_indicatif_jours, validation_manuelle, conditions_blocage
  )
  SELECT v_affaire, m.id, m.code, m.libelle, m.description, m.instructions,
         m.ordre, m.delai_indicatif_jours, m.validation_manuelle, m.conditions_blocage
  FROM public.frise_etapes_modele m
  WHERE m.frise_version_id = v_frise;

  -- 3. Copie des tâches modèles (rattachées à l'instance d'étape correcte)
  INSERT INTO public.affaire_taches (
    affaire_id, etape_id, tache_modele_id, code, libelle, obligatoire, ordre
  )
  SELECT v_affaire, ae.id, tm.id, tm.code, tm.libelle, tm.obligatoire, tm.ordre
  FROM public.frise_taches_modele tm
  JOIN public.affaire_etapes ae
    ON ae.affaire_id = v_affaire AND ae.etape_modele_id = tm.etape_modele_id
  WHERE tm.frise_version_id = v_frise;

  -- 4. Copie des documents modèles
  INSERT INTO public.affaire_documents (
    affaire_id, etape_id, document_modele_id, code, libelle, type_document, obligatoire, ordre
  )
  SELECT v_affaire, ae.id, dm.id, dm.code, dm.libelle, dm.type_document, dm.obligatoire, dm.ordre
  FROM public.frise_documents_modele dm
  JOIN public.affaire_etapes ae
    ON ae.affaire_id = v_affaire AND ae.etape_modele_id = dm.etape_modele_id
  WHERE dm.frise_version_id = v_frise;

  -- 5. Copie des contrôles modèles
  INSERT INTO public.affaire_controles (
    affaire_id, etape_id, controle_modele_id, code, libelle, type_controle, obligatoire, ordre
  )
  SELECT v_affaire, ae.id, cm.id, cm.code, cm.libelle, cm.type_controle, cm.obligatoire, cm.ordre
  FROM public.frise_controles_modele cm
  JOIN public.affaire_etapes ae
    ON ae.affaire_id = v_affaire AND ae.etape_modele_id = cm.etape_modele_id
  WHERE cm.frise_version_id = v_frise;

  -- 6. Lignes de valeurs vides pour les champs applicables (portée famille + type sélectionné)
  INSERT INTO public.affaire_champ_valeurs (affaire_id, champ_def_id, valeur)
  SELECT v_affaire, d.id, NULL::jsonb
  FROM public.affaire_champ_defs d
  WHERE d.frise_version_id = v_frise
    AND ( d.portee = 'famille'
          OR (d.portee = 'type' AND d.type_id = p_type_id) );

  RETURN QUERY SELECT v_affaire, 1::bigint;
END;
$$;

REVOKE ALL     ON FUNCTION public.fn_affaire_creer(UUID,UUID,UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_creer(UUID,UUID,UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 25c. RPC : modification des informations d'une affaire (verrou optimiste)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_modifier_infos(
  p_affaire_id          UUID,
  p_version_attendue    BIGINT,
  p_libelle             TEXT,
  p_montant             NUMERIC DEFAULT NULL,
  p_frais               NUMERIC DEFAULT NULL,
  p_revenu_previsionnel NUMERIC DEFAULT NULL,
  p_produit_id          UUID    DEFAULT NULL,
  p_partenaire_id       UUID    DEFAULT NULL
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_statut  TEXT;
  v_version BIGINT;
  v_new_ver BIGINT;
BEGIN
  PERFORM private.fn_affaire_exige_conseiller();

  IF coalesce(btrim(p_libelle), '') = '' THEN
    RAISE EXCEPTION 'Le libelle est obligatoire.' USING ERRCODE = 'P0001';
  END IF;
  IF (p_montant IS NOT NULL AND p_montant < 0)
     OR (p_frais IS NOT NULL AND p_frais < 0)
     OR (p_revenu_previsionnel IS NOT NULL AND p_revenu_previsionnel < 0) THEN
    RAISE EXCEPTION 'Les montants ne peuvent pas etre negatifs.' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.statut, a.version_row
  INTO v_statut, v_version
  FROM public.affaires AS a
  WHERE a.id = p_affaire_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Affaire introuvable: %', p_affaire_id USING ERRCODE = 'P0002';
  END IF;
  IF v_statut <> 'en_cours' THEN
    RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE = 'P0001';
  END IF;

  -- Verrou optimiste
  IF v_version <> p_version_attendue THEN
    RAISE EXCEPTION 'AFFAIRE_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  IF p_produit_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.produits WHERE id = p_produit_id) THEN
    RAISE EXCEPTION 'Produit introuvable: %', p_produit_id USING ERRCODE = 'P0002';
  END IF;
  IF p_partenaire_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.partenaires WHERE id = p_partenaire_id AND actif = TRUE) THEN
    RAISE EXCEPTION 'Partenaire introuvable ou inactif: %', p_partenaire_id USING ERRCODE = 'P0001';
  END IF;

  -- Seuls les champs autorisés sont modifiés. version_row est incrémenté par le
  -- trigger trg_aff_bump_version (une seule fois).
  UPDATE public.affaires SET
    libelle             = p_libelle,
    montant             = p_montant,
    frais               = p_frais,
    revenu_previsionnel = p_revenu_previsionnel,
    produit_id          = p_produit_id,
    partenaire_id       = p_partenaire_id,
    updated_by          = auth.uid()
  WHERE id = p_affaire_id
  RETURNING affaires.version_row INTO v_new_ver;

  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;

REVOKE ALL     ON FUNCTION public.fn_affaire_modifier_infos(UUID,BIGINT,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_modifier_infos(UUID,BIGINT,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID) TO authenticated, service_role;


-- =============================================================================
-- PLAN DE ROLLBACK  (manuel — non exécuté ici)
-- =============================================================================
--   DROP FUNCTION IF EXISTS public.fn_affaire_creer(UUID,UUID,UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID);
--   DROP FUNCTION IF EXISTS public.fn_affaire_modifier_infos(UUID,BIGINT,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID);
--   DROP FUNCTION IF EXISTS private.fn_affaire_exige_conseiller();
--
-- =============================================================================
-- FICHIERS MODIFIÉS
-- =============================================================================
-- + supabase/migrations/025_affaires_creation_modification_rpc.sql  (ce fichier — nouveau)
-- =============================================================================
