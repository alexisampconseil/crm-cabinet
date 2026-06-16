-- =============================================================================
-- Migration 014 : Référentiel Client Patrimonial — Triggers d'automatisation
-- Dépend de   : 007_collecte_sessions.sql (collecte_sessions, statuts, dates)
--               008_questionnaire_versions.sql (questionnaire_versions)
--               009_questionnaire_reponses.sql (questionnaire_reponses)
-- Idempotente : CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS idempotents
-- =============================================================================
--
-- Périmètre de cette migration :
--   Deux triggers d'automatisation — les seuls jugés légitimes côté base
--   après arbitrage (cf. analyse migration 014) :
--
--   §14a — Dates de transition de statut sur collecte_sessions.
--     Lorsque la session change de statut, les horodatages correspondants
--     (date_ouverture, date_soumission, date_validation) sont remplis
--     automatiquement. Logique triviale, impossible à oublier côté app,
--     sans aucune règle métier embarquée.
--
--   §14b — Dénormalisation de version_questionnaire sur questionnaire_reponses.
--     À l'INSERT, si questionnaire_version_id est fourni et version_questionnaire
--     est NULL, le trigger lit questionnaire_versions.version et le copie.
--     Garantit la cohérence de la dénormalisation sans coordination app.
--
-- Ce que cette migration NE fait PAS (automatismes applicatifs) :
--   Voir §14c pour le contrat d'implémentation côté Next.js.
--   Aucune logique de routing, de calcul JSONB, de règle métier ou de
--   compteur incrémental n'est embarquée dans la base.
--
-- Ordre de déclenchement sur collecte_sessions (BEFORE UPDATE) :
--   1. trg_collecte_sessions_updated_at  (migration 007, 'trg_co...')
--   2. trg_cs_set_dates                  (cette migration,  'trg_cs...')
--   Ordre alphabétique : 'co' < 'cs'. Les deux modifient des colonnes
--   distinctes — l'ordre n'a pas d'incidence fonctionnelle.
--
-- Ordre de déclenchement sur questionnaire_reponses (BEFORE INSERT) :
--   1. trg_guard_reponse_session         (migration 009, 'trg_g...')
--   2. trg_qr_set_version                (cette migration,  'trg_q...' → 'trg_qr_s...')
--   3. trg_qr_updated_at                 (migration 009,    'trg_q...' → 'trg_qr_u...')
--   Le garde valide l'autorisation en premier ; le set_version s'exécute
--   uniquement si le garde a laissé passer. trg_qr_updated_at est BEFORE
--   UPDATE uniquement — il ne s'exécute pas sur INSERT.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 14a. DATES DE TRANSITION DE STATUT — collecte_sessions
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Colonnes remplies automatiquement à chaque transition de statut :
--
--   brouillon  ──→ en_cours  : date_ouverture  = NOW()
--   (tout)     ──→ soumis    : date_soumission  = NOW()
--   (tout)     ──→ valide    : date_validation  = NOW()
--
-- Règles de remplissage :
--   1. Le trigger ne remplit la date que si elle est encore NULL.
--      Une date déjà renseignée (import de données historiques, correction
--      manuelle par un conseiller) n'est jamais écrasée.
--   2. Le trigger ne valide PAS l'ordre des transitions — cette responsabilité
--      reste côté application. Un conseiller peut techniquement sauter un
--      statut intermédiaire ; la validation de séquence n'appartient pas à
--      ce trigger.
--   3. WHEN (OLD.statut IS DISTINCT FROM NEW.statut) : le trigger ne s'exécute
--      que si le statut change réellement, évitant tout coût sur les UPDATE
--      qui touchent d'autres colonnes.

CREATE OR REPLACE FUNCTION fn_set_session_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ouverture : envoi du questionnaire au client
  IF NEW.statut = 'en_cours' AND NEW.date_ouverture IS NULL THEN
    NEW.date_ouverture := NOW();
  END IF;

  -- Soumission : le client valide son formulaire
  IF NEW.statut = 'soumis' AND NEW.date_soumission IS NULL THEN
    NEW.date_soumission := NOW();
  END IF;

  -- Validation : le conseiller clôt la revue et applique les écarts
  IF NEW.statut = 'valide' AND NEW.date_validation IS NULL THEN
    NEW.date_validation := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_set_dates ON collecte_sessions;
CREATE TRIGGER trg_cs_set_dates
  BEFORE UPDATE ON collecte_sessions
  FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
  EXECUTE FUNCTION fn_set_session_dates();


