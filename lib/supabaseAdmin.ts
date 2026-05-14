import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

function getInstance(): SupabaseClient {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL est manquant')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY est manquant')
  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _admin
}

// Proxy lazy : getInstance() n'est appelé qu'au premier accès (pas au module load)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    return Reflect.get(getInstance(), prop)
  },
})
