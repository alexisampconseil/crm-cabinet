-- =============================================================================
-- Migration 027 : Module Affaires — Cycle de vie (clôture / archivage /
--                 réouverture / correction du revenu)
-- Dépend de   : 024 (affaires + instances), 026 (helpers private charger/log)
-- Idempotente : CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables.
-- =============================================================================
--
-- Toutes les RPC : SECURITY DEFINER, search_path = '', objets qualifiés,
--   verrou optimiste (helper private.fn_affaire_charger_pour_maj), incrément
--   unique de version_row (via version_row = p_version_attendue + 1), événement
--   d'audit, atomicité. Aucune mise à jour automatique du patrimoine.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 27a. Terminer une affaire (contrôles de complétude)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_terminer(
  p_affaire_id UUID, p_version_attendue BIGINT, p_revenu_realise NUMERIC DEFAULT NULL
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN
    RAISE EXCEPTION 'Seule une affaire en cours peut etre terminee (statut: %).', v_statut USING ERRCODE = 'P0001';
  END IF;
  IF p_revenu_realise IS NOT NULL AND p_revenu_realise < 0 THEN
    RAISE EXCEPTION 'Le revenu realise ne peut pas etre negatif.' USING ERRCODE = 'P0001';
  END IF;

  -- Complétude réglementaire
  IF EXISTS (
    SELECT 1 FROM public.affaire_champ_valeurs cv
    JOIN public.affaire_champ_defs d ON d.id = cv.champ_def_id
    WHERE cv.affaire_id = p_affaire_id AND d.obligatoire = TRUE AND cv.valeur IS NULL
  ) THEN
    RAISE EXCEPTION 'AFFAIRE_CLOTURE_INCOMPLETE: champ obligatoire sans valeur.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affaire_taches WHERE affaire_id = p_affaire_id AND obligatoire = TRUE AND statut <> 'terminee') THEN
    RAISE EXCEPTION 'AFFAIRE_CLOTURE_INCOMPLETE: tache obligatoire non terminee.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affaire_documents WHERE affaire_id = p_affaire_id AND obligatoire = TRUE AND statut NOT IN ('valide','non_requis')) THEN
    RAISE EXCEPTION 'AFFAIRE_CLOTURE_INCOMPLETE: document obligatoire non valide/non requis.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affaire_controles WHERE affaire_id = p_affaire_id AND obligatoire = TRUE AND statut NOT IN ('conforme','deroge')) THEN
    RAISE EXCEPTION 'AFFAIRE_CLOTURE_INCOMPLETE: controle obligatoire non conforme/non deroge.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affaire_blocages WHERE affaire_id = p_affaire_id AND actif = TRUE AND deroge = FALSE) THEN
    RAISE EXCEPTION 'AFFAIRE_CLOTURE_INCOMPLETE: blocage actif non deroge.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.affaires AS a SET
    statut = 'terminee', date_cloture = now(),
    revenu_realise = COALESCE(p_revenu_realise, a.revenu_realise),
    updated_by = auth.uid(), version_row = p_version_attendue + 1
  WHERE a.id = p_affaire_id
  RETURNING a.version_row INTO v_new_ver;

  PERFORM private.fn_affaire_log(p_affaire_id, 'cloture', jsonb_build_object('revenu_realise', p_revenu_realise));
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_terminer(UUID,BIGINT,NUMERIC) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_terminer(UUID,BIGINT,NUMERIC) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 27b. Archiver une affaire (depuis en_cours ou terminee)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_archiver(
  p_affaire_id UUID, p_version_attendue BIGINT, p_motif_id UUID, p_commentaire TEXT DEFAULT NULL
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_nc BOOLEAN; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut NOT IN ('en_cours','terminee') THEN
    RAISE EXCEPTION 'Archivage autorise uniquement depuis en_cours ou terminee (statut: %).', v_statut USING ERRCODE = 'P0001';
  END IF;
  SELECT necessite_commentaire INTO v_nc FROM public.affaire_motifs_archivage WHERE id = p_motif_id AND actif = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motif d''archivage introuvable ou inactif: %', p_motif_id USING ERRCODE = 'P0002';
  END IF;
  IF v_nc = TRUE AND coalesce(btrim(p_commentaire), '') = '' THEN
    RAISE EXCEPTION 'Un commentaire est requis pour ce motif d''archivage.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.affaires AS a SET
    statut = 'archivee', motif_archivage_id = p_motif_id, commentaire_archivage = p_commentaire,
    date_archivage = now(), updated_by = auth.uid(), version_row = p_version_attendue + 1
  WHERE a.id = p_affaire_id
  RETURNING a.version_row INTO v_new_ver;

  PERFORM private.fn_affaire_log(p_affaire_id, 'archivage',
    jsonb_build_object('motif_id', p_motif_id, 'commentaire', p_commentaire));
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_archiver(UUID,BIGINT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_archiver(UUID,BIGINT,UUID,TEXT) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 27c. Réouvrir une affaire terminée (ne désarchive pas)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_reouvrir(
  p_affaire_id UUID, p_version_attendue BIGINT, p_motif TEXT
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'terminee' THEN
    RAISE EXCEPTION 'Seule une affaire terminee peut etre rouverte (statut: %).', v_statut USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(btrim(p_motif), '') = '' THEN
    RAISE EXCEPTION 'Un motif de reouverture est obligatoire.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.affaires AS a SET
    statut = 'en_cours', date_cloture = NULL, updated_by = auth.uid(), version_row = p_version_attendue + 1
  WHERE a.id = p_affaire_id
  RETURNING a.version_row INTO v_new_ver;

  PERFORM private.fn_affaire_log(p_affaire_id, 'reouverture', '{}'::jsonb, p_motif);
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_reouvrir(UUID,BIGINT,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_reouvrir(UUID,BIGINT,TEXT) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 27d. Corriger le revenu réalisé (affaire terminée ou archivée)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_corriger_revenu(
  p_affaire_id UUID, p_version_attendue BIGINT, p_revenu NUMERIC, p_motif TEXT
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_old NUMERIC; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut NOT IN ('terminee','archivee') THEN
    RAISE EXCEPTION 'Correction du revenu autorisee uniquement sur terminee ou archivee (statut: %).', v_statut USING ERRCODE = 'P0001';
  END IF;
  IF p_revenu IS NULL OR p_revenu < 0 THEN
    RAISE EXCEPTION 'Le revenu corrige doit etre positif ou nul.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(btrim(p_motif), '') = '' THEN
    RAISE EXCEPTION 'Un motif de correction est obligatoire.' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.revenu_realise INTO v_old FROM public.affaires AS a WHERE a.id = p_affaire_id;

  UPDATE public.affaires AS a SET
    revenu_realise = p_revenu, updated_by = auth.uid(), version_row = p_version_attendue + 1
  WHERE a.id = p_affaire_id
  RETURNING a.version_row INTO v_new_ver;

  PERFORM private.fn_affaire_log(p_affaire_id, 'revenu_corrige',
    jsonb_build_object('ancien', v_old, 'nouveau', p_revenu), p_motif);
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_corriger_revenu(UUID,BIGINT,NUMERIC,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_corriger_revenu(UUID,BIGINT,NUMERIC,TEXT) TO authenticated, service_role;


-- =============================================================================
-- PLAN DE ROLLBACK (manuel — non exécuté ici)
-- =============================================================================
--   DROP FUNCTION IF EXISTS public.fn_affaire_corriger_revenu(UUID,BIGINT,NUMERIC,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_reouvrir(UUID,BIGINT,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_archiver(UUID,BIGINT,UUID,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_terminer(UUID,BIGINT,NUMERIC);
--
-- FICHIERS MODIFIÉS : + supabase/migrations/027_affaires_cycle_vie_rpc.sql
-- =============================================================================