-- ─────────────────────────────────────────────────────────────────────────────
-- 14b. DÉNORMALISATION version_questionnaire — questionnaire_reponses
-- ─────────────────────────────────────────────────────────────────────────────
--
-- La colonne version_questionnaire (VARCHAR) est une copie dénormalisée de
-- questionnaire_versions.version (ex : '1.0', '2.0'). Elle permet de lire
-- la version sans JOIN et résiste à toute modification de structure de la
-- table parente.
--
-- Ce trigger garantit la cohérence de la dénormalisation à l'INSERT :
--   - Si questionnaire_version_id est fourni et version_questionnaire est NULL
--     → le trigger lit questionnaire_versions.version et le copie.
--   - Si version_questionnaire est déjà renseigné par l'application (cas d'un
--     INSERT explicite ou d'un import) → aucune modification.
--   - Si questionnaire_version_id est NULL → aucune action (session sans version
--     liée, cas brouillon en cours de configuration).
--
-- Scope : BEFORE INSERT uniquement.
--   Les réponses ne sont jamais censées changer de version après création.
--   Le trigger fn_guard_reponse_session (migration 009) bloque tout UPDATE
--   après soumission. En cas de correction avant soumission, l'application
--   est responsable de tenir version_questionnaire cohérent si elle change
--   questionnaire_version_id (cas quasi-inexistant en pratique).
--
-- SECURITY DEFINER : nécessaire pour lire questionnaire_versions en
-- contournant le RLS (le trigger s'exécute sous l'identité de son
-- propriétaire, pas de l'utilisateur déclencheur).

CREATE OR REPLACE FUNCTION fn_set_version_questionnaire()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version VARCHAR(20);
BEGIN
  IF NEW.questionnaire_version_id IS NOT NULL AND NEW.version_questionnaire IS NULL THEN
    SELECT version INTO v_version
    FROM questionnaire_versions
    WHERE id = NEW.questionnaire_version_id;

    -- Si l'id référence une version inexistante (FK nullable, version archivée
    -- supprimée hors procédure normale), laisser NULL sans exception :
    -- la FK ON DELETE SET NULL sur questionnaire_version_id gérera l'intégrité.
    NEW.version_questionnaire := v_version;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qr_set_version ON questionnaire_reponses;
CREATE TRIGGER trg_qr_set_version
  BEFORE INSERT ON questionnaire_reponses
  FOR EACH ROW EXECUTE FUNCTION fn_set_version_questionnaire();


