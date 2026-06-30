// Surface publique du module Référentiel Client Patrimonial — Collecte.
// Importer depuis '@/lib/collecte' plutôt que depuis les sous-modules directement.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  // Session
  CollecteSessionStatut,
  CollecteSessionPerimetre,
  CollecteSessionType,
  CollecteSessionCanal,
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
  QuestionnaireOption,
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
  SnapshotPrefillDetail,
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
export { buildSnapshotPrefill, computeSnapshotChecksum } from './services/prefill'
export type { SnapshotChecksumInput } from './services/prefill'
export { buildCollecteUrl } from './url'
export type { BuildCollecteUrlOptions, BuildCollecteUrlResult } from './url'
export { detecterEcarts } from './services/detection'
export type { DetectionResult } from './services/detection'

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

// ── Repository — écarts ───────────────────────────────────────────────────────
export {
  getEcartsBySession,
  deciderEcart,
  deciderGroupeEcarts,
  countEcartsARevoir,
} from './repository/ecarts'

// ── Service — snapshot finalisé ──────────────────────────────────────────────
export { creerSnapshotFinalise } from './services/snapshot'
export type { CreerSnapshotFinaliseParams } from './services/snapshot'

// ── Service — application au référentiel (Phase 7) ───────────────────────────
export { appliquerEcarts } from './services/application'
export type { ApplicationResult } from './services/application'
export type { ColonneType, MappingEntry } from './mapping'
export { NIVEAU_IMPACT_AJOUT, CHAMPS_REQUIS_AJOUT, COLONNES_OBLIGATOIRES_INSERT } from './mapping'
