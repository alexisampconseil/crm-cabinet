-- Migration 005 : Correctifs sécurité + roadmap OCR
-- Dépend de : 001 (produits_documents), 004 (documents_extraits)

-- ─────────────────────────────────────────────────────────────────────────────
-- 5a. url nullable sur produits_documents
-- Motivation : pour les documents uploadés dans Supabase Storage, l'URL signée
-- est générée à la demande (pas stockée en base). Les documents externes
-- conservent une url directe. Les nouveaux uploads stockent NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE produits_documents
  ALTER COLUMN url DROP NOT NULL;

COMMENT ON COLUMN produits_documents.url IS
  'URL directe pour les documents externes. NULL pour les fichiers Supabase Storage (voir storage_path).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5b. Ajout de la valeur ''ocr'' dans la contrainte extraction_methode
-- Prépare la roadmap OCR (PDF scannés) sans développement encore requis.
-- La contrainte auto-générée par PostgreSQL s'appelle typiquement
-- documents_extraits_extraction_methode_check. On la recrée pour ajouter ocr.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents_extraits
  DROP CONSTRAINT IF EXISTS documents_extraits_extraction_methode_check;

ALTER TABLE documents_extraits
  ADD CONSTRAINT documents_extraits_extraction_methode_check
    CHECK (extraction_methode IN (
      'pdf_parse',  -- npm pdf-parse — extraction texte natif PDF
      'pdfjs',      -- pdfjs-dist   — alternative d'extraction
      'ocr',        -- OCR (tesseract.js ou API externe) — pour PDF scannés
      'manuel',     -- texte saisi manuellement par le conseiller
      'autre'
    ));

COMMENT ON COLUMN documents_extraits.extraction_methode IS
  'Méthode utilisée pour extraire le texte. OCR réservé aux PDF scannés (roadmap).';
