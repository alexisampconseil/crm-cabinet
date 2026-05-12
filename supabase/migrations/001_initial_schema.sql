-- ============================================================
-- AMP CONSEIL CRM — Schéma initial Supabase
-- Idempotent : peut être relancé sans erreur si les objets existent déjà
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES (ordre : clients → user_roles → reste)
-- Les fonctions helper référencent user_roles donc viennent après
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              TEXT UNIQUE,
  nom               TEXT NOT NULL,
  prenom            TEXT NOT NULL,
  email             TEXT,
  telephone         TEXT,
  ville             TEXT,
  statut            TEXT NOT NULL DEFAULT 'prospect'
                    CHECK (statut IN ('prospect','client','inactif','archive')),
  profil            TEXT
                    CHECK (profil IN ('prudent','equilibre','dynamique','agressif')),
  encours           NUMERIC(15,2) DEFAULT 0,
  dernier_contact   DATE,
  kyc_status        TEXT NOT NULL DEFAULT 'non_fait'
                    CHECK (kyc_status IN ('non_fait','en_cours','complet','a_renouveler')),
  kyc_submitted_at  TIMESTAMPTZ,
  derniere_relance  TIMESTAMPTZ,
  avatar            TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('conseiller','client')),
  client_id  UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ============================================================
-- FONCTIONS HELPER (après user_roles — LANGUAGE SQL valide à la création)
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_user_client_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT client_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- TABLES (suite)
-- ============================================================

