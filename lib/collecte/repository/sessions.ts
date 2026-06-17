import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CollecteSession,
  CollecteSessionCreate,
  CollecteSessionStatut,
  SnapshotPrefill,
} from '../types'

export async function getSession(
  id: string,
  supabase: SupabaseClient
): Promise<CollecteSession> {
  const { data, error } = await supabase
    .from('collecte_sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as CollecteSession
}

export async function getSessionsByClient(
  clientId: string,
  supabase: SupabaseClient
): Promise<CollecteSession[]> {
  const { data, error } = await supabase
    .from('collecte_sessions')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as CollecteSession[]
}

export async function getSessionsEnRevue(
  supabase: SupabaseClient
): Promise<CollecteSession[]> {
  const { data, error } = await supabase
    .from('collecte_sessions')
    .select('*')
    .eq('statut', 'en_revue')
    .order('date_soumission', { ascending: true })
  if (error) throw error
  return data as CollecteSession[]
}

// Retourne la session en cours de collecte (brouillon ou en_cours) pour un client.
// Un client ne peut avoir qu'une seule session active à la fois.
export async function getSessionActive(
  clientId: string,
  supabase: SupabaseClient
): Promise<CollecteSession | null> {
  const { data, error } = await supabase
    .from('collecte_sessions')
    .select('*')
    .eq('client_id', clientId)
    .in('statut', ['brouillon', 'en_cours'])
    .maybeSingle()
  if (error) throw error
  return data as CollecteSession | null
}

export async function createSession(
  input: CollecteSessionCreate,
  supabase: SupabaseClient
): Promise<CollecteSession> {
  const { data, error } = await supabase
    .from('collecte_sessions')
    .insert({
      client_id: input.client_id,
      perimetre: input.perimetre ?? 'client_seul',
      type: input.type ?? 'bilan_initial',
      canal: input.canal ?? 'entretien',
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as CollecteSession
}

// Met à jour snapshot_prefill, questionnaire_version_id et statut en une seule
// requête atomique. Appelée lors du passage brouillon → en_cours.
// Le trigger trg_cs_set_dates (migration 014) renseigne date_ouverture.
export async function updateSessionPrefillEtStatut(
  id: string,
  prefill: SnapshotPrefill,
  versionId: string,
  supabase: SupabaseClient
): Promise<CollecteSession> {
  const { data, error } = await supabase
    .from('collecte_sessions')
    .update({
      statut: 'en_cours' as CollecteSessionStatut,
      snapshot_prefill: prefill,
      questionnaire_version_id: versionId,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CollecteSession
}

export async function updateStatut(
  id: string,
  statut: CollecteSessionStatut,
  supabase: SupabaseClient
): Promise<CollecteSession> {
  const { data, error } = await supabase
    .from('collecte_sessions')
    .update({ statut })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CollecteSession
}

// Recalcule nb_ecarts_detectes et nb_ecarts_traites à partir de COUNT(*) sur
// session_ecarts. Approche non-incrémentale : valeur toujours cohérente avec
// l'état réel, sans risque de dérive. À appeler dans la même transaction que
// l'opération qui a modifié le nombre d'écarts.
export async function recalculerCompteurs(
  id: string,
  supabase: SupabaseClient
): Promise<void> {
  const [
    { count: total, error: err1 },
    { count: traites, error: err2 },
  ] = await Promise.all([
    supabase
      .from('session_ecarts')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', id),
    supabase
      .from('session_ecarts')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', id)
      .eq('statut', 'traite'),
  ])
  if (err1) throw err1
  if (err2) throw err2

  const { error } = await supabase
    .from('collecte_sessions')
    .update({
      nb_ecarts_detectes: total ?? 0,
      nb_ecarts_traites: traites ?? 0,
    })
    .eq('id', id)
  if (error) throw error
}
