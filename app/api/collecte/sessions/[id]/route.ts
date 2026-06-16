import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getSession } from '@/lib/collecte'

// GET /api/collecte/sessions/:id — lire une session
// Accessible aux conseillers et aux clients (RLS filtre via client_id)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const session = await getSession(id, supabase)
    return NextResponse.json(session)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Session introuvable'
    const status = message.toLowerCase().includes('introuvable') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
