-- =============================================================================
-- Migration 019 : Référentiel Cabinet — Configuration et mentions légales
-- Dépend de   : aucune (table autonome)
-- Idempotente : CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP TRIGGER IF EXISTS, DROP POLICY IF EXISTS,
--               INSERT ... WHERE NOT EXISTS (seed unique)
-- =============================================================================
--
-- Rôle : source canonique des mentions légales du cabinet, imprimées en pied
-- de page de tout document généré (documents_generes, migration 018).
-- Remplace un fichier de constantes TypeScript : ces données sont métier et
-- peuvent changer sans déploiement de code.
--
-- mentions_legales est un bloc de texte unique plutôt que des champs atomiques
-- (n° ORIAS, statut CIF, statut IAS, RCP, médiateur séparés) : c'est une
-- formulation juridique arrêtée par le cabinet (forme sociale, capital social,
-- RCS, ORIAS, adhésions, RCP, activités réglementées…), à reproduire
-- fidèlement sur chaque document, pas à recomposer dynamiquement à partir de
-- fragments. Toute modification de ce texte doit être validée par le cabinet
-- avant mise à jour de cette table.
--
-- Une seule ligne aujourd'hui (cabinet mono-conseiller). C'est la bonne graine
-- pour grandir : le jour où plusieurs cabinets existent, on ajoute des lignes
-- + une FK cabinet_id ailleurs (sur un futur profil conseiller) — aucune
-- migration de structure n'est nécessaire sur cette table.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 19a. TABLE PRINCIPALE : cabinet_config
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cabinet_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  raison_sociale  TEXT NOT NULL,
  -- Nom court affiché en en-tête des documents (ex : "AMP CONSEIL").

  mentions_legales TEXT NOT NULL,
  -- Bloc de mentions légales complet (forme sociale, capital social, RCS,
  -- adresse, contact, ORIAS, statuts CIF/IAS et autres activités réglementées,
  -- RCP), imprimé verbatim en pied de page de chaque document généré.

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 19a-bis. RECONCILIATION DE SCHÉMA
-- CREATE TABLE IF NOT EXISTS ne fait rien si la table existe déjà avec un
-- schéma antérieur (ex : ancienne version de cette migration, avec des champs
-- atomiques séparés au lieu de mentions_legales). Ces ALTER TABLE ramènent
-- toute table déjà créée vers le schéma actuel, sans casser si elle est déjà
-- à jour ou si elle vient d'être créée ci-dessus.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cabinet_config ADD COLUMN IF NOT EXISTS mentions_legales TEXT;

UPDATE cabinet_config
SET mentions_legales =
  'SARL AMP CONSEIL au capital social de 5 000 euros et représentée par Alexis MILLION-PICALION' || E'\n' ||
  'RCS ANNECY 981 449 460 - Adresse du Siège Social : 15 route de Frangy, 74600 ANNECY' || E'\n' ||
  E'\n' ||
  'Contact : alexis@ampconseil.com - Téléphone : 06 82 18 18 45' || E'\n' ||
  'Société enregistrée à l''ORIAS sous le numéro 24000530 en qualité de : Courtier en assurance, Intermédiaire en opérations de banque et en services de paiement,' || E'\n' ||
  'Conseiller en Investissements Financiers & adhérent de la Chambre Nationale des Conseils en Gestion de Patrimoine, association agréée par l''Autorité des Marchés Financiers' || E'\n' ||
  'Activité de transaction sur immeubles et fonds de commerce, carte professionnelle n° 7401 2023 000 000 082 délivrée par la Chambre de Commerce et d''Industrie de la Haute-Savoie' || E'\n' ||
  'Responsabilité Civile Professionnelle et Garanties financières : Compagnie MMA IARD Assurances Mutuelles, 160 rue Henri Champion - 72030 Le Mans CEDEX 9' || E'\n' ||
  'Par l''intermédiaire de la SAS BDJ, 39 rue Mstislav Rostropovitch – 75017 Paris / ne peut recevoir aucun fonds ou valeur' || E'\n' ||
  'Activité de démarchage bancaire et financier'
WHERE mentions_legales IS NULL;

ALTER TABLE cabinet_config ALTER COLUMN mentions_legales SET NOT NULL;

-- Colonnes de l'ancien schéma (champs atomiques), supprimées si présentes —
-- superseded par mentions_legales (cf. en-tête de fichier).
ALTER TABLE cabinet_config
  DROP COLUMN IF EXISTS adresse,
  DROP COLUMN IF EXISTS code_postal,
  DROP COLUMN IF EXISTS ville,
  DROP COLUMN IF EXISTS numero_orias,
  DROP COLUMN IF EXISTS statut_cif,
  DROP COLUMN IF EXISTS statut_ias,
  DROP COLUMN IF EXISTS assurance_rcp,
  DROP COLUMN IF EXISTS mediateur,
  DROP COLUMN IF EXISTS email_contact,
  DROP COLUMN IF EXISTS telephone;


-- ─────────────────────────────────────────────────────────────────────────────
-- 19b. TRIGGER updated_at
-- Réutilise set_updated_at() de migration 001 — aucune duplication.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_cabinet_config_updated_at ON cabinet_config;
CREATE TRIGGER trg_cabinet_config_updated_at
  BEFORE UPDATE ON cabinet_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 19c. ROW LEVEL SECURITY
--
-- Lecture par tout utilisateur authentifié (conseiller ou client) : les
-- mentions légales doivent être visibles partout où un document généré est
-- affiché/téléchargé. Écriture réservée au conseiller.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cabinet_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conseiller_write" ON cabinet_config;
CREATE POLICY "conseiller_write" ON cabinet_config
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

DROP POLICY IF EXISTS "authenticated_read" ON cabinet_config;
CREATE POLICY "authenticated_read" ON cabinet_config
  FOR SELECT TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 19d. SEED — ligne unique
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO cabinet_config (raison_sociale, mentions_legales)
SELECT
  'AMP CONSEIL',
  'SARL AMP CONSEIL au capital social de 5 000 euros et représentée par Alexis MILLION-PICALION' || E'\n' ||
  'RCS ANNECY 981 449 460 - Adresse du Siège Social : 15 route de Frangy, 74600 ANNECY' || E'\n' ||
  E'\n' ||
  'Contact : alexis@ampconseil.com - Téléphone : 06 82 18 18 45' || E'\n' ||
  'Société enregistrée à l''ORIAS sous le numéro 24000530 en qualité de : Courtier en assurance, Intermédiaire en opérations de banque et en services de paiement,' || E'\n' ||
  'Conseiller en Investissements Financiers & adhérent de la Chambre Nationale des Conseils en Gestion de Patrimoine, association agréée par l''Autorité des Marchés Financiers' || E'\n' ||
  'Activité de transaction sur immeubles et fonds de commerce, carte professionnelle n° 7401 2023 000 000 082 délivrée par la Chambre de Commerce et d''Industrie de la Haute-Savoie' || E'\n' ||
  'Responsabilité Civile Professionnelle et Garanties financières : Compagnie MMA IARD Assurances Mutuelles, 160 rue Henri Champion - 72030 Le Mans CEDEX 9' || E'\n' ||
  'Par l''intermédiaire de la SAS BDJ, 39 rue Mstislav Rostropovitch – 75017 Paris / ne peut recevoir aucun fonds ou valeur' || E'\n' ||
  'Activité de démarchage bancaire et financier'
WHERE NOT EXISTS (SELECT 1 FROM cabinet_config);
