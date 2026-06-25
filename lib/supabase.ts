import { createBrowserClient, createServerClient } from '@supabase/ssr'

// ============================================================
// TYPES TYPESCRIPT — toutes les tables
// ============================================================

export type Role = 'conseiller' | 'client'
export type ClientStatut = 'prospect' | 'client' | 'inactif' | 'archive'
export type ClientProfil = 'prudent' | 'equilibre' | 'dynamique' | 'agressif'
export type KycStatus = 'non_fait' | 'en_cours' | 'complet' | 'a_renouveler'
export type KycContexte = 'prospect' | 'maj_annuelle' | 'modif_situation'
export type DossierStatut = 'en_cours' | 'suspendu' | 'cloture' | 'annule'
export type EtapeStatut = 'pending' | 'en_cours' | 'valide' | 'bloque'

// ── Gouvernance Produits ────────────────────────────────────────────────────

export type CategorieReglementaire =
  | 'OPCVM'
  | 'FIA'
  | 'assurance_vie'
  | 'capitalisation'
  | 'per_individuel'
  | 'per_collectif'
  | 'scpi'
  | 'opci'
  | 'produit_structure'
  | 'autre'

export type StatutDocumentProduit = 'actif' | 'archive' | 'expire'
export type StatutConformite     = 'conforme' | 'en_revision' | 'suspendu' | 'non_conforme'
export type StatutValidation     = 'a_valider' | 'valide' | 'a_revoir'
export type SourceMarcheCible    = 'emetteur' | 'deduit_ia' | 'manuel'
export type FrequenceRevue       = 'trimestrielle' | 'semestrielle' | 'annuelle'

export type ConnaissanceMC    = 'basique' | 'informe' | 'expert'
export type ExperienceMC      = 'faible' | 'moyenne' | 'elevee'
export type CapacitePertesMC  = 'aucune_perte' | 'pertes_limitees' | 'perte_capital' | 'pertes_superieures'
export type ToleranceRisqueMC = 'tres_faible' | 'faible' | 'moyenne' | 'elevee' | 'tres_elevee'
export type HorizonMC         = 'moins_2_ans' | 'entre_2_et_5_ans' | 'plus_5_ans'
export type SensibiliteESGMC  = 'aucune' | 'moderee' | 'forte'

export interface UserRole {
  id: string
  user_id: string
  role: Role
  client_id: string | null
  created_at: string
}

export interface Client {
  id: string
  code: string | null
  nom: string
  prenom: string
  email: string | null
  telephone: string | null
  ville: string | null
  statut: ClientStatut
  profil: ClientProfil | null
  encours: number
  dernier_contact: string | null
  kyc_status: KycStatus
  kyc_submitted_at: string | null
  derniere_relance: string | null
  avatar: string | null
  updated_at: string
  created_at: string
}

export interface Famille {
  id: string
  client_id: string
  civilite: 'M.' | 'Mme' | 'Dr' | 'Pr' | null
  nom: string | null
  prenom: string | null
  lieu_naissance: string | null
  code_postal_naissance: string | null
  date_naissance: string | null
  nationalite: string | null
  situation: 'celibataire' | 'marie' | 'pacse' | 'concubinage' | 'divorce' | 'veuf' | null
  regime_matrimonial: 'communaute_reduite' | 'separation_biens' | 'participation_acquets' | 'communaute_universelle' | 'NA' | null
  date_union: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  email: string | null
  telephone: string | null
  profession: string | null
  employeur: string | null
  categorie_professionnelle: string | null
  conjoint_civilite: string | null
  conjoint_nom: string | null
  conjoint_prenom: string | null
  conjoint_date_naissance: string | null
  conjoint_lieu_naissance: string | null
  conjoint_nationalite: string | null
  conjoint_profession: string | null
  conjoint_employeur: string | null
  conjoint_email: string | null
  conjoint_telephone: string | null
  conjoint_categorie_professionnelle: string | null
  pays_naissance: string | null
  conjoint_pays_naissance: string | null
  created_at: string
  updated_at: string
}

export interface Enfant {
  id: string
  client_id: string
  prenom: string
  nom: string | null
  date_naissance: string | null
  a_charge: boolean
  filiation: 'commun' | 'client' | 'conjoint' | 'adoption' | null
}

