import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getVersionActive } from '@/lib/collecte'

// GET /api/collecte/versions/active — version de questionnaire actuellement publiée
// Retourne null (200) si aucune version n'est active.
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const version = await getVersionActive(supabase)
    return NextResponse.json(version)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la récupération de la version active'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
