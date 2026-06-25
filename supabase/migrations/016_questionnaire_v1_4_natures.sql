-- =============================================================================
-- MIGRATION 016 : Extension des CHECK constraints "nature" — Questionnaire v1.4
-- =============================================================================
-- Contexte : la logique conditionnelle du questionnaire passe d'une accumulation
-- de conditions indépendantes à un pilotage par type de produit précis. Cela
-- nécessite de nouvelles valeurs de "nature" pour distinguer des catégories
-- jusqu'ici fondues dans "Autre" ou trop génériques :
--   - actifs_financiers : ajout de 'CompteCourant', 'PrivateEquity'.
--   - patrimoine_immobilier : 'Locatif' scindé en 'LocatifNu' / 'LocatifMeuble'
--     (régimes fiscaux différents — foncier vs BIC), ajout de 'Terrain'.
--     'Locatif' est CONSERVÉ dans la contrainte (permissif, sans risque) même
--     si le questionnaire et le CRM ne le proposent plus — aucune ligne
--     existante ne l'utilise (vérifié), mais le retirer n'apporterait rien.
--
-- Les noms de contraintes ci-dessous suivent la convention de nommage
-- automatique de PostgreSQL pour un CHECK non nommé sur une colonne unique
-- (<table>_<colonne>_check). Si la contrainte réelle porte un autre nom,
-- consulter l'onglet "Constraints" de la table dans le Dashboard Supabase et
-- adapter le DROP CONSTRAINT ci-dessous en conséquence avant de rejouer.
--
-- Idempotence : DROP CONSTRAINT IF EXISTS avant chaque ADD CONSTRAINT.
-- =============================================================================

ALTER TABLE actifs_financiers
  DROP CONSTRAINT IF EXISTS actifs_financiers_nature_check;
ALTER TABLE actifs_financiers
  ADD CONSTRAINT actifs_financiers_nature_check
  CHECK (nature IN ('AV','PER','SCPI','Capitalisation','PEA','CTO','Livret','CompteCourant','PrivateEquity','Autre'));

ALTER TABLE patrimoine_immobilier
  DROP CONSTRAINT IF EXISTS patrimoine_immobilier_nature_check;
ALTER TABLE patrimoine_immobilier
  ADD CONSTRAINT patrimoine_immobilier_nature_check
  CHECK (nature IN ('RP','RS','Locatif','LocatifNu','LocatifMeuble','SCI','Terrain','Autre'));
