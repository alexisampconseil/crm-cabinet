// =============================================================================
// Types TypeScript — module Référentiel Client Patrimonial / Collecte
// Couvre les 6 tables : collecte_sessions, questionnaire_versions,
// questionnaire_reponses, session_ecarts, documents_justificatifs,
// patrimoine_snapshots — ainsi que les structures JSONB associées.
// =============================================================================

// ── collecte_sessions ─────────────────────────────────────────────────────────

export type CollecteSessionStatut =
  | 'brouillon'
  | 'en_cours'
  | 'soumis'
  | 'en_revue'
  | 'valide'
  | 'archive'

export type CollecteSessionPerimetre = 'client_seul' | 'foyer'

export type CollecteSessionType =
  | 'bilan_initial'
  | 'mise_a_jour'
  | 'pre_conseil'
  | 'verification_annuelle'

export type CollecteSessionCanal =
  | 'portail_client'
  | 'entretien'
  | 'import_manuel'

export interface CollecteSession {
  id: string
  client_id: string
  type: CollecteSessionType
  canal: CollecteSessionCanal
  perimetre: CollecteSessionPerimetre
  statut: CollecteSessionStatut
  snapshot_prefill: SnapshotPrefill | null
  questionnaire_version_id: string | null
  kyc_token_id: string | null
  nb_ecarts_detectes: number
  nb_ecarts_traites: number
  date_ouverture: string | null
  date_soumission: string | null
  date_validation: string | null
  notes_conseiller: string | null
  created_at: string
  updated_at: string
}

export interface CollecteSessionCreate {
  client_id: string
  type?: CollecteSessionType
  canal?: CollecteSessionCanal
  perimetre?: CollecteSessionPerimetre
  notes_conseiller?: string
}

// ── questionnaire_versions ────────────────────────────────────────────────────

export type QuestionnaireVersionStatut = 'brouillon' | 'publie' | 'archive'

export type QuestionnaireReponseBloc =
  | 'identite'
  | 'foyer'
  | 'situation_pro'
  | 'revenus'
  | 'charges'
  | 'actifs_financiers'
  | 'immobilier'
  | 'passifs'
  | 'fiscalite'
  | 'prevoyance'
  | 'objectifs'

export type QuestionnaireReponseType =
  | 'texte'
  | 'nombre'
  | 'date'
  | 'booleen'
  | 'liste'
  | 'multi_liste'

export type QuestionnaireReponsePortee = 'client' | 'conjoint' | 'foyer'

export interface QuestionnaireCondition {
  champ: string
  // 'in' : valeur doit être un tableau de chaînes — vrai si la valeur actuelle
  // appartient au tableau. Nécessaire pour conditionner un champ sur plusieurs
  // catégories à la fois (ex : régime fiscal affiché pour tns/bic/bnc/ba/fonciers).
  operateur: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in'
  valeur: string | number | boolean | string[]
  // Portée de la question référencée par `champ`. Optionnel — défaut 'client'
  // (comportement historique v1.0/v1.1, où toutes les conditions ciblaient des
  // questions portee='client'). Nécessaire en v1.2 pour conditionner un champ
  // sur une question portee='foyer' (ex : date_contrat_mariage sur contrat_mariage).
  portee?: QuestionnaireReponsePortee
}

export interface QuestionnaireQuestion {
  code: string
  libelle: string
  type: QuestionnaireReponseType
  portee: QuestionnaireReponsePortee
  obligatoire: boolean
  repete: boolean
  placeholder?: string
  // Chemin de préremplissage dans snapshot_prefill.
  // Pour les questions non-répétables : chemin absolu depuis la racine,
  //   ex : "identite.nom", "fiscalite.tranche_ir".
  // Pour les questions répétables (repete=true) : chemin relatif à l'item courant,
  //   ex : "item.libelle", "item.montant".
  prefill_path?: string
  // Valeurs proposées pour les types "liste" et "multi_liste".
  // Stockées dans le JSONB de la version pour que le questionnaire soit autonome.
  // Deux formats coexistent :
  //   - string[]                         : ancien format (v1.0/v1.1) — la valeur
  //     technique sert aussi de libellé affiché (acronymes bruts type "AV", "CTO").
  //   - QuestionnaireOption[]             : nouveau format (v1.2+) — value/label
  //     séparés, libellé toujours explicite côté client.
  // Chaque version de questionnaire est figée dans questionnaire_versions.structure
  // au moment de l'ouverture de session — une session v1.1 ouverte continue de
  // fournir l'ancien format indéfiniment. SelectField/MultiSelectField doivent
  // accepter les deux formats sans erreur (rétrocompatibilité obligatoire).
  options?: string[] | QuestionnaireOption[]
  conditions: QuestionnaireCondition[]
}

export interface QuestionnaireOption {
  value: string
  label: string
}

