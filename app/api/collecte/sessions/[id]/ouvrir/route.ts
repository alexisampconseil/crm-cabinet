import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { ouvrirSession } from '@/lib/collecte'

// PATCH /api/collecte/sessions/:id/ouvrir — transition brouillon → en_cours
// Construit le snapshot_prefill et lie la version active du questionnaire.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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
    const result = await ouvrirSession(id, supabase)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'ouverture de la session"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
