-- =============================================================================
-- Migration 012 : Référentiel Client Patrimonial — Snapshots patrimoniaux
-- Dépend de   : 001_initial_schema.sql (clients, auth.users)
--               007_collecte_sessions.sql (collecte_sessions)
-- Idempotente : CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP TRIGGER IF EXISTS, DROP POLICY IF EXISTS,
--               CREATE INDEX IF NOT EXISTS
-- =============================================================================
--
-- Rôle : photographie complète et datée du patrimoine d'un client à un instant T.
-- Générée après application des écarts acceptés, juste avant que la session
-- passe en statut 'valide'. Sert de référence stable pour les recommandations,
-- les modules futurs (Profil Investisseur, ESG, LCB-FT) et la traçabilité.
--
-- Immuabilité :
--   Tout snapshot en statut 'finalise' est immuable : aucun UPDATE ni DELETE
--   n'est autorisé. Enforced par deux triggers (fn_guard_snapshot §12b).
--   Seul le statut 'brouillon' autorise des modifications (assemblage en cours).
--
-- Point d'ancrage pour les modules futurs :
--   Les modules Profil Investisseur, ESG et LCB-FT référenceront ce tableau
--   via une FK nullable (snapshot_id) dans leurs propres tables, sans que
--   patrimoine_snapshots ne porte aucune colonne spécifique à ces modules.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 12a. TABLE PRINCIPALE : patrimoine_snapshots
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patrimoine_snapshots (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Lien vers la session de collecte ayant déclenché ce snapshot.
  -- NULL si snapshot généré hors session (bilan annuel automatique, demande
  -- manuelle conseiller, pre_recommandation sans session associée).
  session_id UUID REFERENCES collecte_sessions(id) ON DELETE SET NULL,


  -- ── Caractérisation du snapshot ───────────────────────────────────────────

  type_declencheur TEXT NOT NULL
                   CHECK (type_declencheur IN (
                     'validation_session',  -- Généré à la validation d'une session de collecte
                     'bilan_annuel',        -- Bilan de référence annuel
                     'pre_recommandation',  -- Généré avant émission d'une recommandation
                     'manuel'              -- Demande explicite du conseiller
                   )),

  version_schema VARCHAR(10) NOT NULL DEFAULT '1.0',
  -- Version du schéma JSONB du snapshot. Permet aux modules futurs de parser
  -- le contenu correctement même après une évolution du format.
  -- Dupliqué dans snapshot.version_schema pour lisibilité SQL sans parsing JSONB.


  -- ── Cycle de vie ─────────────────────────────────────────────────────────
  --
  -- brouillon ──→ finalise
  --
  -- brouillon : assemblage en cours — le JSONB peut être incomplet ou vide.
  --             Modifications autorisées.
  -- finalise  : snapshot complet, checksum calculé — état terminal, immuable.
  --             Tout UPDATE ou DELETE est intercepté par fn_guard_snapshot.

  statut TEXT NOT NULL DEFAULT 'brouillon'
         CHECK (statut IN ('brouillon', 'finalise')),

  CONSTRAINT chk_ps_finalise_complete
    CHECK (
      statut = 'brouillon'
      OR (checksum IS NOT NULL AND genere_le IS NOT NULL)
    ),
  -- Un snapshot finalisé doit impérativement avoir un checksum et un horodatage
  -- de génération. Empêche la finalisation d'un snapshot incomplet.


  -- ── Contenu du snapshot ───────────────────────────────────────────────────

  snapshot JSONB NOT NULL DEFAULT '{}',
  -- Patrimoine complet du client à la date de génération.
  -- Format (version_schema = '1.0') :
  -- {
  --   "version_schema": "1.0",
  --   "date_reference": "2026-06-14",
  --   "identite": {
  --     "nom": "...", "prenom": "...", "date_naissance": "...",
  --     "nationalite": "...", "pays_naissance": "...",
  --     "adresse": "...", "code_postal": "...", "ville": "..."
  --   },
  --   "foyer": {
  --     "situation": "marie",
  --     "regime_matrimonial": "separation_biens",
  --     "conjoint": { "nom": "...", "prenom": "...", "profession": "..." },
  --     "enfants": [
  --       { "prenom": "...", "date_naissance": "...", "a_charge": true }
  --     ]
  --   },
  --   "situation_professionnelle": {
  --     "client":  { "profession": "...", "employeur": "...", "categorie": "..." },
  --     "conjoint":{ "profession": "...", "employeur": "...", "categorie": "..." }
  --   },
  --   "patrimoine_financier": [
  --     { "nature": "AV", "libelle": "...", "montant": 50000, "souscrit_par": "client" }
  --   ],
  --   "patrimoine_immobilier": [
  --     { "nature": "RP", "valeur": 350000, "detenu_par": "commun" }
  --   ],
  --   "passifs": [
  --     { "nature": "immobilier", "banque": "...", "montant": 180000, "mensualite": 900 }
  --   ],
  --   "budget": {
  --     "revenus":  [{ "libelle": "Salaire net", "montant_annuel": 52000 }],
  --     "charges":  [{ "libelle": "Loyer",       "montant_annuel": 12000 }],
  --     "solde_annuel": 40000
  --   },
  --   "fiscalite": {
  --     "tranche_ir": "30", "revenu_fiscal": 75000,
  --     "nombre_parts": 2.5, "ifi": 0, "option_bareme": false,
  --     "dispositifs": []
  --   },
  --   "prevoyance": {
  --     "testament": false,
  --     "droits_retraite_estimes": 1800,
  --     "contrats": [{ "nature": "deces", "compagnie": "...", "montant": 150000 }]
  --   },
  --   "objectifs": [
  --     { "libelle": "Retraite", "horizon": "retraite", "montant_cible": 300000 }
  --   ]
  -- }

  checksum TEXT,
  -- SHA-256 du contenu JSONB sérialisé, calculé par l'application.
  -- Permet de détecter toute altération du snapshot après finalisation.
  -- NULL en statut brouillon, obligatoire en statut finalise
  -- (enforced par chk_ps_finalise_complete).


  -- ── Traçabilité ───────────────────────────────────────────────────────────

  genere_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Conseiller ou processus ayant déclenché la génération.
  -- NULL si généré par un job automatisé sans contexte utilisateur.

  genere_le  TIMESTAMPTZ,
  -- Horodatage de finalisation du snapshot.
  -- Distinct de created_at (création du brouillon) — permet de mesurer
  -- le délai d'assemblage si le brouillon a été préparé à l'avance.
  -- Obligatoire en statut finalise (enforced par chk_ps_finalise_complete).

  created_at TIMESTAMPTZ DEFAULT NOW()
  -- Création de la ligne (peut être en brouillon). Pas de updated_at :
  -- les snapshots finalisés sont immuables et les brouillons sont
  -- transitoires. La durée de vie d'un brouillon est mesurée par
  -- (genere_le - created_at) une fois finalisé.
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 12b. TRIGGERS DE GARDE
-- Deux triggers distincts : UPDATE (avec WHEN) et DELETE (sans WHEN).
-- Même pattern que session_ecarts (migration 010) pour les mêmes raisons :
-- WHEN (OLD IS DISTINCT FROM NEW) n'est pas utilisable sur BEFORE DELETE.
-- ─────────────────────────────────────────────────────────────────────────────

-- Garde UPDATE : bloque toute modification d'un snapshot finalisé
CREATE OR REPLACE FUNCTION fn_guard_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.statut = 'finalise' THEN
    RAISE EXCEPTION
      'patrimoine_snapshots : le snapshot % (client %) est finalisé — immuable, aucune modification autorisée.',
      OLD.id, OLD.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_snapshot ON patrimoine_snapshots;
CREATE TRIGGER trg_guard_snapshot
  BEFORE UPDATE ON patrimoine_snapshots
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION fn_guard_snapshot();


-- Garde DELETE : bloque la suppression d'un snapshot finalisé
CREATE OR REPLACE FUNCTION fn_guard_snapshot_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.statut = 'finalise' THEN
    RAISE EXCEPTION
      'patrimoine_snapshots : le snapshot % (client %) est finalisé — suppression non autorisée.',
      OLD.id, OLD.client_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_snapshot_delete ON patrimoine_snapshots;
CREATE TRIGGER trg_guard_snapshot_delete
  BEFORE DELETE ON patrimoine_snapshots
  FOR EACH ROW EXECUTE FUNCTION fn_guard_snapshot_delete();


-- ─────────────────────────────────────────────────────────────────────────────
-- 12c. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- Historique des snapshots d'un client, du plus récent au plus ancien
CREATE INDEX IF NOT EXISTS idx_ps_client_id
  ON patrimoine_snapshots (client_id, genere_le DESC NULLS LAST);

-- Dernier snapshot finalisé d'un client (requête la plus fréquente)
CREATE INDEX IF NOT EXISTS idx_ps_client_finalise
  ON patrimoine_snapshots (client_id, genere_le DESC)
  WHERE statut = 'finalise';

-- Lien vers la session de collecte
CREATE INDEX IF NOT EXISTS idx_ps_session_id
  ON patrimoine_snapshots (session_id)
  WHERE session_id IS NOT NULL;

-- Filtrage par déclencheur (ex : tous les snapshots pre_recommandation)
CREATE INDEX IF NOT EXISTS idx_ps_type_declencheur
  ON patrimoine_snapshots (client_id, type_declencheur);

-- Filtrage par version de schéma (pour migration future des anciens snapshots)
CREATE INDEX IF NOT EXISTS idx_ps_version_schema
  ON patrimoine_snapshots (version_schema)
  WHERE version_schema != '1.0';
-- Index partiel : la version courante (1.0) sera presque universelle,
-- indexer les versions non-courantes facilite les migrations futures.

-- Unicité : un seul snapshot finalisé par session
-- Empêche les doublons si la route de validation est appelée deux fois.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_unique_finalise_session
  ON patrimoine_snapshots (session_id)
  WHERE statut = 'finalise' AND session_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 12d. ROW LEVEL SECURITY
--
-- Conseillers : accès complet (créer brouillons, finaliser, lire tous).
-- Clients : lecture seule sur leurs snapshots finalisés uniquement.
--   Un client ne doit pas voir les brouillons en cours d'assemblage —
--   ils ne représentent pas encore un état patrimonial validé.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE patrimoine_snapshots ENABLE ROW LEVEL SECURITY;

-- Conseillers : accès complet
DROP POLICY IF EXISTS "conseiller_all" ON patrimoine_snapshots;
CREATE POLICY "conseiller_all" ON patrimoine_snapshots
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

-- Clients : lecture des snapshots finalisés uniquement
DROP POLICY IF EXISTS "client_own_finalise" ON patrimoine_snapshots;
CREATE POLICY "client_own_finalise" ON patrimoine_snapshots
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'client'
    AND client_id = get_user_client_id()
    AND statut = 'finalise'
  );
