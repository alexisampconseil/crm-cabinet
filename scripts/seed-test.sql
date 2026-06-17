-- =============================================================================
-- SEED DE TEST — AMP CRM
-- Données fictives, identifiées par le préfixe [TEST] dans le nom
-- NE PAS exécuter en production
--
-- Usage :
--   Supabase Dashboard → SQL Editor → coller et exécuter
--
-- Réversible :
--   DELETE FROM produits WHERE nom LIKE '[TEST]%';
--   (la suppression cascade sur produits_gouvernance via ON DELETE CASCADE)
--
-- UUIDs fixes pour identification :
--   Produit SCPI   : a1b2c3d4-0000-4000-8000-000000000001
--   Produit AV     : a1b2c3d4-0000-4000-8000-000000000002
--   Gouvernance SCPI : b1b2c3d4-0000-4000-8000-000000000001
--   Gouvernance AV   : b1b2c3d4-0000-4000-8000-000000000002
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Produit 1 — SCPI de test
-- Marché cible : saisie manuelle, toutes les dimensions renseignées
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO produits (
  id,
  nom,
  societe_gestion,
  categorie,
  categorie_reglementaire,
  isin,
  sri,
  frais_entree,
  frais_gestion,
  frais_sortie,
  duree_detention_min,
  actif,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-0000-4000-8000-000000000001',
  '[TEST] Pierre Active Diversifiée',
  'AMP Gestion Immobilière (test)',
  'SCPI',
  'scpi',
  'FR0000000001',        -- 2 lettres + 10 chiffres = format ISIN valide
  3,                     -- SRI 3/7 — risque modéré
  8.00,                  -- frais d''entrée 8 %
  1.50,                  -- frais de gestion annuels 1,5 %
  NULL,                  -- pas de frais de sortie
  10,                    -- détention minimale 10 ans
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;


INSERT INTO produits_gouvernance (
  id,
  produit_id,
  -- Statuts
  statut_conformite,
  statut_validation,
  -- Source marché cible
  source_marche_cible,
  source_document_id,
  -- Marché cible positif
  mc_pos_connaissance,
  mc_pos_experience,
  mc_pos_capacite_pertes,
  mc_pos_tolerance_risque,
  mc_pos_horizon,
  mc_pos_sensibilite_esg,
  -- Marché cible négatif
  mc_neg_connaissance,
  mc_neg_experience,
  mc_neg_capacite_pertes,
  mc_neg_tolerance_risque,
  mc_neg_horizon,
  mc_neg_sensibilite_esg,
  -- Revues
  frequence_revue,
  date_derniere_revue,
  date_prochaine_revue,
  responsable_revue,
  alerte_revue,
  -- Champs narratifs
  notes_gouvernance,
  public_exclu,
  conditions_acces,
  created_at,
  updated_at
) VALUES (
  'b1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000001',
  'conforme',
  'a_valider',
  'manuel',
  NULL,
  'informe',            -- pos : investisseur informé
  'moyenne',            -- pos : expérience intermédiaire
  'pertes_limitees',    -- pos : accepte des pertes partielles
  'moyenne',            -- pos : tolérance au risque moyenne (SRI 4)
  'plus_5_ans',         -- pos : horizon long terme
  'aucune',             -- pos : pas d''exigence ESG
  'basique',            -- neg : ne convient pas aux profils basiques
  'faible',             -- neg : ne convient pas aux débutants
  'aucune_perte',       -- neg : inadapté aux profils sans tolérance aux pertes
  'tres_faible',        -- neg : SRI 1 incompatible
  'moins_2_ans',        -- neg : horizon court terme incompatible
  NULL,                 -- neg : sensibilité ESG non discriminante
  'annuelle',
  '2026-01-15',
  '2027-01-15',
  'Conseiller AMP',
  false,
  'SCPI diversifiée bureaux et commerces. Risque de perte en capital limité par la diversification sectorielle. Liquidité faible inhérente à la classe d''actifs.',
  'Investisseurs nécessitant une liquidité immédiate. Personnes avec un horizon inférieur à 8 ans. Profils SRI 1 ou 2.',
  'Parts accessibles à partir de 1 000 €. Démembrement (nue-propriété / usufruit) possible sur demande.',
  now(),
  now()
) ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Produit 2 — Assurance-vie de test
-- Marché cible : déduit par IA (simule une analyse Claude terminée)
-- statut_validation = a_valider → la bannière d''avertissement PDF s''affiche
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO produits (
  id,
  nom,
  societe_gestion,
  categorie,
  categorie_reglementaire,
  isin,
  sri,
  frais_entree,
  frais_gestion,
  frais_sortie,
  duree_detention_min,
  actif,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-0000-4000-8000-000000000002',
  '[TEST] Sécurité Premium AV',
  'AMP Vie (test)',
  'AV',
  'assurance_vie',
  NULL,                  -- pas d''ISIN pour un contrat AV
  2,                     -- SRI 2/7 — risque faible
  3.00,                  -- frais d''entrée 3 %
  0.80,                  -- frais de gestion annuels 0,8 %
  0.00,                  -- sans frais de sortie
  8,                     -- détention fiscalement optimale : 8 ans
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;


INSERT INTO produits_gouvernance (
  id,
  produit_id,
  -- Statuts
  statut_conformite,
  statut_validation,
  -- Source IA
  source_marche_cible,
  source_document_id,
  -- Marché cible positif
  mc_pos_connaissance,
  mc_pos_experience,
  mc_pos_capacite_pertes,
  mc_pos_tolerance_risque,
  mc_pos_horizon,
  mc_pos_sensibilite_esg,
  -- Marché cible négatif
  mc_neg_connaissance,
  mc_neg_experience,
  mc_neg_capacite_pertes,
  mc_neg_tolerance_risque,
  mc_neg_horizon,
  mc_neg_sensibilite_esg,
  -- Revues
  frequence_revue,
  date_derniere_revue,
  date_prochaine_revue,
  responsable_revue,
  alerte_revue,
  -- Métadonnées IA
  justifications_ia,
  score_confiance_ia,
  modele_ia,
  date_analyse_ia,
  -- Champs narratifs
  notes_gouvernance,
  public_exclu,
  created_at,
  updated_at
) VALUES (
  'b1b2c3d4-0000-4000-8000-000000000002',
  'a1b2c3d4-0000-4000-8000-000000000002',
  'conforme',
  'a_valider',           -- non validé → bannière "À valider par le conseiller" dans le PDF
  'deduit_ia',           -- source IA → section Justifications IA visible dans le PDF
  NULL,
  'informe',
  'faible',
  'pertes_limitees',
  'faible',              -- SRI 2-3
  'plus_5_ans',
  'moderee',             -- clients avec sensibilité ESG modérée acceptés
  'basique',
  'faible',
  'aucune_perte',
  'tres_faible',         -- SRI 1 incompatible
  'moins_2_ans',
  NULL,
  'semestrielle',
  '2025-12-01',
  '2026-06-01',
  'Conseiller AMP',
  false,
  -- Justifications IA simulées (comme produites par la route /api/documents/analyze)
  '{
    "connaissance": "Le DICI indique que le contrat cible les investisseurs ayant une connaissance de base des placements en assurance-vie. La notice précise que le souscripteur doit comprendre le mécanisme du fonds euros et des unités de compte.",
    "experience": "Aucune expérience préalable en investissement n''est requise selon le document émetteur. Le fonds euros à capital garanti est adapté à un profil sans historique de placement.",
    "tolerance_risque": "Le SRI global du contrat est de 2/7, correspondant à un profil de risque faible. La composition type recommandée (70 % fonds euros, 30 % UC) confirme cette évaluation.",
    "horizon": "La durée de détention recommandée est de 8 ans minimum pour bénéficier de la fiscalité favorable. Ce prérequis est explicitement mentionné dans le DICI."
  }'::jsonb,
  0.87,                  -- score de confiance IA : 87 %
  'claude-sonnet-4-6',
  now() - interval '2 hours',
  'Contrat multisupport avec fonds euros garanti et unités de compte sélectionnées par le comité de gestion. Avantage fiscal successoral applicable après 8 ans.',
  'Contribuables cherchant uniquement un rendement à court terme. Personnes ne pouvant immobiliser leur épargne 8 ans.',
  now(),
  now()
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- VÉRIFICATION — à lancer après le seed pour confirmer l''insertion
-- =============================================================================
-- SELECT id, nom, categorie, categorie_reglementaire, sri
-- FROM produits
-- WHERE nom LIKE '[TEST]%';
--
-- SELECT p.nom, g.statut_conformite, g.statut_validation,
--        g.source_marche_cible, g.mc_pos_connaissance, g.score_confiance_ia
-- FROM produits_gouvernance g
-- JOIN produits p ON p.id = g.produit_id
-- WHERE p.nom LIKE '[TEST]%';


-- =============================================================================
-- ROLLBACK — supprimer toutes les données de test
-- Exécuter uniquement quand les tests sont terminés
-- La suppression sur produits cascade sur produits_gouvernance (ON DELETE CASCADE)
-- =============================================================================
-- DELETE FROM produits WHERE nom LIKE '[TEST]%';
