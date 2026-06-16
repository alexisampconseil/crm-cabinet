import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getVersions } from '@/lib/collecte'

// GET /api/collecte/versions — liste toutes les versions du questionnaire
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const versions = await getVersions(supabase)
    return NextResponse.json(versions)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la récupération des versions'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
