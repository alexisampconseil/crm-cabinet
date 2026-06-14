-- =============================================================================
-- Migration 011 : Référentiel Client Patrimonial — Documents justificatifs
-- Dépend de   : 001_initial_schema.sql (clients, auth.users)
--               007_collecte_sessions.sql (collecte_sessions)
-- Idempotente : CREATE TABLE IF NOT EXISTS, DROP TRIGGER IF EXISTS,
--               DROP POLICY IF EXISTS, CREATE INDEX IF NOT EXISTS
-- =============================================================================
--
-- Distinction avec documents_reglementaires (migration 001) :
--   documents_reglementaires → documents ÉMIS par le cabinet (LM, DER, FICI…)
--   documents_justificatifs  → documents FOURNIS par le client (avis d'imposition,
--                              bulletins de paie, relevés, titres de propriété…)
--
-- Pattern de stockage identique à produits_documents (migrations 004/005) :
--   storage_path → fichier dans Supabase Storage (bucket justificatifs-clients)
--   url          → document externe (scan, lien sécurisé tiers)
--   Contrainte CHECK : l'une des deux doit être renseignée.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 11a. TABLE PRINCIPALE : documents_justificatifs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents_justificatifs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Lien optionnel vers la session de collecte dans laquelle le document
  -- a été fourni. NULL si transmis hors session (email, courrier scanné…).
  session_id UUID REFERENCES collecte_sessions(id) ON DELETE SET NULL,


  -- ── Qualification du document ─────────────────────────────────────────────

  type TEXT NOT NULL
       CHECK (type IN (
         'avis_imposition',       -- Avis d'imposition (N-1 ou N-2)
         'bulletin_paie',         -- Bulletin(s) de salaire
         'releve_bancaire',       -- Relevé(s) de compte courant ou épargne
         'releve_actif',          -- Relevé de contrat (AV, PEA, PER, SCPI…)
         'titre_propriete',       -- Titre de propriété immobilière
         'acte_notarie',          -- Acte notarié (succession, donation, contrat de mariage…)
         'attestation_employeur', -- Attestation employeur ou contrat de travail
         'justificatif_identite', -- CNI, passeport, titre de séjour
         'justificatif_domicile', -- Facture, quittance de loyer, bail…
         'autre'
       )),

  annee_reference INTEGER
    CHECK (annee_reference BETWEEN 1900 AND 2100),
  -- Année de référence du document, ex : 2024 pour l'avis d'imposition 2024.
  -- Utile pour vérifier la fraîcheur des justificatifs sans lire le fichier.

  date_document DATE,
  -- Date d'établissement du document.
  -- Complémentaire à annee_reference : précision à la journée si connue.

  portee TEXT NOT NULL DEFAULT 'client'
         CHECK (portee IN (
           'client',   -- Document relatif au client signataire
           'conjoint', -- Document relatif au conjoint / partenaire
           'foyer'     -- Document valable pour l'ensemble du foyer
         )),


  -- ── Stockage ─────────────────────────────────────────────────────────────

  storage_path TEXT,
  -- Chemin dans Supabase Storage, bucket 'justificatifs-clients'.
  -- Format : 'justificatifs/{client_id}/{uuid}_{nom_fichier}'.
  -- NULL si document externe (url renseignée).

  url TEXT,
  -- URL directe vers un document externe ou un scan sécurisé.
  -- NULL si fichier stocké dans Supabase Storage (storage_path renseigné).

  CONSTRAINT chk_dj_source
    CHECK (storage_path IS NOT NULL OR url IS NOT NULL),
  -- Au moins une source doit être renseignée — même pattern que produits_documents
  -- après migration 005 (url rendue nullable, storage_path ajouté).

  nom_fichier TEXT,
  -- Nom original du fichier transmis par le client, pour affichage uniquement.
  -- Ex : 'avis_imposition_2024.pdf'.

  mime_type TEXT,
  -- Type MIME du fichier, ex : 'application/pdf', 'image/jpeg'.
  -- Permet la validation côté interface et l'icône d'aperçu.

  taille_octets INTEGER
    CHECK (taille_octets > 0),
  -- Taille du fichier en octets.
  -- Utilisé pour l'affichage et la surveillance des quotas de stockage.


  -- ── Cycle de vie ─────────────────────────────────────────────────────────
  --
  -- en_attente → valide    (conseiller accepte le document)
  --           → rejete     (conseiller refuse — motif dans notes)
  -- valide    → expire     (document devenu trop ancien ou caduc)
  -- rejete    → en_attente (client re-soumet après correction)

  statut TEXT NOT NULL DEFAULT 'en_attente'
         CHECK (statut IN (
           'en_attente', -- Uploadé, en attente de revue par le conseiller
           'valide',     -- Accepté et enregistré dans le dossier
           'rejete',     -- Refusé (document inadapté, illisible, périmé…)
           'expire'      -- Caduc — une version plus récente doit être fournie
         )),

  notes TEXT,
  -- Motif de rejet ou observations internes du conseiller.
  -- Non visible par le client dans l'interface actuelle.


  -- ── Traçabilité de validation ─────────────────────────────────────────────

  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Conseiller ayant validé ou rejeté le document.

  valide_le  TIMESTAMPTZ,
  -- Horodatage de la décision (validation ou rejet).

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 11b. TRIGGER updated_at
-- Réutilise set_updated_at() de migration 001 — aucune duplication.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_dj_updated_at ON documents_justificatifs;
CREATE TRIGGER trg_dj_updated_at
  BEFORE UPDATE ON documents_justificatifs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 11c. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- Chargement de tous les documents d'un client (dossier client)
