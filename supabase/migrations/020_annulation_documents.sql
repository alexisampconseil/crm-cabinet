-- =============================================================================
-- Migration 020 : Annulation logique des documents générés
-- Dépend de   : 018_documents_generes.sql (documents_generes, triggers)
-- Idempotente : ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--               DROP INDEX IF EXISTS, DROP POLICY IF EXISTS
-- =============================================================================
--
-- Rôle : permettre l'annulation logique d'un document généré réglementaire sans
-- jamais le supprimer physiquement. Un document annulé reste archivé, accessible
-- en lecture par le conseiller (traçabilité complète), mais invisible pour le client.
--
-- Philosophie :
--   "annulation" ≠ "suppression". La trace physique (fichier Storage + ligne DB)
--   est conservée indéfiniment. Seul le statut change : 'actif' → 'annule'.
--   Un document annulé ne peut jamais être réactivé — l'irréversibilité est
--   garantie par le trigger fn_guard_document_genere (§20c).
--
-- Impact sur l'index unique d'idempotence (règle verrouillée) :
--   Avant 020 : UNIQUE (snapshot_id, template_code)               — sans WHERE
--   Après 020  : UNIQUE (snapshot_id, template_code) WHERE statut = 'actif'
--   → Un snapshot peut avoir au plus un document ACTIF par template, mais peut
--     accumuler des documents annulés. La régénération depuis le même snapshot
--     est possible après annulation (cas d'un défaut de rendu).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 20a. COLONNES : statut et traçabilité de l'annulation
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents_generes
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'actif'
    CHECK (statut IN ('actif', 'annule')),

  ADD COLUMN IF NOT EXISTS annule_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Identifiant du conseiller ayant prononcé l'annulation. NULL tant qu'actif.

  ADD COLUMN IF NOT EXISTS annule_le TIMESTAMPTZ,
  -- Horodatage de l'annulation. NULL tant qu'actif.

  ADD COLUMN IF NOT EXISTS motif_annulation TEXT;
  -- Raison de l'annulation (libre, optionnel). Ex : 'Erreur de rendu PDF'.


-- Cohérence structurelle : un document annulé doit toujours avoir un auteur et
-- une date d'annulation. Un document actif ne doit pas avoir ces champs remplis.
ALTER TABLE documents_generes
  DROP CONSTRAINT IF EXISTS chk_dg_annulation_coherente;
ALTER TABLE documents_generes
  ADD CONSTRAINT chk_dg_annulation_coherente
    CHECK (
      (statut = 'actif'  AND annule_le IS NULL AND annule_par IS NULL)
      OR
      (statut = 'annule' AND annule_le IS NOT NULL AND annule_par IS NOT NULL)
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 20b. INDEX UNIQUE PARTIEL
-- Remplacement de l'index total (migration 018) par un index partiel qui ne
-- porte que sur les documents actifs — libère le slot de régénération après
-- annulation.
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS idx_dg_unique_snapshot_template;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dg_unique_snapshot_template_actif
  ON documents_generes (snapshot_id, template_code)
  WHERE statut = 'actif';

-- Index d'accès rapide aux documents annulés (reporting, audit)
CREATE INDEX IF NOT EXISTS idx_dg_annule
  ON documents_generes (client_id, annule_le DESC)
  WHERE statut = 'annule';


-- ─────────────────────────────────────────────────────────────────────────────
-- 20c. TRIGGER DE GARDE — remplacement de fn_guard_document_genere (018)
--
-- Comportement après 020 :
--   ┌───────────────────────────────────────────┬───────────────┐
--   │ Opération                                  │ Résultat      │
--   ├───────────────────────────────────────────┼───────────────┤
--   │ Modifier une colonne immuable              │ EXCEPTION     │
--   │ Passer statut = 'actif' → 'annule'         │ AUTORISÉ      │
--   │ Modifier mode_signature / signe_*_le       │ AUTORISÉ      │
--   │ Toute modification sur un doc annulé       │ EXCEPTION     │
--   │   (dont tentative de réactivation)         │               │
--   └───────────────────────────────────────────┴───────────────┘
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_guard_document_genere()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── 1. Colonnes immuables ──────────────────────────────────────────────────
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
      'documents_generes : le document % (client %) est immuable — seules les colonnes de signature et d''annulation peuvent évoluer.',
      OLD.id, OLD.client_id;
  END IF;

  -- ── 2. Annulation irréversible ─────────────────────────────────────────────
  -- Une fois annulé, aucune modification n'est permise (y compris les signatures
  -- et toute tentative de réactivation).
  IF OLD.statut = 'annule' THEN
    RAISE EXCEPTION
      'documents_generes : le document % est annulé et ne peut plus être modifié — l''annulation est irréversible.',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Le trigger lui-même est CREATE OR REPLACE dans la migration 018 — pas besoin
-- de le recréer : la fonction vient d'être remplacée (même nom, même trigger).


-- ─────────────────────────────────────────────────────────────────────────────
-- 20d. RLS — politique client mise à jour
-- Les clients voient uniquement leurs documents actifs.
-- Les conseillers voient tout (actif + annulé) — la politique 018 est inchangée.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "client_own_data" ON documents_generes;
CREATE POLICY "client_own_data" ON documents_generes
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'client'
    AND client_id = get_user_client_id()
    AND statut = 'actif'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PLAN DE ROLLBACK
-- ─────────────────────────────────────────────────────────────────────────────
--
--   ALTER TABLE documents_generes DROP CONSTRAINT IF EXISTS chk_dg_annulation_coherente;
--   ALTER TABLE documents_generes
--     DROP COLUMN IF EXISTS statut,
--     DROP COLUMN IF EXISTS annule_par,
--     DROP COLUMN IF EXISTS annule_le,
--     DROP COLUMN IF EXISTS motif_annulation;
--   DROP INDEX IF EXISTS idx_dg_unique_snapshot_template_actif;
--   DROP INDEX IF EXISTS idx_dg_annule;
--   CREATE UNIQUE INDEX idx_dg_unique_snapshot_template ON documents_generes (snapshot_id, template_code);
--   -- Recréer fn_guard_document_genere de la migration 018 (version sans §20c)
--   DROP POLICY IF EXISTS "client_own_data" ON documents_generes;
--   CREATE POLICY "client_own_data" ON documents_generes
--     FOR SELECT TO authenticated
--     USING (get_user_role() = 'client' AND client_id = get_user_client_id());
-- =============================================================================
