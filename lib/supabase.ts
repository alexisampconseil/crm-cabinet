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
  created_at: string
}

export interface ActifFinancier {
  id: string
  client_id: string
  nature: 'AV' | 'PER' | 'SCPI' | 'Capitalisation' | 'PEA' | 'CTO' | 'Livret' | 'Autre'
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
  nature: 'RP' | 'RS' | 'Locatif' | 'SCI' | 'Autre'
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
  url: string
  date_document: string | null
}

export interface KycToken {
  id: string
  token: string
  client_id: string
  expires_at: string
  used_at: string | null
  contexte: KycContexte
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
