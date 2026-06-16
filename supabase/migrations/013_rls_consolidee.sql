-- =============================================================================
-- Migration 013 : RLS consolidée — Référentiel Client Patrimonial
-- Dépend de   : migrations 007 à 012 (tables du module)
-- Idempotente : ENABLE ROW LEVEL SECURITY est un no-op si déjà activé ;
--               DROP POLICY IF EXISTS + CREATE POLICY réécrivent les policies
--               à l'identique si elles existent déjà.
-- =============================================================================
--
-- Rôle de cette migration :
--   1. Source unique de vérité pour toutes les politiques RLS du module patrimonial.
--   2. Ré-exécutable sans effet de bord — utile si des policies sont
--      accidentellement supprimées (rollback partiel, reset de schéma de dev).
--   3. Trace d'audit formelle : justifie chaque décision d'accès.
--
-- Résultat de l'audit de sécurité (cf. §13g) :
--   Aucune policy manquante sur les tables 007-012.
--   Aucune modification requise sur les tables existantes 001-006.
--   Le rôle anon n'a accès à aucune ligne du module (deny-by-default).
--
-- Modèle d'accès du module :
--
-- ┌──────────────────────────┬──────────────┬───────────────────────────┬────────────────────────────────────────┐
-- │ Table                    │ conseiller   │ client (authentifié)      │ Accès public (portail)                 │
-- ├──────────────────────────┼──────────────┼───────────────────────────┼────────────────────────────────────────┤
-- │ collecte_sessions        │ ALL          │ SELECT (propres)          │ service_role (soumission, statut)      │
-- │ questionnaire_versions   │ ALL          │ SELECT (toutes versions)  │ service_role (structure questionnaire) │
-- │ questionnaire_reponses   │ ALL          │ SELECT (propres sessions) │ service_role (saisie portail)          │
-- │ session_ecarts           │ ALL          │ aucun                     │ service_role (création post-soumission)│
-- │ documents_justificatifs  │ ALL          │ SELECT (propres)          │ service_role (upload portail)          │
-- │ patrimoine_snapshots     │ ALL          │ SELECT (finalisés)        │ aucun                                  │
-- └──────────────────────────┴──────────────┴───────────────────────────┴────────────────────────────────────────┘
--
-- Note sur le rôle anon :
--   Supabase accorde par défaut des droits table-niveau au rôle anon via
--   GRANT ... TO anon sur le schéma public. Ces droits sont neutralisés par le
--   RLS : en l'absence de policy explicite pour anon, PostgreSQL applique
--   deny-by-default et aucune ligne n'est lisible. Toutes les routes publiques
--   (portail questionnaire via kyc_token) utilisent service_role, qui contourne
--   le RLS et n'a pas besoin de policies.
--
-- Note sur service_role :
--   Le rôle service_role est un superutilisateur Supabase qui bypasse le RLS
--   par défaut (il est exempt de RLS sauf si FORCE ROW LEVEL SECURITY est
--   appliqué, ce qui n'est pas le cas ici). Pas de policy à créer pour lui.
--   Son usage est cantonné aux routes API serveur (Next.js App Router, route
--   handlers) qui gèrent elles-mêmes l'autorisation applicative.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 13a. collecte_sessions
-- (créée par migration 007)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Accès conseiller : ALL — le conseiller crée les sessions, les envoie, les
--   valide et les archive. Il peut corriger les données de session (dates,
--   périmètre, compteurs) directement depuis le back-office.
--
-- Accès client : SELECT uniquement.
--   Le client ne crée jamais de session directement — il reçoit un lien généré
--   par le conseiller. Sa lecture lui permet de voir l'état de sa demande dans
--   le portail (session.statut, session.perimetre).
--   snapshot_prefill est lisible par le client : il s'agit de ses propres
--   données patrimoniales (droit d'accès RGPD), non sensibles en lecture.
--
-- Accès portail public (anon via kyc_token) : service_role.
--   La route /api/collecte/session valide le token, lit la session et met à jour
--   le statut via service_role. Aucune policy anon requise.

ALTER TABLE collecte_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conseiller_all"  ON collecte_sessions;
CREATE POLICY "conseiller_all" ON collecte_sessions
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

DROP POLICY IF EXISTS "client_own_data" ON collecte_sessions;
CREATE POLICY "client_own_data" ON collecte_sessions
  FOR SELECT TO authenticated
  USING (get_user_role() = 'client' AND client_id = get_user_client_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 13b. questionnaire_versions
-- (créée par migration 008)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Accès conseiller : ALL — crée les brouillons, publie, archive.
--   Le trigger fn_guard_questionnaire_version (migration 008) enforce l'immuabilité
--   du contenu une fois publié. La policy est le verrou d'accès ; le trigger
--   est le verrou métier.
--
-- Accès client : SELECT sur toutes les versions.
--   Un client authentifié naviguant dans son portail peut avoir besoin de lire
--   la structure du questionnaire (libellés, sections, conditions d'affichage)
--   pour restituer le formulaire dans l'interface. Les brouillons sont
--   visibles mais non utilisables (seule la version active peut être liée à
--   une session — enforced par collecte_sessions.questionnaire_version_id et
--   la contrainte chk_actif_implique_publie).
--
-- Combinaison des policies (PostgreSQL : policies permissives combinées en OR) :
--   SELECT : (TRUE) OR (conseiller) = TRUE pour tous les authentifiés.
--   INSERT / UPDATE / DELETE : seul conseiller_write s'applique → conseillers.
--
-- Pattern identique à la table produits (migration 001, §12).

ALTER TABLE questionnaire_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read" ON questionnaire_versions;
CREATE POLICY "authenticated_read" ON questionnaire_versions
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "conseiller_write" ON questionnaire_versions;
CREATE POLICY "conseiller_write" ON questionnaire_versions
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');


-- ─────────────────────────────────────────────────────────────────────────────
-- 13c. questionnaire_reponses
-- (créée par migration 009)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Accès conseiller : ALL — saisie directe lors d'un entretien, correction avant
--   soumission, lecture des réponses soumises pour préparer la revue d'écarts.
--   Le trigger fn_guard_reponse_session (§9b) bloque INSERT / UPDATE / DELETE
--   après soumission, quelle que soit la policy.
--
-- Accès client : SELECT uniquement, restreint à ses propres sessions.
--   Sous-requête : la liste des sessions accessibles est filtrée par le RLS de
--   collecte_sessions lui-même (la policy client_own_data sur collecte_sessions
--   ne renvoie que les sessions du client courant). Pas de surface d'exposition
--   supplémentaire.
--   Pas de policy INSERT/UPDATE client : toutes les soumissions portail passent
--   par service_role (/api/collecte/reponses). Cohérent avec kyc_responses (001).

ALTER TABLE questionnaire_reponses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conseiller_all"  ON questionnaire_reponses;
CREATE POLICY "conseiller_all" ON questionnaire_reponses
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

DROP POLICY IF EXISTS "client_own_data" ON questionnaire_reponses;
CREATE POLICY "client_own_data" ON questionnaire_reponses
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'client'
    AND session_id IN (
      SELECT id FROM collecte_sessions
      WHERE client_id = get_user_client_id()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 13d. session_ecarts
-- (créée par migration 010)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Accès conseiller uniquement. Aucun accès client. Aucun accès anon.
--
-- Pourquoi aucun accès client ?
--   Les écarts sont un outil interne du workflow de validation conseiller.
--   Le client n'est pas informé du détail des écarts — il voit uniquement
--   le statut global de sa session (collecte_sessions.statut, qui lui est
--   accessible via la policy 13a). Cette séparation :
--   (a) préserve la capacité du conseiller à rejeter silencieusement certains
--       écarts sans ouvrir une discussion sur chaque champ ;
--   (b) évite d'exposer la logique de détection (entite_cible, colonne_cible,
--       valeur_reference) qui est une information métier interne.
--
-- INSERT via service_role :
--   L'algorithme de détection d'écarts (déclenché après session.statut → 'soumis')
--   s'exécute depuis une route API avec service_role, indépendamment de ce RLS.
--
-- DELETE et UPDATE encadrés par triggers :
--   fn_guard_ecart_delete bloque la suppression des écarts 'traite'.
--   fn_guard_ecart bloque la modification des champs de détection.
--   fn_log_ecart_delete trace toute suppression dans access_logs (SECURITY DEFINER,
--   contourne le RLS pour écrire dans access_logs même si l'acteur n'est pas
--   le propriétaire de la ligne).

ALTER TABLE session_ecarts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conseiller_all" ON session_ecarts;
CREATE POLICY "conseiller_all" ON session_ecarts
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');


-- ─────────────────────────────────────────────────────────────────────────────
-- 13e. documents_justificatifs
-- (créée par migration 011)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Accès conseiller : ALL — valider, rejeter, annoter, supprimer les documents.
--   Le conseiller peut modifier statut, notes et valide_le sans restriction
--   (pas de trigger de garde sur cette table — les documents ne sont pas
--   immuables, un rejet peut être ré-ouvert).
--
-- Accès client : SELECT uniquement sur ses propres documents.
--   Le client consulte ses documents transmis et leur statut (en_attente, valide,
--   rejete) depuis son portail. Il ne peut pas modifier statut ni notes.
--   Les uploads passent par service_role (/api/collecte/documents).
--
-- Justification du SELECT plutôt que INSERT pour le client :
--   Donner un INSERT client nécessiterait que le client puisse lui-même remplir
--   storage_path, ce qui implique une coordination avec Supabase Storage. La route
--   API (service_role) gère l'upload dans Storage et l'insertion en base de façon
--   atomique et contrôlée.

ALTER TABLE documents_justificatifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conseiller_all"  ON documents_justificatifs;
CREATE POLICY "conseiller_all" ON documents_justificatifs
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

DROP POLICY IF EXISTS "client_own_data" ON documents_justificatifs;
CREATE POLICY "client_own_data" ON documents_justificatifs
  FOR SELECT TO authenticated
  USING (get_user_role() = 'client' AND client_id = get_user_client_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 13f. patrimoine_snapshots
-- (créée par migration 012)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Accès conseiller : ALL — créer des brouillons, assembler le JSONB, finaliser.
--   Les triggers fn_guard_snapshot et fn_guard_snapshot_delete (§12b) sont la
--   vraie protection : ils bloquent toute modification ou suppression d'un
--   snapshot finalisé, même pour un conseiller. La policy donne l'accès ;
--   les triggers enforçent l'immuabilité post-finalisation.
--
-- Accès client : SELECT uniquement, restreint aux snapshots finalisés.
--   Pourquoi bloquer les brouillons pour le client ?
--   Un brouillon est un état intermédiaire d'assemblage qui peut être incomplet
--   (snapshot = '{}', checksum NULL). L'afficher ferait croire au client que son
--   bilan est vide ou en cours de traitement alors qu'il est simplement en cours
--   de génération serveur. Dès qu'un snapshot passe en 'finalise', il est complet,
--   intègre (checksum vérifié) et stable (immuable) — c'est l'état adéquat pour
--   une consultation client.
--   Note : les snapshots finalisés sont immuables (trigger), la lecture client
--   porte donc toujours sur des données stables.
--
-- Pas d'accès portail public :
--   Les snapshots ne sont jamais exposés dans le portail de saisie. Un client
--   authentifié peut les consulter dans son espace, mais aucun flux non-authentifié
--   n'y accède.

ALTER TABLE patrimoine_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conseiller_all" ON patrimoine_snapshots;
CREATE POLICY "conseiller_all" ON patrimoine_snapshots
  FOR ALL TO authenticated
  USING     (get_user_role() = 'conseiller')
  WITH CHECK (get_user_role() = 'conseiller');

DROP POLICY IF EXISTS "client_own_finalise" ON patrimoine_snapshots;
CREATE POLICY "client_own_finalise" ON patrimoine_snapshots
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'client'
    AND client_id = get_user_client_id()
    AND statut = 'finalise'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 13g. Audit des tables existantes (migrations 001-006)
-- Aucune modification SQL — section documentaire uniquement.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Les migrations 007-008 ont ajouté des colonnes à quatre tables existantes.
-- L'audit ci-dessous confirme que les policies existantes couvrent correctement
-- les nouvelles colonnes sans modification.
--
-- ── famille (+pays_naissance, +conjoint_pays_naissance, +conjoint_categorie_professionnelle)
--   Policy "conseiller_all" → FOR ALL → couvre automatiquement les nouvelles colonnes. ✓
--   Policy "client_own_data" → FOR SELECT → le client lit ses données y compris les
--   nouveaux champs pays (données personnelles RGPD, accès légitime). ✓
--   Aucune modification nécessaire.
--
-- ── fiscalite (+nombre_parts, +option_bareme)
--   Policy "conseiller_all" → FOR ALL → idem. ✓
--   Policy "client_own_data" → FOR SELECT → nombre_parts et option_bareme figurent
--   sur l'avis d'imposition : le client a le droit d'y accéder en lecture. ✓
--   NULL sur option_bareme (information non collectée) est visible en lecture — cohérent. ✓
--   Aucune modification nécessaire.
--
-- ── kyc_tokens (+collecte_session_id)
--   Policy "conseiller_all" → FOR ALL. ✓
--   Policy "client_own_data" → SELECT sur ses propres tokens.
--   Le champ collecte_session_id expose un UUID de session au client — information
--   technique non sensible (il ne peut pas en déduire d'autres sessions via ce
--   champ car son accès à collecte_sessions est déjà filtré par RLS). ✓
--   Aucune modification nécessaire.
--
-- ── objectifs (+collecte_session_id)
--   Policy "conseiller_all" → FOR ALL. ✓
--   Policy "client_own_data" → SELECT.
--   collecte_session_id est un lien technique permettant de retrouver la session
--   d'où provient cet objectif. Non sensible en lecture pour le client. ✓
--   Aucune modification nécessaire.
--
-- ── Autres tables (dossiers, dossier_etapes, actifs_financiers, passifs, etc.)
--   Non modifiées par les migrations 007-012. Politiques inchangées. ✓
--
-- ── access_logs
--   Policy "authenticated_insert" → INSERT pour tous les authentifiés. ✓
--   Policy "conseiller_read" → SELECT conseillers uniquement. ✓
--   La fonction fn_log_ecart_delete (migration 010) écrit dans access_logs via
--   SECURITY DEFINER — elle s'exécute en tant que propriétaire de la fonction
--   (postgres/superutilisateur), bypass complet du RLS. Les valeurs auth.uid()
--   et get_user_role() dans le corps de la fonction capturent l'identité de
--   l'utilisateur déclencheur original (pas du propriétaire de la fonction),
--   ce qui est le comportement PostgreSQL attendu. ✓
--   Aucune modification nécessaire.
--
-- Conclusion de l'audit 001-006 :
--   La conception FOR ALL / FOR SELECT des policies existantes couvre naturellement
--   toute nouvelle colonne ajoutée par ALTER TABLE. Aucune policy ne filtre au
--   niveau des colonnes (column-level security) — si cette granularité était
--   nécessaire, il faudrait créer des vues avec SECURITY INVOKER ou des column
--   privileges explicites (cas non rencontré dans ce module).


-- ─────────────────────────────────────────────────────────────────────────────
-- PLAN DE ROLLBACK
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Cette migration ne modifie que des policies RLS (DROP + CREATE idempotents).
-- Elle ne modifie aucune table, aucune fonction, aucun trigger, aucune donnée.
--
-- Option A — rollback complet du module :
--   Ré-exécuter les sections RLS des migrations 007 à 012 dans l'ordre.
--   Le résultat est identique à la migration 013 (même policies).
--
-- Option B — suppression ciblée d'une policy modifiée :
--   Si une policy de cette migration devait remplacer une ancienne version
--   différente (cas non applicable ici — toutes les policies sont identiques
--   à celles de 007-012), exécuter les DROP POLICY IF EXISTS ciblés et
--   recréer la policy de la migration précédente.
--
-- Option C — reset complet du RLS du module (urgence) :
--   DROP POLICY IF EXISTS sur chaque policy listée dans ce fichier,
--   puis re-run 013 pour restaurer. Les données sont préservées.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FICHIERS MODIFIÉS
-- ─────────────────────────────────────────────────────────────────────────────
-- + supabase/migrations/013_rls_consolidee.sql  (ce fichier — nouveau)
--
-- Aucun fichier applicatif (lib/, app/, components/) n'est modifié :
-- le RLS est transparent pour l'application — les routes qui utilisent
-- service_role continuent à bypasser le RLS ; les routes qui utilisent
-- le client authentifié bénéficient automatiquement des nouvelles policies.
-- =============================================================================
