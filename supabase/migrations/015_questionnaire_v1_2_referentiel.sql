-- =============================================================================
-- Migration 015 : Référentiel Client Patrimonial — extensions questionnaire v1.2
-- Dépend de   : 001_initial_schema.sql (famille, budget_postes, passifs,
--               patrimoine_immobilier)
-- Idempotente : ADD COLUMN IF NOT EXISTS
-- =============================================================================
--
-- Périmètre : colonnes nécessaires aux nouveaux champs du questionnaire v1.2
-- (situation familiale étendue, nature des revenus, capital restant dû,
-- acquisition/quote-part immobilier). Le démembrement (mode de détention,
-- usufruit, lien usufruitier) et la quotité passifs réutilisent les colonnes
-- `detail JSONB` déjà existantes sur actifs_financiers, patrimoine_immobilier
-- et passifs — aucune colonne supplémentaire requise pour ces deux points.
--
-- email, telephone, lieu_naissance (client et conjoint) existent déjà sur
-- famille depuis la migration 001 — aucune colonne à ajouter pour ces champs.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 15a. FAMILLE — situation familiale étendue (mariage, PACS, donation)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE famille
  ADD COLUMN IF NOT EXISTS date_mariage             DATE,
  -- Date du mariage. NULL si situation != 'marie' ou non renseigné.

  ADD COLUMN IF NOT EXISTS contrat_mariage          BOOLEAN,
  -- Existence d'un contrat de mariage. NULL = non renseigné (distinct de FALSE).

  ADD COLUMN IF NOT EXISTS date_contrat_mariage     DATE,
  -- Date du contrat de mariage, renseignée seulement si contrat_mariage = TRUE.

  ADD COLUMN IF NOT EXISTS donation_dernier_vivant  BOOLEAN,
  -- Existence d'une donation au dernier vivant. NULL = non renseigné.

  ADD COLUMN IF NOT EXISTS regime_pacs              TEXT,
  -- Régime du PACS : 'separation_biens' | 'indivision' | 'autre'.
  -- Pas de CHECK constraint — même logique que budget_postes.nature (souplesse
  -- métier, contrôle porté par le questionnaire, validation conseiller).

  ADD COLUMN IF NOT EXISTS date_pacs                DATE;
  -- Date de signature du PACS.


-- ─────────────────────────────────────────────────────────────────────────────
-- 15b. BUDGET_POSTES — nature des revenus + détail conditionnel par catégorie
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE budget_postes
  ADD COLUMN IF NOT EXISTS nature TEXT,
  -- Catégorie du revenu : 'salaire' | 'tns' | 'bic' | 'bnc' | 'ba' | 'retraite' |
  -- 'fonciers' | 'capitaux_mobiliers' | 'dividendes' |
  -- 'pension_alimentaire_recue' | 'pension_alimentaire_versee' | 'autre'.
  -- NULL pour les charges (non catégorisées) et pour les lignes existantes
  -- créées avant cette migration (CRM manuel, Phase "ajout d'éléments").
  -- Volontairement sans CHECK constraint : décision validée — éviter de
  -- bloquer une évolution future des catégories, contrôle porté par le
  -- questionnaire v1.2 et la validation conseiller, pas par la base.

  ADD COLUMN IF NOT EXISTS detail JSONB DEFAULT '{}';
  -- Champs complémentaires selon la nature : employeur, régime fiscal
  -- (micro/réel), nature de l'activité, société distributrice, organisme
  -- payeur, bénéficiaire/débiteur, précision libre. Même pattern que
  -- actifs_financiers.detail / patrimoine_immobilier.detail / passifs.detail.


-- ─────────────────────────────────────────────────────────────────────────────
-- 15c. PASSIFS — capital restant dû
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE passifs
  ADD COLUMN IF NOT EXISTS capital_restant_du NUMERIC(15,2);
  -- Distinct de `montant` (capital emprunté initial, déjà existant et déjà
  -- mappé). La quotité par membre du foyer reste dans `detail` JSONB
  -- (déjà existant sur cette table) — aucune colonne dédiée pour la quotité.


-- ─────────────────────────────────────────────────────────────────────────────
-- 15d. PATRIMOINE_IMMOBILIER — acquisition et quote-part
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE patrimoine_immobilier
  ADD COLUMN IF NOT EXISTS date_acquisition    DATE,

  ADD COLUMN IF NOT EXISTS quote_part_detenue   NUMERIC(5,2);
  -- Pourcentage de détention (0-100), distinct du mode de détention
  -- (pleine propriété/nue-propriété/usufruit) stocké dans `detail` JSONB.
  -- La typologie physique du bien (appartement/maison/terrain/...) est
  -- également stockée dans `detail.type_bien` — distincte de la colonne
  -- `nature` existante (RP/RS/Locatif/SCI/Autre), aucune colonne dédiée.


-- ─────────────────────────────────────────────────────────────────────────────
-- FICHIERS MODIFIÉS
-- ─────────────────────────────────────────────────────────────────────────────
-- + supabase/migrations/015_questionnaire_v1_2_referentiel.sql (ce fichier — nouveau)
--
-- Aucun fichier applicatif n'est modifié par cette migration. Le câblage
-- TypeScript (types, prefill, mapping, application, detection, questionnaire
-- v1.2) est traité séparément dans les étapes suivantes.
-- =============================================================================
