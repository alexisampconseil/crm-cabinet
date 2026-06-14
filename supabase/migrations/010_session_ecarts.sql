-- =============================================================================
-- Migration 010 : Référentiel Client Patrimonial — Écarts de session
-- Dépend de   : 007_collecte_sessions.sql  (collecte_sessions)
--               009_questionnaire_reponses.sql (questionnaire_reponses)
-- Idempotente : CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP TRIGGER IF EXISTS, DROP POLICY IF EXISTS,
--               CREATE INDEX IF NOT EXISTS
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 10a. TABLE PRINCIPALE : session_ecarts
-- Un enregistrement par écart détecté entre les réponses soumises par le client
-- et l'état du référentiel patrimonial (collecte_sessions.snapshot_prefill).
--
-- Granularité : un écart = un champ modifié (pas une entité entière).
-- Si un actif voit montant et libellé changer → deux écarts distincts,
-- même groupe_instance_id et même entite_id, colonne_cible différente.
--
-- Immuabilité partielle :
--   Les champs de détection (valeur_reference, valeur_proposee, type_ecart,
--   entite_cible, colonne_cible…) sont figés à la création.
--   Seuls les champs de décision (statut, decide_par, motif_rejet, overrides)
--   peuvent être mis à jour — enforced par le trigger fn_guard_ecart (§10b).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_ecarts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES collecte_sessions(id) ON DELETE CASCADE,

  -- Lien vers la réponse qui a généré cet écart.
  -- NULL pour les suppressions (le client signale qu'un item n'est plus valable
  -- sans soumettre de nouvelle valeur — pas de questionnaire_reponses associée).
  reponse_id  UUID REFERENCES questionnaire_reponses(id) ON DELETE SET NULL,


  -- ── Localisation de l'écart ──────────────────────────────────────────────

  bloc TEXT NOT NULL
       CHECK (bloc IN (
         'identite', 'foyer', 'situation_pro', 'revenus', 'charges',
         'actifs_financiers', 'immobilier', 'passifs',
         'fiscalite', 'prevoyance', 'objectifs'
       )),
  -- Même enum que questionnaire_reponses.bloc — permet le regroupement
  -- par section dans l'interface de revue conseiller.

  question_code VARCHAR(100) NOT NULL,
  -- Code stable de la question source, ex : 'actif_montant'.

  portee TEXT NOT NULL
         CHECK (portee IN ('client', 'conjoint', 'foyer')),

  groupe_instance_id UUID,
  -- UUID de l'instance répétable concernée (enfant, actif, crédit…).
  -- Correspond à questionnaire_reponses.groupe_instance_id et permet de
  -- regrouper les écarts d'une même occurrence.
  -- NULL pour les blocs non-répétables (identite, fiscalite…).


  -- ── Ciblage dans le référentiel ──────────────────────────────────────────

  entite_cible TEXT NOT NULL,
  -- Nom de la table référentielle concernée par cet écart.
  -- Exemples : 'famille', 'actifs_financiers', 'passifs', 'fiscalite'.

  colonne_cible TEXT,
  -- Colonne spécifique dans entite_cible, ex : 'montant', 'situation'.
  -- NULL pour les ajouts (ajout d'une entité entière) et les suppressions
  -- (suppression d'une entité entière).

  entite_id UUID,
  -- Identifiant de la ligne existante dans entite_cible.
  -- NULL pour les ajouts (aucune ligne existante à cibler).


  -- ── Nature et contenu de l'écart ─────────────────────────────────────────

  type_ecart TEXT NOT NULL
             CHECK (type_ecart IN (
               'modification', -- Valeur existante modifiée par le client
               'ajout',        -- Nouvelle entité proposée (actif, enfant…)
               'suppression'   -- Entité existante signalée comme obsolète
             )),

  valeur_reference JSONB,
  -- État actuel du champ dans le référentiel (tiré de snapshot_prefill).
  -- NULL pour les ajouts (aucune valeur de référence — entité nouvelle).
  -- Scalaire ou objet selon le type d'écart.
  -- Exemples :
  --   modification : {"valeur": 48000, "unite": "EUR/an"}
  --   suppression  : {"nature": "AV", "libelle": "Cardif Essentiel", "montant": 50000}
  --   ajout        : null

  valeur_proposee JSONB,
  -- Ce que le client propose (issu de questionnaire_reponses.reponse_metadata).
  -- NULL pour les suppressions pures (le client ne propose rien, il retire).
  -- Pour les ajouts, contient l'objet complet à insérer dans entite_cible.
  -- Exemples :
  --   modification : {"valeur": 52000, "unite": "EUR/an"}
  --   ajout        : {"nature": "PEA", "libelle": "PEA CIC", "montant": 15000, "souscrit_par": "client"}
  --   suppression  : null

  libelle_lisible TEXT NOT NULL,
  -- Description en langage naturel générée à la détection, pour l'interface
  -- conseiller sans parsing JSONB. Ex :
  --   "Salaire net annuel : 48 000 € → 52 000 €"
  --   "Assurance-vie Cardif Essentiel : suppression"
  --   "Nouveau PEA CIC — 15 000 €"


  -- ── Qualification automatique de l'impact ─────────────────────────────────

  niveau_impact TEXT NOT NULL
                CHECK (niveau_impact IN ('faible', 'moyen', 'fort', 'critique')),
  -- Calculé automatiquement à la création selon les règles de classification
  -- définies dans l'architecture (migration 010 — règles dans lib/écarts/).
  -- Basé sur : type d'écart, bloc, champ, magnitude de la variation.

  niveau_impact_override TEXT
                         CHECK (niveau_impact_override IN ('faible', 'moyen', 'fort', 'critique')),
  -- Surclassement manuel par le conseiller si son jugement diffère du calcul.
  -- NULL = pas de surclassement, niveau_impact fait foi.
  -- Valeur affichée dans l'interface : COALESCE(niveau_impact_override, niveau_impact).

  override_motif TEXT,
  -- Justification libre du surclassement. NULL si pas d'override.


  -- ── Cycle de vie et décision conseiller ──────────────────────────────────
  --
  -- a_revoir ──→ accepte ──→ traite   (appliqué dans le référentiel)
  --          └─→ rejete               (écarté)
  --
  -- Les transitions accepte ↔ rejete ↔ a_revoir sont autorisées avant
  -- que la session soit validée (le conseiller peut changer d'avis).
  -- traite est terminal : enforced par le trigger fn_guard_ecart (§10b).

  statut TEXT NOT NULL DEFAULT 'a_revoir'
         CHECK (statut IN (
           'a_revoir', -- Détecté, en attente de décision conseiller
           'accepte',  -- Conseiller approuve — sera appliqué à la validation
           'rejete',   -- Conseiller refuse — aucune mise à jour du référentiel
           'traite'    -- Changement accepté appliqué dans les tables référentielles
         )),

  motif_rejet TEXT,
  -- Justification libre en cas de rejet. NULL si accepté ou non encore décidé.

  decide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Conseiller ayant statué (accepté ou rejeté).

  decide_le  TIMESTAMPTZ,
  -- Horodatage de la décision.

  applique_le TIMESTAMPTZ,
  -- Rempli lors du passage statut → 'traite', après application effective
  -- de la modification dans la table référentielle cible.

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 10b. TRIGGER DE GARDE : fn_guard_ecart
-- Deux protections distinctes sur BEFORE UPDATE :
--
-- 1. État terminal : statut 'traite' → aucune modification tolérée.
--
-- 2. Immuabilité des champs de détection : les champs qui décrivent l'écart
--    observé ne peuvent pas être modifiés après création. Seuls les champs de
--    décision (statut, decide_par, decide_le, motif_rejet, niveau_impact_override,
--    override_motif, applique_le) sont autorisés à évoluer.
--
-- WHEN (OLD IS DISTINCT FROM NEW) : le trigger ne s'exécute pas sur les
-- updates sans changement réel — cohérent avec trg_snapshot_gouvernance
-- (migration 002) et trg_guard_questionnaire_version (migration 008).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_guard_ecart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- État terminal : aucune modification tolérée
  IF OLD.statut = 'traite' THEN
    RAISE EXCEPTION
      'session_ecarts : l''écart % est en statut "traite" — état terminal, aucune modification autorisée.',
      OLD.id;
  END IF;

  -- Champs de détection immuables après création
  IF OLD.session_id          IS DISTINCT FROM NEW.session_id
  OR OLD.reponse_id          IS DISTINCT FROM NEW.reponse_id
  OR OLD.bloc                IS DISTINCT FROM NEW.bloc
  OR OLD.question_code       IS DISTINCT FROM NEW.question_code
  OR OLD.portee              IS DISTINCT FROM NEW.portee
  OR OLD.groupe_instance_id  IS DISTINCT FROM NEW.groupe_instance_id
  OR OLD.entite_cible        IS DISTINCT FROM NEW.entite_cible
  OR OLD.colonne_cible       IS DISTINCT FROM NEW.colonne_cible
  OR OLD.entite_id           IS DISTINCT FROM NEW.entite_id
  OR OLD.type_ecart          IS DISTINCT FROM NEW.type_ecart
  OR OLD.valeur_reference    IS DISTINCT FROM NEW.valeur_reference
  OR OLD.valeur_proposee     IS DISTINCT FROM NEW.valeur_proposee
  OR OLD.libelle_lisible     IS DISTINCT FROM NEW.libelle_lisible
  OR OLD.niveau_impact       IS DISTINCT FROM NEW.niveau_impact
  THEN
    RAISE EXCEPTION
      'session_ecarts : les champs de détection de l''écart % sont immuables après création. Seuls statut, décision et overrides sont modifiables.',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ecart ON session_ecarts;
CREATE TRIGGER trg_guard_ecart
  BEFORE UPDATE ON session_ecarts
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION fn_guard_ecart();


-- Guard DELETE : bloque la suppression des écarts en état terminal 'traite'.
-- Fonction séparée de fn_guard_ecart car WHEN (OLD IS DISTINCT FROM NEW) ne peut
-- pas être utilisé sur un BEFORE DELETE (NEW n'est pas défini pour cet événement).
CREATE OR REPLACE FUNCTION fn_guard_ecart_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.statut = 'traite' THEN
    RAISE EXCEPTION
      'session_ecarts : l''écart % est en statut "traite" — suppression non autorisée (état terminal).',
      OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ecart_delete ON session_ecarts;
CREATE TRIGGER trg_guard_ecart_delete
  BEFORE DELETE ON session_ecarts
  FOR EACH ROW EXECUTE FUNCTION fn_guard_ecart_delete();


-- Audit DELETE : trace toute suppression réussie dans access_logs.
-- Déclenché AFTER DELETE — ne s'exécute que si fn_guard_ecart_delete a laissé
-- passer (statut ≠ 'traite'). Le champ resource encode les informations
-- minimales pour reconstituer le contexte sans JOIN ultérieur.
-- L'IP n'est pas disponible en contexte trigger (pas de requête HTTP) — elle
-- reste NULL, cohérent avec les insertions applicatives dans access_logs.
CREATE OR REPLACE FUNCTION fn_log_ecart_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO access_logs (user_id, role, action, resource)
  VALUES (
    auth.uid(),
    get_user_role(),
    'DELETE_ECART',
    'session_ecarts/' || OLD.id::TEXT
      || ' | session='  || OLD.session_id::TEXT
      || ' | statut='   || OLD.statut
      || ' | type='     || OLD.type_ecart
      || ' | bloc='     || OLD.bloc
      || ' | impact='   || OLD.niveau_impact
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ecart_delete ON session_ecarts;
CREATE TRIGGER trg_log_ecart_delete
  AFTER DELETE ON session_ecarts
  FOR EACH ROW EXECUTE FUNCTION fn_log_ecart_delete();


-- updated_at — réutilise set_updated_at() de migration 001
-- Nom préfixé 'trg_se_' pour garantir l'ordre alphabétique après le garde.
DROP TRIGGER IF EXISTS trg_se_updated_at ON session_ecarts;
CREATE TRIGGER trg_se_updated_at
  BEFORE UPDATE ON session_ecarts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 10c. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

-- Chargement de tous les écarts d'une session (vue de revue conseiller)
CREATE INDEX IF NOT EXISTS idx_se_session_id
  ON session_ecarts (session_id);

-- Regroupement par bloc dans l'interface (accordéon par section)
CREATE INDEX IF NOT EXISTS idx_se_session_bloc
  ON session_ecarts (session_id, bloc);

-- Filtrage par statut dans la file de revue (a_revoir en priorité)
CREATE INDEX IF NOT EXISTS idx_se_session_statut
  ON session_ecarts (session_id, statut);

-- Filtrage par niveau d'impact (tri par criticité dans l'interface)
CREATE INDEX IF NOT EXISTS idx_se_session_impact
  ON session_ecarts (session_id, niveau_impact);

-- Regroupement par instance répétable (afficher tous les écarts d'un même actif)
CREATE INDEX IF NOT EXISTS idx_se_groupe_instance
  ON session_ecarts (session_id, groupe_instance_id)
  WHERE groupe_instance_id IS NOT NULL;

-- Lien vers la réponse source (jointure depuis questionnaire_reponses)
CREATE INDEX IF NOT EXISTS idx_se_reponse_id
  ON session_ecarts (reponse_id)
  WHERE reponse_id IS NOT NULL;

-- Dashboard conseiller : sessions avec écarts en attente (requête transversale)
CREATE INDEX IF NOT EXISTS idx_se_a_revoir
  ON session_ecarts (session_id, niveau_impact)
  WHERE statut = 'a_revoir';

-- Audit : qui a décidé quoi
CREATE INDEX IF NOT EXISTS idx_se_decide_par
  ON session_ecarts (decide_par)
  WHERE decide_par IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10d. ROW LEVEL SECURITY
-- Les écarts sont internes au workflow conseiller.
-- Les clients n'y ont aucun accès (ni lecture ni écriture).
-- La création d'écarts est effectuée via service_role (route API de soumission)
-- qui contourne le RLS — cohérent avec kyc_responses et questionnaire_reponses.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE session_ecarts ENABLE ROW LEVEL SECURITY;

-- Conseillers : accès complet
-- Le trigger fn_guard_ecart (§10b) est le vrai verrou métier sur les
-- champs immuables et l'état terminal — la policy ne fait que définir
-- qui peut tenter une opération.
DROP POLICY IF EXISTS "conseiller_all" ON session_ecarts;
CREATE POLICY "conseiller_all" ON session_ecarts
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');