export interface Objectif {
  id: string
  client_id: string
  libelle: string
  horizon: 'court_terme' | 'moyen_terme' | 'long_terme' | 'retraite' | null
  profil_risque: ClientProfil | null
  besoin_liquidites: 'faible' | 'moyen' | 'fort' | 'tres_fort' | null
  montant_cible: number | null
  priorite: number
  collecte_session_id: string | null
  created_at: string
}

export interface ActifFinancier {
  id: string
  client_id: string
  nature: 'AV' | 'PER' | 'SCPI' | 'Capitalisation' | 'PEA' | 'CTO' | 'Livret' | 'CompteCourant' | 'PrivateEquity' | 'Autre'
  libelle: string
  montant: number | null
  souscrit_par: 'client' | 'conjoint' | 'commun' | null
  date_souscription: string | null
  detail: Record<string, unknown>
  created_at: string
}

export interface BienImmobilier {
  id: string
  client_id: string
  nature: 'RP' | 'RS' | 'Locatif' | 'LocatifNu' | 'LocatifMeuble' | 'SCI' | 'Terrain' | 'Autre'
  valeur: number | null
  detenu_par: 'client' | 'conjoint' | 'commun' | 'SCI' | null
  mode_detention: string | null
  revenus_annuels: number | null
  fiscalite: string | null
  detail: Record<string, unknown>
  created_at: string
}

export interface Passif {
  id: string
  client_id: string
  nature: 'immobilier' | 'consommation' | 'professionnel' | 'autre'
  banque: string | null
  montant: number | null
  duree: number | null
  taux: number | null
  mensualite: number | null
  detail: Record<string, unknown>
  created_at: string
}

export interface BudgetPoste {
  id: string
  client_id: string
  type: 'revenu' | 'charge'
  libelle: string
  montant_annuel: number | null
}

export interface Fiscalite {
  id: string
  client_id: string
  tranche_ir: '0' | '11' | '30' | '41' | '45' | null
  revenu_fiscal: number | null
  ifi: number | null
  nombre_parts: number | null
  option_bareme: boolean | null
  dispositifs: string[]
  created_at: string
  updated_at: string
}

export interface Prevoyance {
  id: string
  client_id: string
  testament: boolean
  droits_retraite_estimes: number | null
  detail: string | null
  created_at: string
  updated_at: string
}

export interface ContratPrevoyance {
  id: string
  client_id: string
  nature: 'deces' | 'incapacite' | 'invalidite' | 'dependance' | 'sante' | 'autre'
  compagnie: string | null
  montant: number | null
  detail: Record<string, unknown>
  created_at: string
}

export interface Dossier {
  id: string
  client_id: string
  titre: string
  statut: DossierStatut
  progression: number
  created_at: string
  updated_at: string
}

export interface DossierEtape {
  id: string
  dossier_id: string
  libelle: string
  statut: EtapeStatut
  date: string | null
  ordre: number
}

export interface DocumentReglementaire {
  id: string
  client_id: string
  type: 'LM' | 'DER' | 'FICI' | 'CRS' | 'LAB' | 'DICI' | 'autre'
  date_realisation: string | null
  url: string | null
  created_at: string
}

