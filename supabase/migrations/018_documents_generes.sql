-- =============================================================================
-- Migration 018 : Référentiel Client Patrimonial — Documents générés
-- Dépend de   : 001_initial_schema.sql (clients, auth.users)
--               007_collecte_sessions.sql (collecte_sessions)
--               012_patrimoine_snapshots.sql (patrimoine_snapshots)
-- Idempotente : CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP TRIGGER IF EXISTS, DROP POLICY IF EXISTS,
--               CREATE INDEX IF NOT EXISTS
-- =============================================================================
--
-- Rôle : archive documentaire réglementaire — chaque ligne est un PDF généré par
-- le système à partir d'une donnée source figée et immuable (aujourd'hui
-- uniquement patrimoine_snapshots), jamais depuis le référentiel live.
--
-- Périmètre explicite : cette table ne porte QUE les documents générés par le
-- système (KYC aujourd'hui ; demain bilan annuel, annexe ESG, annexe LCB-FT…).
-- Elle ne doit jamais accueillir les justificatifs fournis par le client
-- (documents_justificatifs, migration 011) ni les documents produits
-- (produits_documents, migration 002) — natures différentes, tables différentes.
--
-- Modélisation de la source : clé étrangère stricte (snapshot_id), pas de
-- référence polymorphe. Postgres ne peut pas poser de FK sur une référence
-- polymorphe (source_type + source_id) ; pour une table dont le rôle est de
-- constituer une preuve réglementaire, l'intégrité référentielle garantie par
-- la base prime sur la généricité. Le jour où un second type de source apparaît
-- (ex: esg_profils), recette de migration additive :
--   1. ALTER TABLE documents_generes ADD COLUMN esg_profil_id UUID
--      REFERENCES esg_profils(id) ON DELETE RESTRICT;
--      ALTER TABLE documents_generes ALTER COLUMN snapshot_id DROP NOT NULL;
--   2. ADD CONSTRAINT chk_dg_une_source
--      CHECK (num_nonnulls(snapshot_id, esg_profil_id) = 1);
--   3. Remplacer l'index unique (snapshot_id, template_code) par deux index
--      uniques partiels, un par colonne de source (WHERE … IS NOT NULL) — même
--      pattern que idx_ps_unique_finalise_session (migration 012).
--
-- Immuabilité :
--   Aucun document généré n'est modifiable ni supprimable après création, à
--   l'exception des colonnes de signature (mode_signature, signe_client_le,
--   signe_conseiller_le), réservées à une évolution future (signature
--   électronique). Enforced par deux triggers (fn_guard_document_genere §18b).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 18a. TABLE PRINCIPALE : documents_generes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents_generes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,

  -- ── Source métier ──────────────────────────────────────────────────────────

  snapshot_id UUID NOT NULL REFERENCES patrimoine_snapshots(id) ON DELETE RESTRICT,
  -- Unique source possible aujourd'hui. Le service vérifie en plus que ce
  -- snapshot est au statut 'finalise' avant tout rendu (la FK garantit son
  -- existence, pas son statut).

  session_id UUID REFERENCES collecte_sessions(id) ON DELETE SET NULL,
  -- Dénormalisé depuis snapshot_id (même logique que version_questionnaire
  -- dans questionnaire_reponses, migration 009). Nullable : un document généré
  -- hors session (ex: futur bilan_annuel) n'a pas de session associée, comme
  -- patrimoine_snapshots.session_id l'est déjà.


  -- ── Modèle de document ──────────────────────────────────────────────────────

  template_code TEXT NOT NULL,
  -- QUEL modèle de document : 'kyc_particulier' aujourd'hui ; demain
  -- 'kyc_personne_morale' | 'bilan_annuel' | 'esg_annexe' | 'lcb_ft_annexe'…

  template_version TEXT NOT NULL,
  -- QUELLE version de mise en page de CE modèle (ex: '1.0', '1.1') — distinct
  -- de template_code : changer la mise en page du KYC n'a aucun rapport avec
  -- l'ajout d'un nouveau modèle.

  version_schema VARCHAR(10) NOT NULL,
  -- Copie de patrimoine_snapshots.version_schema au moment de la génération.


  -- ── Étiquette d'affichage (jamais un identifiant technique) ─────────────────

  numero_sequence INTEGER NOT NULL,
  -- Rang du document pour CE client ET CE template_code (1, 2, 3…). Utilité
  -- réelle : étiquette humaine imprimée dans le document et affichée dans
  -- l'historique UI ("KYC n°3"). Les identifiants techniques (snapshot_id,
  -- session_id, genere_le) couvrent déjà l'unicité et la traçabilité —
  -- numero_sequence n'a aucune responsabilité d'identification, uniquement
  -- d'affichage figé. Ne doit jamais être utilisé comme clé d'idempotence.


  -- ── Fichier et intégrité ─────────────────────────────────────────────────────

  storage_path TEXT NOT NULL,
  -- Chemin dans Supabase Storage, bucket 'documents-generes'.
  -- Format : '{template_code}/{client_id}/{uuid}.pdf'.

  checksum_pdf TEXT NOT NULL,
  -- SHA-256 du binaire PDF réellement stocké. Protège une frontière
  -- d'intégrité différente de checksum_source : il prouve que LE FICHIER n'a
  -- pas été altéré/corrompu en Storage, vérifiable par un tiers (auditeur,
  -- juge) à partir du seul fichier + de cet enregistrement, sans accès au
  -- système ni à la donnée JSONB source.

  checksum_source TEXT NOT NULL,
  -- Copie de patrimoine_snapshots.checksum, imprimée dans le corps du
  -- document. Protège l'autre frontière : que la DONNÉE n'a pas changé depuis
  -- la génération. Les deux checksums sont complémentaires, pas redondants.

  taille_octets INTEGER NOT NULL CHECK (taille_octets > 0),


  -- ── Identité figée au moment de la génération ────────────────────────────────

  cabinet_nom TEXT NOT NULL,
  -- Lu depuis cabinet_config au moment T. Figé : si le cabinet change de nom
  -- plus tard, ce document historique reste fidèle à ce qui était vrai alors.

  conseiller_nom TEXT NOT NULL,
  -- Lu depuis auth.users au moment T, même logique que cabinet_nom.

  genere_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  genere_le  TIMESTAMPTZ NOT NULL,


  -- ── Signature (placeholders pour une évolution future) ───────────────────────

  mode_signature TEXT NOT NULL DEFAULT 'manuscrite'
                 CHECK (mode_signature IN ('manuscrite', 'electronique')),

  signe_client_le      TIMESTAMPTZ,
  -- NULL tant qu'aucune signature électronique n'est branchée.

  signe_conseiller_le  TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 18b. TRIGGERS DE GARDE
