-- =============================================================================
-- Migration 029 : Liaison collecte_sessions ↔ affaires
-- Dépend de   : 007 (collecte_sessions), 024 (affaires)
-- Idempotente : ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS + ADD,
--               CREATE INDEX IF NOT EXISTS
-- =============================================================================
--
-- Ajoute un lien nullable d'une session de collecte vers une affaire. Aucune
-- reprise de données (aucune liaison legacy utilisée — cf. vérifications
-- antérieures). Ne touche PAS dossier_id / dossiers / dossier_etapes.
-- =============================================================================

ALTER TABLE public.collecte_sessions
  ADD COLUMN IF NOT EXISTS affaire_id UUID;

ALTER TABLE public.collecte_sessions
  DROP CONSTRAINT IF EXISTS fk_cs_affaire;
ALTER TABLE public.collecte_sessions
  ADD CONSTRAINT fk_cs_affaire
    FOREIGN KEY (affaire_id) REFERENCES public.affaires (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cs_affaire_id
  ON public.collecte_sessions (affaire_id) WHERE affaire_id IS NOT NULL;

-- =============================================================================
-- PLAN DE ROLLBACK (manuel)
--   ALTER TABLE public.collecte_sessions DROP CONSTRAINT IF EXISTS fk_cs_affaire;
--   DROP INDEX IF EXISTS public.idx_cs_affaire_id;
--   ALTER TABLE public.collecte_sessions DROP COLUMN IF EXISTS affaire_id;
-- FICHIERS MODIFIÉS : + supabase/migrations/029_collecte_affaire_link.sql
-- =============================================================================