export interface Produit {
  id: string
  nom: string
  societe_gestion: string | null
  categorie: 'AV' | 'SCPI' | 'PER' | 'Capitalisation'
  categorie_reglementaire: CategorieReglementaire | null
  isin: string | null
  frais_entree: number | null
  frais_gestion: number | null
  frais_sortie: number | null
  duree_detention_min: number | null
  date_agrement: string | null
  encours_geres: number | null
  sri: number | null
  rendement_n1: number | null
  rendement_3ans: number | null
  ratio_sharpe_3ans: number | null
  dici_url: string | null
  description_ia: string | null
  commentaire_sri_ia: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface ProduitDocument {
  id: string
  produit_id: string
  type: 'DICI' | 'Brochure' | 'Rapport' | 'Autre'
  url: string | null
  date_document: string | null
  version: string | null
  statut: StatutDocumentProduit
  date_expiration: string | null
  storage_path: string | null
}

export interface KycToken {
  id: string
  token: string
  client_id: string
  expires_at: string
  used_at: string | null
  contexte: KycContexte
  collecte_session_id: string | null
  created_at: string
}

export interface KycResponse {
  id: string
  client_id: string
  token: string | null
  responses: Record<string, unknown>
  submitted_at: string
}

export interface Message {
  id: string
  client_id: string
  expediteur: 'conseiller' | 'client'
  contenu: string
  lu: boolean
  created_at: string
}

export interface AccessLog {
  id: string
  user_id: string | null
  role: string | null
  action: string
  resource: string | null
  ip: string | null
  created_at: string
}

// ── Sous-types JSONB — Gouvernance Produits ─────────────────────────────────

export interface ExtraitSource {
  document_id: string
  page: number | null
  texte: string
}

export interface JustificationIA {
  connaissance?: string
  experience?: string
  capacite_pertes?: string
  tolerance_risque?: string
  horizon?: string
  sensibilite_esg?: string
}

export interface MappingIADimension {
  valeur_source: string | null
  valeur_normalisee: string | null
  confiance: number | null
  justification: string | null
}

export interface MappingIAMarche {
  connaissance?: MappingIADimension
  experience?: MappingIADimension
  capacite_pertes?: MappingIADimension
  tolerance_risque?: MappingIADimension
  horizon?: MappingIADimension
  sensibilite_esg?: MappingIADimension
}

export interface MappingIA {
  positif: MappingIAMarche
  negatif: MappingIAMarche
}

export type EmetteurBrut = Record<string, unknown>

// ── Interface principale : produits_gouvernance ──────────────────────────────

export interface ProduitGouvernance {
  id: string
  produit_id: string

  statut_conformite: StatutConformite

  // Marché cible source (brut)
  mc_emetteur_texte: string | null
  mc_emetteur_brut: EmetteurBrut | null

  // Marché cible positif — référentiel interne
  mc_pos_connaissance: ConnaissanceMC | null
  mc_pos_experience: ExperienceMC | null
  mc_pos_capacite_pertes: CapacitePertesMC | null
  mc_pos_tolerance_risque: ToleranceRisqueMC | null
  mc_pos_horizon: HorizonMC | null
  mc_pos_sensibilite_esg: SensibiliteESGMC | null

  // Marché cible négatif — référentiel interne
  mc_neg_connaissance: ConnaissanceMC | null
  mc_neg_experience: ExperienceMC | null
  mc_neg_capacite_pertes: CapacitePertesMC | null
  mc_neg_tolerance_risque: ToleranceRisqueMC | null
  mc_neg_horizon: HorizonMC | null
  mc_neg_sensibilite_esg: SensibiliteESGMC | null

  // Champs narratifs
  public_exclu: string | null
  conditions_acces: string | null
  conflits_interet: string | null
  notes_gouvernance: string | null
  document_gouvernance_url: string | null

  // Revues périodiques
  frequence_revue: FrequenceRevue | null
  date_derniere_revue: string | null
  date_prochaine_revue: string | null
  responsable_revue: string | null
  alerte_revue: boolean

  // Traçabilité IA
  source_marche_cible: SourceMarcheCible
  source_document_id: string | null
  extraits_sources: ExtraitSource[] | null
  justifications_ia: JustificationIA | null
  mapping_ia: MappingIA | null
  score_confiance_ia: number | null
  date_analyse_ia: string | null
  modele_ia: string | null

  // Validation
  statut_validation: StatutValidation
  motif_signalement: string | null
  valide_par: string | null
  valide_le: string | null

