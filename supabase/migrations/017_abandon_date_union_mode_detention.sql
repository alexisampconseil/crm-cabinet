-- =============================================================================
-- MIGRATION 017 : Abandon date_union, abandon mode_detention texte libre,
-- correction du bug de contrainte regime_matrimonial.
-- =============================================================================
-- Décisions produit (2026-06-26) :
--   1. date_union est abandonné — modèle cible : date_mariage / date_pacs
--      (colonnes déjà créées par la migration 015, déjà utilisées par le KYC
--      depuis la v1.2). Vérifié : date_union est NULL sur toutes les lignes
--      existantes — aucune perte de donnée, aucun script de bascule requis.
--   2. patrimoine_immobilier.mode_detention (colonne texte libre, jamais lue
--      par snapshot_prefill) est abandonné — modèle cible : detail.mode_detention
--      (JSONB structuré, déjà utilisé par le KYC depuis la v1.2/v1.4). Vérifié :
--      NULL sur toutes les lignes existantes — aucune perte, aucune bascule.
--   3. Bug découvert lors de l'audit du 2026-06-26 : la contrainte CHECK de
--      regime_matrimonial autorisait encore 'NA' (valeur historique v1.0) mais
--      pas 'autre' (valeur utilisée par le CRM et le KYC depuis la v1.2) — toute
--      tentative d'enregistrer 'autre' aurait été rejetée par la base. Vérifié :
--      aucune ligne existante n'utilise 'NA' ni 'autre' — correction sans impact.
--
-- Idempotence : DROP COLUMN IF EXISTS / DROP CONSTRAINT IF EXISTS avant chaque
-- opération — sans danger si rejouée.
-- =============================================================================

-- 1. Abandon de date_union
ALTER TABLE famille DROP COLUMN IF EXISTS date_union;

-- 2. Abandon de patrimoine_immobilier.mode_detention (texte libre)
ALTER TABLE patrimoine_immobilier DROP COLUMN IF EXISTS mode_detention;

-- 3. Correction de la contrainte regime_matrimonial (NA -> autre)
ALTER TABLE famille DROP CONSTRAINT IF EXISTS famille_regime_matrimonial_check;
ALTER TABLE famille ADD CONSTRAINT famille_regime_matrimonial_check
  CHECK (regime_matrimonial IN ('communaute_reduite','separation_biens','participation_acquets','communaute_universelle','autre'));