-- Même pattern que fn_guard_snapshot (migration 012) : tout UPDATE/DELETE est
-- bloqué, à l'exception des 3 colonnes de signature pour le trigger UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_guard_document_genere()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.id              IS DISTINCT FROM NEW.id
  OR OLD.client_id        IS DISTINCT FROM NEW.client_id
  OR OLD.snapshot_id       IS DISTINCT FROM NEW.snapshot_id
  OR OLD.session_id        IS DISTINCT FROM NEW.session_id
  OR OLD.template_code     IS DISTINCT FROM NEW.template_code
  OR OLD.template_version  IS DISTINCT FROM NEW.template_version
  OR OLD.version_schema    IS DISTINCT FROM NEW.version_schema
  OR OLD.numero_sequence   IS DISTINCT FROM NEW.numero_sequence
  OR OLD.storage_path      IS DISTINCT FROM NEW.storage_path
  OR OLD.checksum_pdf      IS DISTINCT FROM NEW.checksum_pdf
  OR OLD.checksum_source   IS DISTINCT FROM NEW.checksum_source
  OR OLD.taille_octets     IS DISTINCT FROM NEW.taille_octets
  OR OLD.cabinet_nom       IS DISTINCT FROM NEW.cabinet_nom
  OR OLD.conseiller_nom    IS DISTINCT FROM NEW.conseiller_nom
  OR OLD.genere_par        IS DISTINCT FROM NEW.genere_par
  OR OLD.genere_le         IS DISTINCT FROM NEW.genere_le
  OR OLD.created_at        IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION
      'documents_generes : le document % (client %) est immuable — seules les colonnes de signature peuvent évoluer.',
      OLD.id, OLD.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_document_genere ON documents_generes;
CREATE TRIGGER trg_guard_document_genere
  BEFORE UPDATE ON documents_generes
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION fn_guard_document_genere();


-- Garde DELETE : suppression jamais autorisée, sans exception.
CREATE OR REPLACE FUNCTION fn_guard_document_genere_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'documents_generes : le document % (client %) ne peut jamais être supprimé.',
    OLD.id, OLD.client_id;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_document_genere_delete ON documents_generes;
CREATE TRIGGER trg_guard_document_genere_delete
  BEFORE DELETE ON documents_generes
  FOR EACH ROW EXECUTE FUNCTION fn_guard_document_genere_delete();


-- ─────────────────────────────────────────────────────────────────────────────
-- 18c. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- Historique des documents d'un client, du plus récent au plus ancien
CREATE INDEX IF NOT EXISTS idx_dg_client_id
  ON documents_generes (client_id, genere_le DESC);

-- Filtrage par modèle de document (ex : tous les KYC particulier d'un client)
CREATE INDEX IF NOT EXISTS idx_dg_client_template
  ON documents_generes (client_id, template_code, numero_sequence DESC);

-- Lien vers la session de collecte
CREATE INDEX IF NOT EXISTS idx_dg_session_id
  ON documents_generes (session_id)
  WHERE session_id IS NOT NULL;

-- Lien vers le snapshot source
CREATE INDEX IF NOT EXISTS idx_dg_snapshot_id
  ON documents_generes (snapshot_id);

-- Idempotence (règle verrouillée) : un même couple (snapshot_id, template_code)
-- ne produit jamais deux documents distincts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dg_unique_snapshot_template
  ON documents_generes (snapshot_id, template_code);

-- Garde-fou contre une course sur le calcul de numero_sequence : l'INSERT
-- échoue plutôt que de produire un doublon silencieux d'étiquette.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dg_unique_client_template_sequence
  ON documents_generes (client_id, template_code, numero_sequence);


-- ─────────────────────────────────────────────────────────────────────────────
-- 18d. ROW LEVEL SECURITY
--
-- Conseillers : accès complet en lecture (création/lecture via service_role
-- dans la route applicative, cohérent avec le traitement de
-- patrimoine_snapshots).
-- Clients : lecture seule sur leurs propres documents.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents_generes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conseiller_all" ON documents_generes;
CREATE POLICY "conseiller_all" ON documents_generes
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

DROP POLICY IF EXISTS "client_own_data" ON documents_generes;
CREATE POLICY "client_own_data" ON documents_generes
  FOR SELECT TO authenticated
  USING (get_user_role() = 'client' AND client_id = get_user_client_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 18e. STORAGE — bucket 'documents-generes'
-- Privé, comme 'produits-documents' et 'justificatifs-clients'. Aucun accès
-- direct au bucket : toute lecture passe par une signed URL générée à la
-- demande via le service_role (cf. app/api/documents-generes/[archiveId]/
-- signed-url/route.ts), pas de policy storage.objects nécessaire.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents-generes', 'documents-generes', false)
ON CONFLICT (id) DO NOTHING;