  created_at: string
  updated_at: string
}

// ── Extraction documentaire ─────────────────────────────────────────────────

export type StatutAnalyseIA = 'en_attente' | 'en_cours' | 'analyse_terminee' | 'erreur'
export type ExtractionMethode = 'pdf_parse' | 'pdfjs' | 'ocr' | 'manuel' | 'autre'

export interface DocumentExtrait {
  id: string
  document_id: string
  texte_extrait: string
  nb_pages: number | null
  hash_fichier: string | null
  extraction_methode: ExtractionMethode | null
  date_extraction: string
  statut_analyse: StatutAnalyseIA
  gouvernance_id: string | null
  modele_ia: string | null
  version_prompt: string | null
  date_analyse_ia: string | null
  tokens_entree: number | null
  tokens_sortie: number | null
  analyse_resultat_brut: Record<string, unknown> | null
  erreur_analyse: string | null
  created_at: string
}

// ── Interface historique : produits_gouvernance_historique ───────────────────

export interface ProduitGouvernanceHistorique {
  id: string
  gouvernance_id: string
  produit_id: string
  snapshot: ProduitGouvernance
  modifie_par: string | null
  modifie_le: string
  motif: string | null
  statut_conformite_avant: StatutConformite | null
  statut_conformite_apres: StatutConformite | null
  statut_validation_avant: StatutValidation | null
  statut_validation_apres: StatutValidation | null
}

// ============================================================
// FACTORIES CLIENT SUPABASE
// ============================================================

// Client navigateur — à utiliser dans les Client Components
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Client serveur — Server Components et Route Handlers uniquement
// Import dynamique de next/headers pour ne pas polluer le bundle client
export async function createServerSupabase() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

// ============================================================
// HELPER : résolution sécurisée du clientId
// Le conseiller peut accéder à n'importe quel client.
// Le client ne peut accéder qu'à son propre dossier.
// ============================================================

export async function resolveClientId(requestedClientId: string): Promise<string> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  if (!userRole) throw new Error('Rôle introuvable')

  if (userRole.role === 'conseiller') return requestedClientId

  if (userRole.role === 'client') {
    if (userRole.client_id !== requestedClientId) throw new Error('Accès refusé')
    return userRole.client_id!
  }

  throw new Error('Rôle inconnu')
}

// ============================================================
// CRUD — CLIENTS
// ============================================================

export async function getClients() {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('nom', { ascending: true })
  if (error) throw error
  return data as Client[]
}

export async function getClient(id: string) {
  const clientId = await resolveClientId(id)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  if (error) throw error
  return data as Client
}

export async function createClient(input: Omit<Client, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('clients')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as Client
}

export async function updateClient(id: string, input: Partial<Omit<Client, 'id' | 'created_at'>>) {
  const clientId = await resolveClientId(id)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('clients')
    .update(input)
    .eq('id', clientId)
    .select()
    .single()
  if (error) throw error
  return data as Client
}

// ============================================================
// CRUD — FAMILLE
// ============================================================

