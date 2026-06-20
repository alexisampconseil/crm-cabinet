import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionEcart, SessionEcartStatut } from '../types'

export async function getEcartsBySession(
  sessionId: string,
  supabase: SupabaseClient
): Promise<SessionEcart[]> {
  const { data, error } = await supabase
    .from('session_ecarts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as SessionEcart[]
}

// Applique la décision conseiller sur un écart.
// Appelée après vérification préalable que l'écart est bien 'a_revoir' (côté route).
// Le statut 'traite' est réservé à la Phase 7 (application au référentiel).
export async function deciderEcart(
  ecartId: string,
  sessionId: string,
  action: 'accepte' | 'rejete',
  decidePar: string,
  motif: string | null,
  supabase: SupabaseClient
): Promise<SessionEcart> {
  const { data, error } = await supabase
    .from('session_ecarts')
    .update({
      statut:     action as SessionEcartStatut,
      motif_rejet: action === 'rejete' ? motif : null,
      decide_par: decidePar,
      decide_le:  new Date().toISOString(),
    })
    .eq('id', ecartId)
    .eq('session_id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data as SessionEcart
}

// Applique la décision conseiller à tout un groupe d'écarts type_ecart='ajout'
// partageant le même entite_id (= une nouvelle instance proposée par le client).
// Aucune décision champ par champ n'est autorisée pour un ajout — un INSERT
// incomplet violerait les contraintes NOT NULL du référentiel (voir application.ts).
export async function deciderGroupeEcarts(
  sessionId: string,
  entiteId:  string,
  action:    'accepte' | 'rejete',
  decidePar: string,
  motif:     string | null,
  supabase:  SupabaseClient
): Promise<SessionEcart[]> {
  const { data, error } = await supabase
    .from('session_ecarts')
    .update({
      statut:     action as SessionEcartStatut,
      motif_rejet: action === 'rejete' ? motif : null,
      decide_par: decidePar,
      decide_le:  new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('entite_id', entiteId)
    .eq('type_ecart', 'ajout')
    .eq('statut', 'a_revoir')
    .select()
  if (error) throw error
  return (data ?? []) as SessionEcart[]
}

export async function countEcartsARevoir(
  sessionId: string,
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from('session_ecarts')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('statut', 'a_revoir')
  if (error) throw error
  return count ?? 0
}
