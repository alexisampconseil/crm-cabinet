-- Migration 004 : Extraction documentaire — stockage du texte avant analyse IA
-- Objectifs :
--   - Éviter les ré-analyses inutiles (déduplication par hash)
--   - Tracer chaque extraction et chaque appel Claude
--   - Conserver les versions (plusieurs extractions par document possibles)

-- ─────────────────────────────────────────────────────────────────────────────
-- 4a. Chemin de stockage sur produits_documents
-- Permet de distinguer documents externes (url) des fichiers uploadés (Storage)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE produits_documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT;
-- NULL  → document externe, l'url est la référence
-- Non-NULL → fichier dans Supabase Storage
--   format : 'produits/{produit_id}/{uuid}_{nom_fichier}'

-- ─────────────────────────────────────────────────────────────────────────────
-- 4b. Table documents_extraits
-- Une ligne par extraction de texte d'un document PDF.
-- Chaque ligne peut ensuite recevoir un résultat d'analyse IA.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents_extraits (
  id                    UUID        NOT NULL DEFAULT uuid_generate_v4(),
  document_id           UUID        NOT NULL REFERENCES produits_documents(id) ON DELETE CASCADE,

  -- ── Extraction texte ──────────────────────────────────────────────────────
  texte_extrait         TEXT        NOT NULL,
  nb_pages              INTEGER     CHECK (nb_pages > 0),
  hash_fichier          TEXT,                    -- SHA-256 hex du binaire source
  extraction_methode    TEXT        CHECK (extraction_methode IN (
    'pdf_parse',   -- npm pdf-parse (Node.js serveur)
    'pdfjs',       -- pdfjs-dist   (Node.js serveur)
    'manuel',      -- texte saisi manuellement
    'autre'
  )),
  date_extraction       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Statut analyse IA ─────────────────────────────────────────────────────
  statut_analyse        TEXT        NOT NULL DEFAULT 'en_attente'
    CHECK (statut_analyse IN (
      'en_attente',      -- texte prêt, analyse non encore lancée
      'en_cours',        -- appel Claude en cours
      'analyse_terminee',-- analyse réussie, résultat disponible
      'erreur'           -- échec IA, voir erreur_analyse
    )),

  -- ── Résultat IA (non-null si statut = 'analyse_terminee') ─────────────────
  gouvernance_id        UUID        REFERENCES produits_gouvernance(id) ON DELETE SET NULL,
  modele_ia             VARCHAR(100),           -- ex : 'claude-opus-4-8'
  version_prompt        VARCHAR(50),            -- ex : 'v1.0', 'marche-cible-v2'
  date_analyse_ia       TIMESTAMPTZ,
  tokens_entree         INTEGER,
  tokens_sortie         INTEGER,
  analyse_resultat_brut JSONB,                  -- réponse structurée complète de Claude
  erreur_analyse        TEXT,                   -- message d'erreur si statut = 'erreur'

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT documents_extraits_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4c. Index
-- ─────────────────────────────────────────────────────────────────────────────

-- Lookups par document (liste des extractions d'un document)
CREATE INDEX IF NOT EXISTS idx_de_document_id
  ON documents_extraits(document_id);

-- Filtrage par statut (file de traitement IA)
CREATE INDEX IF NOT EXISTS idx_de_statut_analyse
  ON documents_extraits(statut_analyse)
  WHERE statut_analyse IN ('en_attente', 'en_cours');

-- Déduplication par hash
CREATE INDEX IF NOT EXISTS idx_de_hash_fichier
  ON documents_extraits(hash_fichier)
  WHERE hash_fichier IS NOT NULL;

-- Jointure vers gouvernance (traçabilité inverse)
CREATE INDEX IF NOT EXISTS idx_de_gouvernance_id
  ON documents_extraits(gouvernance_id)
  WHERE gouvernance_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4d. RLS
-- Données techniques — conseillers uniquement (pas les clients)
-- Le service_role contourne le RLS pour les appels API
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents_extraits ENABLE ROW LEVEL SECURITY;

-- Lecture : conseillers authentifiés
DROP POLICY IF EXISTS "de_read_conseiller"  ON documents_extraits;
CREATE POLICY "de_read_conseiller" ON documents_extraits
  FOR SELECT TO authenticated
  USING (get_user_role() = 'conseiller');

-- Écriture : conseillers authentifiés
DROP POLICY IF EXISTS "de_write_conseiller" ON documents_extraits;
CREATE POLICY "de_write_conseiller" ON documents_extraits
  FOR ALL TO authenticated
  USING      (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');
