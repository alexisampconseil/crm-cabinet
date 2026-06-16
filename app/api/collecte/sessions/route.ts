import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { creerSession, getSessionsEnRevue } from '@/lib/collecte'

const CreateSchema = z.object({
  clientId: z.string().uuid('clientId doit être un UUID valide'),
  perimetre: z.enum(['client_seul', 'foyer']).optional(),
  notes: z.string().max(2000).optional(),
})

// POST /api/collecte/sessions — créer une session brouillon pour un client
export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  try {
    const session = await creerSession(parsed.data, supabase)
    return NextResponse.json(session, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la création de la session'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// GET /api/collecte/sessions — sessions en attente de revue (dashboard conseiller)
export async function GET(request: NextRequest) {
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
    const sessions = await getSessionsEnRevue(supabase)
    return NextResponse.json(sessions)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la récupération des sessions'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
