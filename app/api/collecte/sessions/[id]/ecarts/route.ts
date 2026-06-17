import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getEcartsBySession } from '@/lib/collecte'

// GET /api/collecte/sessions/:id/ecarts
// Liste tous les écarts d'une session. Réservé aux conseillers authentifiés.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!userRole || userRole.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès réservé aux conseillers' }, { status: 403 })
  }

  try {
    const ecarts = await getEcartsBySession(sessionId, supabaseAdmin)
    return NextResponse.json(ecarts)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la récupération des écarts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
