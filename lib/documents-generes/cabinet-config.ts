import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CabinetConfig } from './types'

let cached: CabinetConfig | null = null

// Donnée quasi statique (mentions légales du cabinet) : un cache mémoire simple
// suffit, pas besoin d'invalidation fine — un redéploiement vide le cache si la
// ligne cabinet_config change.
export async function getCabinetConfig(
  supabase: SupabaseClient
): Promise<CabinetConfig> {
  if (cached) return cached
  const { data, error } = await supabase
    .from('cabinet_config')
    .select('*')
    .limit(1)
    .single()
  if (error) throw error
  cached = data as CabinetConfig
  return cached
}