export interface QuestionnaireBloc {
  code: QuestionnaireReponseBloc
  libelle: string
  ordre: number
  repete: boolean
  // Chemin dans snapshot_prefill vers le tableau source des instances répétables.
  // Présent sur les blocs repete=true ET sur les blocs mixtes (repete=false avec
  // des questions repete=true à l'intérieur, ex: foyer.enfants, prevoyance.contrats).
  // Convention : chemin dot depuis la racine de SnapshotPrefill.
  repete_source?: string
  questions: QuestionnaireQuestion[]
}

export interface QuestionnaireStructure {
  blocs: QuestionnaireBloc[]
}

export interface QuestionnaireVersion {
  id: string
  version: string
  libelle: string
  description: string | null
  version_schema: string
  structure: QuestionnaireStructure
  statut: QuestionnaireVersionStatut
  actif: boolean
  date_publication: string | null
  publie_par: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── questionnaire_reponses ────────────────────────────────────────────────────

export type QuestionnaireReponseSaisiPar = 'client' | 'conseiller'

export interface QuestionnaireReponse {
  id: string
  session_id: string
  bloc: QuestionnaireReponseBloc
  question_code: string
  portee: QuestionnaireReponsePortee
  groupe_instance_id: string | null
  reponse_type: QuestionnaireReponseType
  reponse_valeur: string | null
  reponse_metadata: Record<string, unknown>
  questionnaire_version_id: string | null
  version_questionnaire: string | null
  saisi_par: QuestionnaireReponseSaisiPar
  created_at: string
  updated_at: string
}

export interface QuestionnaireReponseInput {
  session_id: string
  bloc: QuestionnaireReponseBloc
  question_code: string
  portee: QuestionnaireReponsePortee
  groupe_instance_id?: string | null
  reponse_type: QuestionnaireReponseType
  reponse_valeur?: string | null
  reponse_metadata?: Record<string, unknown>
  questionnaire_version_id?: string | null
  version_questionnaire?: string | null
  saisi_par: QuestionnaireReponseSaisiPar
}

// ── session_ecarts ────────────────────────────────────────────────────────────
// Types déclarés maintenant pour la complétude ; services en phase 2.

export type SessionEcartStatut = 'a_revoir' | 'accepte' | 'rejete' | 'traite'
export type SessionEcartTypeEcart = 'modification' | 'ajout' | 'suppression'
export type SessionEcartNiveauImpact = 'faible' | 'moyen' | 'fort' | 'critique'

export interface SessionEcart {
  id: string
  session_id: string
  reponse_id: string | null
  bloc: QuestionnaireReponseBloc
  question_code: string
  portee: QuestionnaireReponsePortee
  groupe_instance_id: string | null
  entite_cible: string
  colonne_cible: string | null
  entite_id: string | null
  type_ecart: SessionEcartTypeEcart
  valeur_reference: Record<string, unknown> | null
  valeur_proposee: Record<string, unknown> | null
  libelle_lisible: string
  niveau_impact: SessionEcartNiveauImpact
  niveau_impact_override: SessionEcartNiveauImpact | null
  override_motif: string | null
  statut: SessionEcartStatut
  motif_rejet: string | null
  decide_par: string | null
  decide_le: string | null
  applique_le: string | null
  created_at: string
  updated_at: string
}

// ── documents_justificatifs ───────────────────────────────────────────────────

export type DocumentJustificatifType =
  | 'avis_imposition'
  | 'bulletin_paie'
  | 'releve_bancaire'
  | 'releve_actif'
  | 'titre_propriete'
  | 'acte_notarie'
  | 'attestation_employeur'
  | 'justificatif_identite'
  | 'justificatif_domicile'
  | 'autre'

export type DocumentJustificatifStatut = 'en_attente' | 'valide' | 'rejete' | 'expire'

export interface DocumentJustificatif {
  id: string
  client_id: string
  session_id: string | null
  type: DocumentJustificatifType
  annee_reference: number | null
  date_document: string | null
  portee: QuestionnaireReponsePortee
  storage_path: string | null
  url: string | null
  nom_fichier: string | null
  mime_type: string | null
  taille_octets: number | null
  statut: DocumentJustificatifStatut
  notes: string | null
  valide_par: string | null
  valide_le: string | null
  created_at: string
  updated_at: string
}

// ── patrimoine_snapshots ──────────────────────────────────────────────────────

export type PatrimoineSnapshotDeclencheur =
  | 'validation_session'
  | 'bilan_annuel'
  | 'pre_recommandation'
  | 'manuel'

export type PatrimoineSnapshotStatut = 'brouillon' | 'finalise'

export interface PatrimoineSnapshot {
  id: string
  client_id: string
  session_id: string | null
  type_declencheur: PatrimoineSnapshotDeclencheur
  version_schema: string
  statut: PatrimoineSnapshotStatut
  snapshot: SnapshotPrefill
  checksum: string | null
  genere_par: string | null
  genere_le: string | null
  created_at: string
}

// ── JSONB : structure de snapshot_prefill / snapshot ─────────────────────────
// Utilisée à la fois par collecte_sessions.snapshot_prefill (baseline de
// comparaison) et par patrimoine_snapshots.snapshot (bilan finalisé).
// Chaque item de tableau inclut son id (UUID de la table source) afin que
// la détection d'écarts (phase 2) sache quelle ligne référentielle cibler.

export interface SnapshotPrefillIdentite {
  nom: string | null
  prenom: string | null
  date_naissance: string | null
  nationalite: string | null
  pays_naissance: string | null
  lieu_naissance: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  email: string | null
  telephone: string | null
}

export interface SnapshotPrefillConjoint {
  nom: string | null
  prenom: string | null
  profession: string | null
  employeur: string | null
  categorie_professionnelle: string | null
  pays_naissance: string | null
  lieu_naissance: string | null
  email: string | null
  telephone: string | null
}

export interface SnapshotPrefillEnfant {
  id: string
  prenom: string
  nom: string | null
  date_naissance: string | null
  a_charge: boolean
  filiation: string | null
}

export interface SnapshotPrefillFoyer {
  situation: string | null
  regime_matrimonial: string | null
  date_mariage: string | null
  contrat_mariage: boolean | null
  date_contrat_mariage: string | null
  donation_dernier_vivant: boolean | null
  regime_pacs: string | null
  date_pacs: string | null
  conjoint: SnapshotPrefillConjoint | null
  enfants: SnapshotPrefillEnfant[]
}

export interface SnapshotPrefillPersonnePro {
  profession: string | null
  employeur: string | null
  categorie: string | null
}

export interface SnapshotPrefillSituationPro {
  client: SnapshotPrefillPersonnePro
  conjoint: SnapshotPrefillPersonnePro | null
}

// detail JSONB — démembrement (mode_detention, age_usufruitier, date_demembrement,
// type_demembrement, lien_usufruitier), typologie physique du bien (type_bien),
// et tout champ complémentaire conditionnel. Structure libre, non typée finement
// ici — résolue par chemin pointé via mapping.ts (cf. application.ts/detection.ts).
export type SnapshotPrefillDetail = Record<string, unknown>

export interface SnapshotPrefillActif {
  id: string
  nature: string
  libelle: string
  montant: number | null
  souscrit_par: string | null
  date_souscription: string | null
  detail: SnapshotPrefillDetail
}

export interface SnapshotPrefillImmobilier {
  id: string
  nature: string
  valeur: number | null
  detenu_par: string | null
  revenus_annuels: number | null
  date_acquisition: string | null
  quote_part_detenue: number | null
  detail: SnapshotPrefillDetail
}

export interface SnapshotPrefillPassif {
  id: string
  nature: string
  banque: string | null
  montant: number | null
  capital_restant_du: number | null
  mensualite: number | null
  taux: number | null
  detail: SnapshotPrefillDetail
}

export interface SnapshotPrefillBudgetPoste {
  id: string
  libelle: string
  montant_annuel: number | null
  nature: string | null
  detail: SnapshotPrefillDetail
}

export interface SnapshotPrefillBudget {
  revenus: SnapshotPrefillBudgetPoste[]
  charges: SnapshotPrefillBudgetPoste[]
  solde_annuel: number
}

export interface SnapshotPrefillFiscalite {
  tranche_ir: string | null
  revenu_fiscal: number | null
  nombre_parts: number | null
  option_bareme: boolean | null
  ifi: number | null
  dispositifs: string[]
}

export interface SnapshotPrefillContratPrevoyance {
  id: string
  nature: string
  compagnie: string | null
  montant: number | null
}

export interface SnapshotPrefillPrevoyance {
  testament: boolean
  droits_retraite_estimes: number | null
  contrats: SnapshotPrefillContratPrevoyance[]
}

export interface SnapshotPrefillObjectif {
  id: string
  libelle: string
  horizon: string | null
  montant_cible: number | null
  priorite: number
}

export interface SnapshotPrefill {
  version_schema: string
  date_reference: string
  identite: SnapshotPrefillIdentite
  foyer: SnapshotPrefillFoyer
  situation_professionnelle: SnapshotPrefillSituationPro
  patrimoine_financier: SnapshotPrefillActif[]
  patrimoine_immobilier: SnapshotPrefillImmobilier[]
  passifs: SnapshotPrefillPassif[]
  budget: SnapshotPrefillBudget
  fiscalite: SnapshotPrefillFiscalite
  prevoyance: SnapshotPrefillPrevoyance
  objectifs: SnapshotPrefillObjectif[]
}

// ── Types d'entrée pour les services ─────────────────────────────────────────

export interface CreeSessionParams {
  clientId: string
  type?: CollecteSessionType
  canal?: CollecteSessionCanal
  perimetre?: CollecteSessionPerimetre
  notes_conseiller?: string
}

export interface OuvrirSessionResult {
  session: CollecteSession
  prefill: SnapshotPrefill
}