export async function getFamille(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('famille')
    .select('*')
    .eq('client_id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as Famille | null
}

export async function upsertFamille(clientId: string, input: Partial<Omit<Famille, 'id' | 'client_id' | 'created_at' | 'updated_at'>>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('famille')
    .upsert({ ...input, client_id: id }, { onConflict: 'client_id' })
    .select()
    .single()
  if (error) throw error
  return data as Famille
}

// ============================================================
// CRUD — ENFANTS
// ============================================================

export async function getEnfants(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('enfants')
    .select('*')
    .eq('client_id', id)
  if (error) throw error
  return data as Enfant[]
}

export async function addEnfant(clientId: string, input: Omit<Enfant, 'id' | 'client_id'>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('enfants')
    .insert({ ...input, client_id: id })
    .select()
    .single()
  if (error) throw error
  return data as Enfant
}

export async function deleteEnfant(id: string) {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('enfants').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CRUD — OBJECTIFS
// ============================================================

export async function getObjectifs(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('objectifs')
    .select('*')
    .eq('client_id', id)
    .order('priorite')
  if (error) throw error
  return data as Objectif[]
}

export async function addObjectif(clientId: string, input: Omit<Objectif, 'id' | 'client_id' | 'created_at'>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('objectifs')
    .insert({ ...input, client_id: id })
    .select()
    .single()
  if (error) throw error
  return data as Objectif
}

export async function updateObjectif(id: string, input: Partial<Omit<Objectif, 'id' | 'client_id' | 'created_at'>>) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('objectifs')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Objectif
}

export async function deleteObjectif(id: string) {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('objectifs').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CRUD — ACTIFS FINANCIERS
// ============================================================

export async function getActifsFinanciers(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('actifs_financiers')
    .select('*')
    .eq('client_id', id)
    .order('created_at')
  if (error) throw error
  return data as ActifFinancier[]
}

export async function addActifFinancier(clientId: string, input: Omit<ActifFinancier, 'id' | 'client_id' | 'created_at'>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('actifs_financiers')
    .insert({ ...input, client_id: id })
    .select()
    .single()
  if (error) throw error
  return data as ActifFinancier
}

export async function updateActifFinancier(id: string, input: Partial<Omit<ActifFinancier, 'id' | 'client_id' | 'created_at'>>) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('actifs_financiers')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ActifFinancier
}

export async function deleteActifFinancier(id: string) {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('actifs_financiers').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CRUD — PATRIMOINE IMMOBILIER
// ============================================================

export async function getPatrimoineImmobilier(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('patrimoine_immobilier')
    .select('*')
    .eq('client_id', id)
  if (error) throw error
  return data as BienImmobilier[]
}

export async function addBienImmobilier(clientId: string, input: Omit<BienImmobilier, 'id' | 'client_id' | 'created_at'>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('patrimoine_immobilier')
    .insert({ ...input, client_id: id })
    .select()
    .single()
  if (error) throw error
  return data as BienImmobilier
}

export async function deleteBienImmobilier(id: string) {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('patrimoine_immobilier').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CRUD — PASSIFS
// ============================================================

export async function getPassifs(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('passifs')
    .select('*')
    .eq('client_id', id)
  if (error) throw error
  return data as Passif[]
}

export async function addPassif(clientId: string, input: Omit<Passif, 'id' | 'client_id' | 'created_at'>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('passifs')
    .insert({ ...input, client_id: id })
    .select()
    .single()
  if (error) throw error
  return data as Passif
}

export async function deletePassif(id: string) {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('passifs').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CRUD — BUDGET POSTES
// ============================================================

export async function getBudgetPostes(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('budget_postes')
    .select('*')
    .eq('client_id', id)
  if (error) throw error
  return data as BudgetPoste[]
}

export async function upsertBudgetPostes(clientId: string, postes: Omit<BudgetPoste, 'id' | 'client_id'>[]) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  await supabase.from('budget_postes').delete().eq('client_id', id)
  if (postes.length === 0) return []
  const { data, error } = await supabase
    .from('budget_postes')
    .insert(postes.map(p => ({ ...p, client_id: id })))
    .select()
  if (error) throw error
  return data as BudgetPoste[]
}

// ============================================================
// CRUD — FISCALITE
// ============================================================

export async function getFiscalite(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('fiscalite')
    .select('*')
    .eq('client_id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as Fiscalite | null
}

export async function upsertFiscalite(clientId: string, input: Partial<Omit<Fiscalite, 'id' | 'client_id' | 'created_at' | 'updated_at'>>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('fiscalite')
    .upsert({ ...input, client_id: id }, { onConflict: 'client_id' })
    .select()
    .single()
  if (error) throw error
  return data as Fiscalite
}

// ============================================================
// CRUD — PREVOYANCE
// ============================================================

export async function getPrevoyance(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('prevoyance')
    .select('*')
    .eq('client_id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as Prevoyance | null
}

export async function upsertPrevoyance(clientId: string, input: Partial<Omit<Prevoyance, 'id' | 'client_id' | 'created_at' | 'updated_at'>>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('prevoyance')
    .upsert({ ...input, client_id: id }, { onConflict: 'client_id' })
    .select()
    .single()
  if (error) throw error
  return data as Prevoyance
}

export async function getContratsPrevoyance(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('contrats_prevoyance')
    .select('*')
    .eq('client_id', id)
  if (error) throw error
  return data as ContratPrevoyance[]
}

// ============================================================
// CRUD — DOSSIERS
// ============================================================

export async function getDossiers(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('dossiers')
    .select('*, dossier_etapes(*)')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as (Dossier & { dossier_etapes: DossierEtape[] })[]
}

export async function createDossier(clientId: string, input: Omit<Dossier, 'id' | 'client_id' | 'created_at' | 'updated_at'>) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('dossiers')
    .insert({ ...input, client_id: id })
    .select()
    .single()
  if (error) throw error
  return data as Dossier
}

export async function updateDossier(id: string, input: Partial<Omit<Dossier, 'id' | 'client_id' | 'created_at'>>) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('dossiers')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Dossier
}

// ============================================================
// CRUD — KYC TOKENS
// ============================================================

export async function createKycToken(clientId: string, contexte: KycContexte, expiresInHours = 72) {
  const supabase = await createServerSupabase()
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('kyc_tokens')
    .insert({ client_id: clientId, contexte, expires_at: expiresAt })
    .select()
    .single()
  if (error) throw error
  return data as KycToken
}

export async function getKycToken(token: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('kyc_tokens')
    .select('*')
    .eq('token', token)
    .single()
  if (error) throw error
  return data as KycToken
}

export async function markKycTokenUsed(token: string) {
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('kyc_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
  if (error) throw error
}

// ============================================================
// CRUD — MESSAGERIE
// ============================================================

export async function getMessages(clientId: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('messagerie')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Message[]
}

export async function sendMessage(clientId: string, expediteur: 'conseiller' | 'client', contenu: string) {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('messagerie')
    .insert({ client_id: id, expediteur, contenu })
    .select()
    .single()
  if (error) throw error
  return data as Message
}

export async function markMessagesRead(clientId: string, expediteur: 'conseiller' | 'client') {
  const id = await resolveClientId(clientId)
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('messagerie')
    .update({ lu: true })
    .eq('client_id', id)
    .eq('expediteur', expediteur)
    .eq('lu', false)
  if (error) throw error
}

// ============================================================
// CRUD — PRODUITS
// ============================================================

export async function getProduits(categorie?: Produit['categorie']) {
  const supabase = await createServerSupabase()
  let query = supabase.from('produits').select('*').eq('actif', true)
  if (categorie) query = query.eq('categorie', categorie)
  const { data, error } = await query.order('nom')
  if (error) throw error
  return data as Produit[]
}

export async function getProduit(id: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('produits')
    .select('*, produits_documents(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Produit & { produits_documents: ProduitDocument[] }
}

// ============================================================
// CRUD — GOUVERNANCE PRODUITS
// ============================================================

export async function getGouvernance(produitId: string): Promise<ProduitGouvernance | null> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('produits_gouvernance')
    .select('*')
    .eq('produit_id', produitId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as ProduitGouvernance | null
}

export async function upsertGouvernance(
  produitId: string,
  input: Partial<Omit<ProduitGouvernance, 'id' | 'produit_id' | 'created_at' | 'updated_at' | 'valide_par' | 'valide_le'>>
): Promise<ProduitGouvernance> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('produits_gouvernance')
    .upsert(
      { ...input, produit_id: produitId, statut_validation: 'a_valider' },
      { onConflict: 'produit_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data as ProduitGouvernance
}

export async function validerGouvernance(produitId: string): Promise<ProduitGouvernance> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { data, error } = await supabase
    .from('produits_gouvernance')
    .update({
      statut_validation: 'valide',
      motif_signalement: null,  // effacement du motif précédent lors de la validation
      valide_par: user.id,
      valide_le: new Date().toISOString(),
    })
    .eq('produit_id', produitId)
    .select()
    .single()
  if (error) throw error
  return data as ProduitGouvernance
}

export async function signalerGouvernance(
  produitId: string,
  motif?: string
): Promise<ProduitGouvernance> {
  const supabase = await createServerSupabase()
  // Le motif est stocké sur la ligne — le trigger fn_snapshot_gouvernance
  // l'archive automatiquement dans produits_gouvernance_historique via to_jsonb(OLD).
  const { data, error } = await supabase
    .from('produits_gouvernance')
    .update({
      statut_validation: 'a_revoir',
      motif_signalement: motif ?? null,
    })
    .eq('produit_id', produitId)
    .select()
    .single()
  if (error) throw error
  return data as ProduitGouvernance
}

export async function getGouvernanceHistorique(
  gouvernanceId: string
): Promise<ProduitGouvernanceHistorique[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('produits_gouvernance_historique')
    .select('*')
    .eq('gouvernance_id', gouvernanceId)
    .order('modifie_le', { ascending: false })
  if (error) throw error
  return data as ProduitGouvernanceHistorique[]
}

export async function getProduitsAvecGouvernance(): Promise<
  (Produit & { gouvernance: ProduitGouvernance | null })[]
> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('produits')
    .select('*, gouvernance:produits_gouvernance(*)')
    .eq('actif', true)
    .order('nom')
  if (error) throw error
  return data as (Produit & { gouvernance: ProduitGouvernance | null })[]
}

export async function getProduitsAlerteRevue(): Promise<
  (Produit & { gouvernance: ProduitGouvernance })[]
> {
  const supabase = await createServerSupabase()
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('produits_gouvernance')
    .select('*, produit:produits(*)')
    .or(`alerte_revue.eq.true,date_prochaine_revue.lte.${today}`)
    .order('date_prochaine_revue', { ascending: true })
  if (error) throw error
  return (data as { produit: Produit; [key: string]: unknown }[]).map(row => {
    const { produit, ...gouvernance } = row
    return { ...produit, gouvernance: gouvernance as unknown as ProduitGouvernance }
  })
}

export async function getProduitsParStatutValidation(
  statut: StatutValidation
): Promise<(Produit & { gouvernance: ProduitGouvernance })[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('produits_gouvernance')
    .select('*, produit:produits(*)')
    .eq('statut_validation', statut)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as { produit: Produit; [key: string]: unknown }[]).map(row => {
    const { produit, ...gouvernance } = row
    return { ...produit, gouvernance: gouvernance as unknown as ProduitGouvernance }
  })
}

// ============================================================
// CRUD — EXTRACTION DOCUMENTAIRE
// ============================================================

export async function getDocumentsExtraits(documentId: string): Promise<DocumentExtrait[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('documents_extraits')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as DocumentExtrait[]
}

export async function findExtraitByHash(
  documentId: string,
  hash: string
): Promise<DocumentExtrait | null> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('documents_extraits')
    .select('*')
    .eq('document_id', documentId)
    .eq('hash_fichier', hash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as DocumentExtrait | null
}

export async function insertDocumentExtrait(input: {
  document_id: string
  texte_extrait: string
  nb_pages?: number
  hash_fichier?: string
  extraction_methode?: ExtractionMethode
}): Promise<DocumentExtrait> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('documents_extraits')
    .insert({
      document_id:        input.document_id,
      texte_extrait:      input.texte_extrait,
      nb_pages:           input.nb_pages ?? null,
      hash_fichier:       input.hash_fichier ?? null,
      extraction_methode: input.extraction_methode ?? null,
      statut_analyse:     'en_attente',
    })
    .select()
    .single()
  if (error) throw error
  return data as DocumentExtrait
}

export async function marquerAnalyseEnCours(extraitId: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('documents_extraits')
    .update({ statut_analyse: 'en_cours' })
    .eq('id', extraitId)
  if (error) throw error
}

export async function marquerAnalyseTerminee(
  extraitId: string,
  input: {
    gouvernance_id: string
    modele_ia: string
    version_prompt: string
    analyse_resultat_brut: Record<string, unknown>
    tokens_entree?: number
    tokens_sortie?: number
  }
): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('documents_extraits')
    .update({
      statut_analyse:        'analyse_terminee',
      gouvernance_id:        input.gouvernance_id,
      modele_ia:             input.modele_ia,
      version_prompt:        input.version_prompt,
      date_analyse_ia:       new Date().toISOString(),
      tokens_entree:         input.tokens_entree ?? null,
      tokens_sortie:         input.tokens_sortie ?? null,
      analyse_resultat_brut: input.analyse_resultat_brut,
    })
    .eq('id', extraitId)
  if (error) throw error
}

export async function marquerAnalyseErreur(extraitId: string, erreur: string): Promise<void> {
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('documents_extraits')
    .update({
      statut_analyse: 'erreur',
      erreur_analyse: erreur,
    })
    .eq('id', extraitId)
  if (error) throw error
}

// ============================================================
// LOG RGPD
// ============================================================

export async function logAccess(action: string, resource?: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user?.id ?? '')
    .single()
  const { error } = await supabase.from('access_logs').insert({
    user_id: user?.id ?? null,
    role: roleData?.role ?? null,
    action,
    resource: resource ?? null,
  })
  if (error) console.error('[access_log]', error.message)
}