CREATE TABLE IF NOT EXISTS famille (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  civilite                TEXT CHECK (civilite IN ('M.','Mme','Dr','Pr')),
  nom                     TEXT,
  prenom                  TEXT,
  lieu_naissance          TEXT,
  date_naissance          DATE,
  nationalite             TEXT DEFAULT 'Française',
  situation               TEXT CHECK (situation IN ('celibataire','marie','pacse','concubinage','divorce','veuf')),
  regime_matrimonial      TEXT CHECK (regime_matrimonial IN ('communaute_reduite','separation_biens','participation_acquets','communaute_universelle','NA')),
  date_union              DATE,
  adresse                 TEXT,
  code_postal             TEXT,
  ville                   TEXT,
  email                   TEXT,
  telephone               TEXT,
  profession              TEXT,
  employeur               TEXT,
  categorie_professionnelle TEXT,
  conjoint_civilite       TEXT,
  conjoint_nom            TEXT,
  conjoint_prenom         TEXT,
  conjoint_date_naissance DATE,
  conjoint_lieu_naissance TEXT,
  conjoint_nationalite    TEXT DEFAULT 'Française',
  conjoint_profession     TEXT,
  conjoint_employeur      TEXT,
  conjoint_email          TEXT,
  conjoint_telephone      TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enfants (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prenom         TEXT NOT NULL,
  nom            TEXT,
  date_naissance DATE,
  a_charge       BOOLEAN DEFAULT TRUE,
  filiation      TEXT CHECK (filiation IN ('commun','client','conjoint','adoption'))
);

CREATE TABLE IF NOT EXISTS objectifs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  libelle         TEXT NOT NULL,
  horizon         TEXT CHECK (horizon IN ('court_terme','moyen_terme','long_terme','retraite')),
  profil_risque   TEXT CHECK (profil_risque IN ('prudent','equilibre','dynamique','agressif')),
  besoin_liquidites TEXT CHECK (besoin_liquidites IN ('faible','moyen','fort','tres_fort')),
  montant_cible   NUMERIC(15,2),
  priorite        INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actifs_financiers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nature            TEXT NOT NULL CHECK (nature IN ('AV','PER','SCPI','Capitalisation','PEA','CTO','Livret','Autre')),
  libelle           TEXT NOT NULL,
  montant           NUMERIC(15,2),
  souscrit_par      TEXT CHECK (souscrit_par IN ('client','conjoint','commun')),
  date_souscription DATE,
  detail            JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patrimoine_immobilier (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nature         TEXT NOT NULL CHECK (nature IN ('RP','RS','Locatif','SCI','Autre')),
  valeur         NUMERIC(15,2),
  detenu_par     TEXT CHECK (detenu_par IN ('client','conjoint','commun','SCI')),
  mode_detention TEXT,
  revenus_annuels NUMERIC(12,2),
  fiscalite      TEXT,
  detail         JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passifs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nature     TEXT NOT NULL CHECK (nature IN ('immobilier','consommation','professionnel','autre')),
  banque     TEXT,
  montant    NUMERIC(15,2),
  duree      INTEGER,
  taux       NUMERIC(5,3),
  mensualite NUMERIC(10,2),
  detail     JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_postes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('revenu','charge')),
  libelle        TEXT NOT NULL,
  montant_annuel NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS fiscalite (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  tranche_ir     TEXT CHECK (tranche_ir IN ('0','11','30','41','45')),
  revenu_fiscal  NUMERIC(12,2),
  ifi            NUMERIC(12,2),
  dispositifs    JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prevoyance (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id              UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  testament              BOOLEAN DEFAULT FALSE,
  droits_retraite_estimes NUMERIC(10,2),
  detail                 TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contrats_prevoyance (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nature     TEXT NOT NULL CHECK (nature IN ('deces','incapacite','invalidite','dependance','sante','autre')),
  compagnie  TEXT,
  montant    NUMERIC(12,2),
  detail     JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dossiers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  titre       TEXT NOT NULL,
  statut      TEXT NOT NULL DEFAULT 'en_cours'
              CHECK (statut IN ('en_cours','suspendu','cloture','annule')),
  progression INTEGER DEFAULT 0 CHECK (progression BETWEEN 0 AND 100),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dossier_etapes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  libelle    TEXT NOT NULL,
  statut     TEXT NOT NULL DEFAULT 'pending'
             CHECK (statut IN ('pending','en_cours','valide','bloque')),
  date       DATE,
  ordre      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents_reglementaires (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('LM','DER','FICI','CRS','LAB','DICI','autre')),
  date_realisation DATE,
  url              TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produits (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom                  TEXT NOT NULL,
  societe_gestion      TEXT,
  categorie            TEXT NOT NULL CHECK (categorie IN ('AV','SCPI','PER','Capitalisation')),
  sri                  INTEGER CHECK (sri BETWEEN 1 AND 7),
  rendement_n1         NUMERIC(5,2),
  rendement_3ans       NUMERIC(5,2),
  ratio_sharpe_3ans    NUMERIC(6,3),
  dici_url             TEXT,
  description_ia       TEXT,
  commentaire_sri_ia   TEXT,
  actif                BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produits_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id    UUID NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('DICI','Brochure','Rapport','Autre')),
  url           TEXT NOT NULL,
  date_document DATE
);

CREATE TABLE IF NOT EXISTS kyc_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  contexte   TEXT NOT NULL DEFAULT 'prospect'
             CHECK (contexte IN ('prospect','maj_annuelle','modif_situation')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_responses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token        TEXT,
  responses    JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relances (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('kyc_initial','kyc_renouvellement','anniversaire','relance_rdv')),
  sent_at    TIMESTAMPTZ DEFAULT NOW(),
  email      TEXT
);

CREATE TABLE IF NOT EXISTS messagerie (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  expediteur  TEXT NOT NULL CHECK (expediteur IN ('conseiller','client')),
  contenu     TEXT NOT NULL,
  lu          BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID,
  role       TEXT,
  action     TEXT NOT NULL,
  resource   TEXT,
  ip         TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clients_statut         ON clients (statut);
CREATE INDEX IF NOT EXISTS idx_clients_kyc_status     ON clients (kyc_status);
CREATE INDEX IF NOT EXISTS idx_clients_email          ON clients (email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id     ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_client_id   ON user_roles (client_id);
CREATE INDEX IF NOT EXISTS idx_famille_client_id      ON famille (client_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_client_id     ON dossiers (client_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_statut        ON dossiers (statut);
CREATE INDEX IF NOT EXISTS idx_kyc_tokens_token       ON kyc_tokens (token);
CREATE INDEX IF NOT EXISTS idx_kyc_tokens_client_id   ON kyc_tokens (client_id);
CREATE INDEX IF NOT EXISTS idx_messagerie_client_id   ON messagerie (client_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id    ON access_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs (created_at DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION create_famille_on_client_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO famille (client_id, nom, prenom)
  VALUES (NEW.id, NEW.nom, NEW.prenom)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_create_famille ON clients;
CREATE TRIGGER trg_client_create_famille
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION create_famille_on_client_insert();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_updated_at    ON clients;
DROP TRIGGER IF EXISTS trg_famille_updated_at    ON famille;
DROP TRIGGER IF EXISTS trg_fiscalite_updated_at  ON fiscalite;
DROP TRIGGER IF EXISTS trg_prevoyance_updated_at ON prevoyance;
DROP TRIGGER IF EXISTS trg_dossiers_updated_at   ON dossiers;
DROP TRIGGER IF EXISTS trg_produits_updated_at   ON produits;

CREATE TRIGGER trg_clients_updated_at   BEFORE UPDATE ON clients   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_famille_updated_at   BEFORE UPDATE ON famille   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_fiscalite_updated_at BEFORE UPDATE ON fiscalite FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_prevoyance_updated_at BEFORE UPDATE ON prevoyance FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dossiers_updated_at  BEFORE UPDATE ON dossiers  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_produits_updated_at  BEFORE UPDATE ON produits  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE famille               ENABLE ROW LEVEL SECURITY;
ALTER TABLE enfants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectifs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE actifs_financiers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimoine_immobilier ENABLE ROW LEVEL SECURITY;
ALTER TABLE passifs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_postes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscalite             ENABLE ROW LEVEL SECURITY;
ALTER TABLE prevoyance            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrats_prevoyance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossiers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossier_etapes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents_reglementaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_tokens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_responses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE relances              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messagerie            ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs           ENABLE ROW LEVEL SECURITY;

-- Policies (DROP IF EXISTS avant CREATE pour idempotence)

DROP POLICY IF EXISTS "conseiller_all"       ON clients;
DROP POLICY IF EXISTS "client_own"           ON clients;
CREATE POLICY "conseiller_all" ON clients
  FOR ALL TO authenticated USING (get_user_role() = 'conseiller');
CREATE POLICY "client_own" ON clients
  FOR SELECT TO authenticated USING (get_user_role() = 'client' AND id = get_user_client_id());

DROP POLICY IF EXISTS "own_role"             ON user_roles;
DROP POLICY IF EXISTS "conseiller_all_roles" ON user_roles;
CREATE POLICY "own_role" ON user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "conseiller_all_roles" ON user_roles
  FOR ALL TO authenticated USING (get_user_role() = 'conseiller');

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'famille','enfants','objectifs','actifs_financiers',
    'patrimoine_immobilier','passifs','budget_postes','fiscalite',
    'prevoyance','contrats_prevoyance','dossiers',
    'documents_reglementaires','kyc_tokens','kyc_responses',
    'relances','messagerie'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "conseiller_all"   ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "client_own_data"  ON %I;', t);
    EXECUTE format(
      'CREATE POLICY "conseiller_all" ON %I FOR ALL TO authenticated USING (get_user_role() = ''conseiller'');', t
    );
    EXECUTE format(
      'CREATE POLICY "client_own_data" ON %I FOR SELECT TO authenticated USING (get_user_role() = ''client'' AND client_id = get_user_client_id());', t
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "conseiller_all"     ON dossier_etapes;
DROP POLICY IF EXISTS "client_via_dossier" ON dossier_etapes;
CREATE POLICY "conseiller_all" ON dossier_etapes
  FOR ALL TO authenticated USING (get_user_role() = 'conseiller');
CREATE POLICY "client_via_dossier" ON dossier_etapes
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'client' AND
    dossier_id IN (SELECT id FROM dossiers WHERE client_id = get_user_client_id())
  );

DROP POLICY IF EXISTS "authenticated_read" ON produits;
DROP POLICY IF EXISTS "conseiller_write"   ON produits;
CREATE POLICY "authenticated_read" ON produits
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "conseiller_write" ON produits
  FOR ALL TO authenticated USING (get_user_role() = 'conseiller');

DROP POLICY IF EXISTS "authenticated_read" ON produits_documents;
CREATE POLICY "authenticated_read" ON produits_documents
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "authenticated_insert" ON access_logs;
DROP POLICY IF EXISTS "conseiller_read"      ON access_logs;
CREATE POLICY "authenticated_insert" ON access_logs
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "conseiller_read" ON access_logs
  FOR SELECT TO authenticated USING (get_user_role() = 'conseiller');
