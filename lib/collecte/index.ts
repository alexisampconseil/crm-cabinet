// Surface publique du module Référentiel Client Patrimonial — Collecte.
// Importer depuis '@/lib/collecte' plutôt que depuis les sous-modules directement.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  // Session
  CollecteSessionStatut,
  CollecteSessionPerimetre,
  CollecteSession,
  CollecteSessionCreate,
  CreeSessionParams,
  OuvrirSessionResult,
  // Questionnaire versions
  QuestionnaireVersionStatut,
  QuestionnaireVersion,
  QuestionnaireStructure,
  QuestionnaireBloc,
  QuestionnaireQuestion,
  QuestionnaireCondition,
  // Réponses
  QuestionnaireReponseBloc,
  QuestionnaireReponseType,
  QuestionnaireReponsePortee,
  QuestionnaireReponseSaisiPar,
  QuestionnaireReponse,
  QuestionnaireReponseInput,
  // Écarts (phase 2)
  SessionEcartStatut,
  SessionEcartTypeEcart,
  SessionEcartNiveauImpact,
  SessionEcart,
  // Documents
  DocumentJustificatifType,
  DocumentJustificatifStatut,
  DocumentJustificatif,
  // Snapshots
  PatrimoineSnapshotDeclencheur,
  PatrimoineSnapshotStatut,
  PatrimoineSnapshot,
  // JSONB snapshot_prefill
  SnapshotPrefill,
  SnapshotPrefillIdentite,
  SnapshotPrefillConjoint,
  SnapshotPrefillEnfant,
  SnapshotPrefillFoyer,
  SnapshotPrefillPersonnePro,
  SnapshotPrefillSituationPro,
  SnapshotPrefillActif,
  SnapshotPrefillImmobilier,
  SnapshotPrefillPassif,
  SnapshotPrefillBudgetPoste,
  SnapshotPrefillBudget,
  SnapshotPrefillFiscalite,
  SnapshotPrefillContratPrevoyance,
  SnapshotPrefillPrevoyance,
  SnapshotPrefillObjectif,
} from './types'

// ── Services ──────────────────────────────────────────────────────────────────
export { creerSession } from './services/session'
export { ouvrirSession } from './services/envoi'
export { buildSnapshotPrefill } from './services/prefill'

// ── Repository — sessions ─────────────────────────────────────────────────────
export {
  getSession,
  getSessionsByClient,
  getSessionsEnRevue,
  getSessionActive,
  createSession,
  updateSessionPrefillEtStatut,
  updateStatut,
  recalculerCompteurs,
} from './repository/sessions'

// ── Repository — versions ─────────────────────────────────────────────────────
export {
  getVersionActive,
  getVersionById,
  getVersions,
} from './repository/versions'

// ── Repository — réponses ─────────────────────────────────────────────────────
export {
  getReponsesBySession,
  getReponsesByBloc,
  getReponsesByGroupe,
  upsertReponse,
  deleteReponse,
  deleteReponsesByGroupe,
} from './repository/reponses'