-- ─────────────────────────────────────────────────────────────────────────────
-- 14c. CONTRAT D'IMPLÉMENTATION — automatismes applicatifs (Next.js)
-- Section documentaire — aucun SQL exécutable.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Les automatismes suivants sont délibérément laissés côté application.
-- Chaque route API citée est la seule responsable de l'opération décrite.
-- Ce contrat sert de référence lors de l'implémentation de lib/collecte/.
--
--
-- ── A. Peuplement de snapshot_prefill ────────────────────────────────────────
--   Déclenché par : route PATCH /api/collecte/sessions/:id → statut = 'en_cours'
--   Transaction :
--     1. Lire l'état courant du référentiel :
--        famille, enfants, actifs_financiers, patrimoine_immobilier, passifs,
--        budget_postes, fiscalite, prevoyance, contrats_prevoyance, objectifs
--        pour le client de la session.
--     2. Construire le JSONB snapshot_prefill selon le schéma documenté
--        dans patrimoine_snapshots (migration 012, §12a).
--     3. UPDATE collecte_sessions SET
--          statut           = 'en_cours',
--          snapshot_prefill = :jsonb,   -- la base ne se rémplit pas seule
--          questionnaire_version_id = :id_version_active
--        WHERE id = :session_id;
--   Le trigger trg_cs_set_dates (§14a) remplira date_ouverture automatiquement.
--
--
-- ── B. Détection des écarts ──────────────────────────────────────────────────
--   Déclenché par : route PATCH /api/collecte/sessions/:id → statut = 'soumis'
--   Transaction :
--     1. UPDATE collecte_sessions SET statut = 'soumis' WHERE id = :id.
--        → trg_cs_set_dates renseigne date_soumission.
--     2. Lire toutes les questionnaire_reponses de la session.
--     3. Comparer chaque réponse à snapshot_prefill via la table de mapping
--        question_code → (entite_cible, colonne_cible) définie dans
--        lib/collecte/mapping.ts.
--     4. Pour chaque écart détecté :
--        a. Calculer niveau_impact (lib/collecte/classification.ts).
--        b. Générer libelle_lisible en français.
--        c. Préparer la ligne session_ecarts (valeur_reference depuis
--           snapshot_prefill, valeur_proposee depuis reponse_metadata).
--     5. INSERT INTO session_ecarts [...] (bulk, une seule requête).
--     6. UPDATE collecte_sessions SET
--          statut              = 'en_revue',   -- passe en revue immédiatement
--          nb_ecarts_detectes  = (SELECT COUNT(*) FROM session_ecarts WHERE session_id = :id)
--        WHERE id = :id.
--        NB : recalcul COUNT — pas de compteur incrémental.
--
--
-- ── C. Application des écarts acceptés ───────────────────────────────────────
--   Déclenché par : route POST /api/collecte/sessions/:id/valider
--   Transaction :
--     1. Vérifier que tous les écarts sont en statut 'accepte' ou 'rejete'
--        (aucun 'a_revoir' restant) — lever une erreur HTTP 422 sinon.
--     2. Pour chaque écart statut='accepte', selon type_ecart :
--          modification → UPDATE {entite_cible} SET {colonne_cible} = {valeur_proposee}
--                         WHERE id = {entite_id}
--          ajout        → INSERT INTO {entite_cible} {...valeur_proposee}
--          suppression  → DELETE FROM {entite_cible} WHERE id = {entite_id}
--     3. UPDATE session_ecarts SET statut = 'traite', applique_le = NOW()
--        WHERE session_id = :id AND statut = 'accepte'.
--     4. UPDATE collecte_sessions SET
--          statut             = 'valide',
--          nb_ecarts_traites  = (SELECT COUNT(*) FROM session_ecarts
--                                WHERE session_id = :id AND statut = 'traite')
--        WHERE id = :id.
--        NB : recalcul COUNT — même principe que nb_ecarts_detectes.
--        → trg_cs_set_dates renseigne date_validation.
--     5. Enchaîner immédiatement avec l'étape D (génération snapshot).
--     L'ensemble est dans une seule transaction — rollback global si une
--     application échoue (ex : entite_id inexistant pour un ajout/suppression).
--
--
-- ── D. Génération du patrimoine_snapshot ─────────────────────────────────────
--   Déclenché par : fin de la transaction de validation (étape C)
--   Transaction (suite de C) :
--     1. Lire l'état du référentiel post-application des écarts (même lecture
--        que l'étape A, mais après les UPDATE/INSERT/DELETE de l'étape C).
--     2. Construire le JSONB snapshot selon le schéma de patrimoine_snapshots
--        (migration 012, §12a).
--     3. Calculer le checksum SHA-256 :
--          JSON.stringify avec clés triées alphabétiquement sur :
--          { client_id, genere_le, session_id, snapshot,
--            type_declencheur, version_schema }
--          → crypto.createHash('sha256').update(canonical).digest('hex')
--     4. INSERT INTO patrimoine_snapshots (
--          client_id, session_id, type_declencheur, version_schema,
--          statut, snapshot, checksum, genere_par, genere_le
--        ) VALUES (
--          :client_id, :session_id, 'validation_session', '1.0',
--          'finalise', :jsonb, :checksum, auth.uid(), NOW()
--        ).
--        NB : le snapshot est inséré directement en statut 'finalise'.
--        Pas de brouillon intermédiaire pour le cas validation_session —
--        l'assemblage est synchrone dans la transaction.
--
--
-- ── E. Recalcul des compteurs (règle générale) ───────────────────────────────
--   Aucun trigger ne maintient nb_ecarts_detectes ni nb_ecarts_traites.
--   La valeur persistée est toujours recalculée par COUNT(*) depuis
--   session_ecarts et écrasée atomiquement dans la même transaction que
--   l'opération qui a fait varier le nombre d'écarts.
--
--   Points de recalcul :
--     - Après bulk INSERT des écarts (étape B) → nb_ecarts_detectes
--     - Après application et passage en 'traite' (étape C) → nb_ecarts_traites
--     - Après DELETE d'un écart par le conseiller → nb_ecarts_detectes
--       (via route DELETE /api/collecte/ecarts/:id, dans la même transaction)
--
--   Si les deux compteurs doivent être recalculés simultanément :
--     UPDATE collecte_sessions SET
--       nb_ecarts_detectes = (SELECT COUNT(*) FROM session_ecarts WHERE session_id = :id),
--       nb_ecarts_traites  = (SELECT COUNT(*) FROM session_ecarts WHERE session_id = :id
--                             AND statut = 'traite')
--     WHERE id = :id;


-- ─────────────────────────────────────────────────────────────────────────────
-- PLAN DE ROLLBACK
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Rollback complet de la migration 014 :
--
--   DROP TRIGGER IF EXISTS trg_cs_set_dates      ON collecte_sessions;
--   DROP TRIGGER IF EXISTS trg_qr_set_version    ON questionnaire_reponses;
--   DROP FUNCTION IF EXISTS fn_set_session_dates();
--   DROP FUNCTION IF EXISTS fn_set_version_questionnaire();
--
-- Impact du rollback :
--   - date_ouverture, date_soumission, date_validation ne seront plus remplies
--     automatiquement → l'application devra les inclure explicitement dans ses
--     UPDATE de transition de statut.
--   - version_questionnaire ne sera plus remplie automatiquement → l'application
--     devra passer les deux champs (questionnaire_version_id + version_questionnaire)
--     à chaque INSERT de réponse.
--   Aucune donnée n'est supprimée. Les colonnes et tables restent intactes.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FICHIERS MODIFIÉS
-- ─────────────────────────────────────────────────────────────────────────────
-- + supabase/migrations/014_triggers_automatisation.sql  (ce fichier — nouveau)
--
-- Aucun fichier applicatif (lib/, app/, components/) n'est modifié par
-- cette migration. Le contrat d'implémentation applicatif (§14c) sera
-- traduit en code TypeScript dans lib/collecte/ lors de la prochaine phase.
-- =============================================================================