CREATE INDEX IF NOT EXISTS idx_dj_client_id
  ON documents_justificatifs (client_id);

-- Filtrage par type (ex : tous les avis d'imposition d'un client)
CREATE INDEX IF NOT EXISTS idx_dj_client_type
  ON documents_justificatifs (client_id, type);

-- Filtrage par portée (documents du client vs du conjoint)
CREATE INDEX IF NOT EXISTS idx_dj_client_portee
  ON documents_justificatifs (client_id, portee);

-- Lien vers la session de collecte
CREATE INDEX IF NOT EXISTS idx_dj_session_id
  ON documents_justificatifs (session_id)
  WHERE session_id IS NOT NULL;

-- Dashboard conseiller : documents en attente de revue (requête transversale)
CREATE INDEX IF NOT EXISTS idx_dj_en_attente
  ON documents_justificatifs (client_id, created_at DESC)
  WHERE statut = 'en_attente';

-- Filtrage par année de référence (recherche de documents récents)
CREATE INDEX IF NOT EXISTS idx_dj_annee_reference
  ON documents_justificatifs (client_id, annee_reference DESC)
  WHERE annee_reference IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 11d. ROW LEVEL SECURITY
--
-- Les uploads client passent par une route API avec service_role (contournement
-- RLS), cohérent avec le traitement de kyc_responses et questionnaire_reponses.
-- La policy client est limitée au SELECT : le client consulte ses documents
-- depuis son portail mais ne peut pas les supprimer ni les modifier directement.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents_justificatifs ENABLE ROW LEVEL SECURITY;

-- Conseillers : accès complet (révision, rejet, suppression, archivage)
DROP POLICY IF EXISTS "conseiller_all" ON documents_justificatifs;
CREATE POLICY "conseiller_all" ON documents_justificatifs
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

-- Clients : lecture seule sur leurs propres documents
DROP POLICY IF EXISTS "client_own_data" ON documents_justificatifs;
CREATE POLICY "client_own_data" ON documents_justificatifs
  FOR SELECT TO authenticated
  USING (get_user_role() = 'client' AND client_id = get_user_client_id());
