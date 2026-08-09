-- =============================================================================
-- Migration 032 : Actifs financiers — distinction « sous gestion du cabinet »
-- Dépend de   : 001 (actifs_financiers), 016 (natures actifs)
-- Idempotente : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP CONSTRAINT IF EXISTS avant ADD, CREATE INDEX IF NOT EXISTS.
-- =============================================================================
--
-- Objectif : distinguer le patrimoine financier DÉTENU par le client (inchangé)
-- des actifs réellement GÉRÉS/suivis par le cabinet (encours cabinet).
--
--   - Éligibilité (dépend de la NATURE du produit) : produits réellement
--     distribués/suivis par le cabinet. Les produits bancaires classiques
--     (Livret A, LDDS, LEP, CEL, PEL → 'Livret' ; 'CompteCourant') et le
--     fourre-tout 'Autre' ne sont PAS éligibles.
--   - Sous gestion (dépend de l'ACTIF particulier du client) : nouvelle colonne
--     booléenne, FALSE par défaut, opt-in par le conseiller.
--
-- Le référentiel des natures est ici un CHECK enum (pas de table dédiée) : on
-- modélise donc l'éligibilité par une fonction IMMUTABLE, miroir SQL du
-- référentiel applicatif (lib/referentiel/conditionsProduit.ts →
-- AF_NATURES_ELIGIBLES_GESTION). Garde-fou base via CONTRAINTE CHECK : aucun
-- actif d'une nature non éligible ne peut être enregistré comme sous gestion.
--
-- Ne modifie AUCUNE migration précédente. Ne supprime aucun actif. Ne touche
-- pas au calcul du patrimoine total client.
-- =============================================================================

-- Éligibilité d'une nature d'actif financier à la gestion cabinet.
-- Fonction pure IMMUTABLE (utilisable dans une contrainte CHECK).
CREATE OR REPLACE FUNCTION public.af_nature_eligible_gestion(p_nature TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT p_nature IN ('AV','PER','SCPI','Capitalisation','PEA','CTO','PrivateEquity');
$$;

-- Colonne métier sur l'actif du client (FALSE par défaut : opt-in conseiller).
ALTER TABLE public.actifs_financiers
  ADD COLUMN IF NOT EXISTS sous_gestion_cabinet BOOLEAN NOT NULL DEFAULT FALSE;

-- Garde-fou base : « sous gestion » réservé aux natures éligibles.
ALTER TABLE public.actifs_financiers
  DROP CONSTRAINT IF EXISTS chk_af_sous_gestion_eligible;
ALTER TABLE public.actifs_financiers
  ADD CONSTRAINT chk_af_sous_gestion_eligible
  CHECK (sous_gestion_cabinet = FALSE OR public.af_nature_eligible_gestion(nature));

-- Index partiel : accélère les calculs d'encours cabinet (sous gestion only).
CREATE INDEX IF NOT EXISTS idx_af_sous_gestion
  ON public.actifs_financiers (client_id) WHERE sous_gestion_cabinet;

-- Rafraîchit le cache de schéma PostgREST (nouvelle colonne exposée à l'API).
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- PLAN DE ROLLBACK (manuel — non exécuté ici)
-- =============================================================================
--   DROP INDEX IF EXISTS public.idx_af_sous_gestion;
--   ALTER TABLE public.actifs_financiers DROP CONSTRAINT IF EXISTS chk_af_sous_gestion_eligible;
--   ALTER TABLE public.actifs_financiers DROP COLUMN IF EXISTS sous_gestion_cabinet;
--   DROP FUNCTION IF EXISTS public.af_nature_eligible_gestion(TEXT);
-- =============================================================================
