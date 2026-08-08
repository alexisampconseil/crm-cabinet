-- =============================================================================
-- Migration 031 : Affaires — date d'étape modifiable (RPC additive)
-- Dépend de   : 024 (affaire_etapes), 026 (fn_affaire_etape_statut, helpers
--               private.fn_affaire_charger_pour_maj / fn_affaire_log)
-- Idempotente : DROP FUNCTION IF EXISTS + CREATE OR REPLACE FUNCTION.
-- =============================================================================
--
-- Périmètre STRICT : remplace UNIQUEMENT la RPC public.fn_affaire_etape_statut
-- pour accepter une date effective fournie par le conseiller (p_date DATE).
-- Aucune autre RPC, table, colonne ou migration (001–030) n'est modifiée.
--
-- Comportement :
--   - p_date NULL  → automatisation d'origine conservée (now() si la colonne
--                    concernée est vide) — rétro-compatible ;
--   - p_date fourni → prime et remplace la date de la transition concernée
--                    (date_debut pour « en_cours », date_fin pour « terminee »).
--   La date arrive au format DATE (sans heure) et est stockée telle quelle
--     (cast timestamptz) ; l'affichage se fait sur la portion date, sans décalage
--     de fuseau (voir couche applicative).
--
-- Garanties PRÉSERVÉES à l'identique (règles 026) :
--   - verrouillage optimiste via private.fn_affaire_charger_pour_maj
--     (AFFAIRE_CONFLICT si version_row <> p_version_attendue) ;
--   - contrôle du rôle conseiller (dans le helper : fn_affaire_exige_conseiller) ;
--   - incrément unique de version_row (= p_version_attendue + 1) ;
--   - événement d'audit 'etape_modifiee' (avec la date dans les détails) ;
--   - SECURITY DEFINER, SET search_path = '', REVOKE anon / GRANT authenticated.
--
-- La signature passe de 4 à 5 arguments : on supprime l'ancienne fonction à
-- 4 arguments pour éviter toute ambiguïté de surcharge côté PostgREST.
-- =============================================================================

DROP FUNCTION IF EXISTS public.fn_affaire_etape_statut(UUID, BIGINT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.fn_affaire_etape_statut(
  p_affaire_id UUID, p_version_attendue BIGINT, p_etape_id UUID, p_statut TEXT,
  p_date DATE DEFAULT NULL
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  -- Rôle conseiller + verrouillage optimiste (AFFAIRE_CONFLICT si version différente).
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE='P0001'; END IF;
  IF p_statut NOT IN ('a_faire','en_cours','terminee','ignoree') THEN
    RAISE EXCEPTION 'Statut d''etape invalide: %', p_statut USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affaire_etapes WHERE id = p_etape_id AND affaire_id = p_affaire_id) THEN
    RAISE EXCEPTION 'Etape non rattachee a cette affaire.' USING ERRCODE = 'P0002';
  END IF;

  -- Date effective : p_date prime si fourni ; sinon automatisation d'origine.
  UPDATE public.affaire_etapes SET statut = p_statut,
    date_debut = CASE
      WHEN p_statut = 'en_cours'
        THEN COALESCE(p_date::timestamptz, CASE WHEN date_debut IS NULL THEN now() ELSE date_debut END)
      ELSE date_debut END,
    date_fin = CASE
      WHEN p_statut = 'terminee'
        THEN COALESCE(p_date::timestamptz, now())
      ELSE date_fin END
    WHERE id = p_etape_id;

  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;

  PERFORM private.fn_affaire_log(p_affaire_id, 'etape_modifiee',
    jsonb_build_object('etape_id', p_etape_id, 'statut', p_statut, 'date', p_date));

  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_etape_statut(UUID,BIGINT,UUID,TEXT,DATE) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_etape_statut(UUID,BIGINT,UUID,TEXT,DATE) TO authenticated, service_role;

-- Rafraîchit le cache de schéma de PostgREST pour exposer immédiatement la
-- nouvelle signature après (re)déploiement. Sans ce rechargement, l'API peut
-- répondre « Impossible de trouver la fonction public.fn_affaire_etape_statut(...) »
-- alors que la fonction existe bien en base avec la bonne signature.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- PLAN DE ROLLBACK (manuel — non exécuté ici)
-- =============================================================================
--   DROP FUNCTION IF EXISTS public.fn_affaire_etape_statut(UUID,BIGINT,UUID,TEXT,DATE);
--   -- puis recréer la version 4-arguments de la migration 026.
-- =============================================================================
