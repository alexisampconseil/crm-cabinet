-- =============================================================================
-- Migration 030 : Suppression du legacy « dossiers »
-- Dépend de   : 001 (dossiers, dossier_etapes), 007 (collecte_sessions.dossier_id),
--               029 (collecte_sessions.affaire_id — conservé)
-- Destructive  : suppression définitive de dossiers / dossier_etapes et de la
--                colonne collecte_sessions.dossier_id. NON idempotente (à
--                exécuter une seule fois). RESTRICT partout — jamais CASCADE :
--                une dépendance inconnue provoque un arrêt, pas une suppression
--                silencieuse.
-- =============================================================================
--
-- Le module « Affaires » (migrations 021-029) remplace l'ancien squelette
-- dossiers / dossier_etapes. La liaison collecte_sessions.affaire_id (029) prend
-- le relais de collecte_sessions.dossier_id, supprimée ici.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 30a. GARDE-FOUS BLOQUANTS
-- Refuse de continuer si des données legacy subsistent.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF (SELECT count(*) FROM public.dossiers) > 0 THEN
    RAISE EXCEPTION 'LEGACY_DOSSIERS_NON_VIDE : la table dossiers contient des lignes — suppression refusee.';
  END IF;
  IF (SELECT count(*) FROM public.dossier_etapes) > 0 THEN
    RAISE EXCEPTION 'LEGACY_DOSSIER_ETAPES_NON_VIDE : la table dossier_etapes contient des lignes — suppression refusee.';
  END IF;
  IF (SELECT count(*) FROM public.collecte_sessions WHERE dossier_id IS NOT NULL) > 0 THEN
    RAISE EXCEPTION 'LEGACY_COLLECTE_DOSSIER_ENCORE_UTILISE : des collecte_sessions referencent encore un dossier — suppression refusee.';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 30b. collecte_sessions : retrait de la liaison legacy dossier_id
-- (affaire_id, créée en 029, est conservée.)
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_cs_dossier_id;

ALTER TABLE public.collecte_sessions
  DROP CONSTRAINT IF EXISTS collecte_sessions_dossier_id_fkey;

ALTER TABLE public.collecte_sessions
  DROP COLUMN IF EXISTS dossier_id RESTRICT;


-- ─────────────────────────────────────────────────────────────────────────────
-- 30c. Suppression des tables legacy (enfant avant parent)
-- RESTRICT : arrêt si une dépendance inconnue subsiste.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.dossier_etapes RESTRICT;
DROP TABLE IF EXISTS public.dossiers RESTRICT;


-- =============================================================================
-- PLAN DE ROLLBACK (manuel)
--   Aucune restauration automatique : recréer dossiers / dossier_etapes /
--   collecte_sessions.dossier_id depuis les migrations 001 et 007 si nécessaire.
--   Les données legacy étaient vides — aucune perte de données.
-- FICHIERS MODIFIÉS : + supabase/migrations/030_remove_legacy_dossiers.sql
-- =============================================================================
