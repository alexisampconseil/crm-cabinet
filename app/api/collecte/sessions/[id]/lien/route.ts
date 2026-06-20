import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/collecte/sessions/:id/lien
// Reconstruit l'URL du lien de collecte existant à partir du kyc_token déjà lié
// à la session — ne génère jamais de nouveau token. Réservé aux conseillers.
export async function GET(
  _request: NextRequest,
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

  const { data: session } = await supabaseAdmin
    .from('collecte_sessions')
    .select('id, kyc_token_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  if (!session.kyc_token_id) {
    return NextResponse.json({ error: 'Aucun lien généré pour cette session' }, { status: 404 })
  }

  const { data: token } = await supabaseAdmin
    .from('kyc_tokens')
    .select('token, expires_at, used_at')
    .eq('id', session.kyc_token_id)
    .maybeSingle()

  if (!token) {
    return NextResponse.json({ error: 'Lien introuvable pour cette session' }, { status: 404 })
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/collecte/${token.token}`

  return NextResponse.json({
    url,
    expires_at: token.expires_at,
    used_at:    token.used_at,
  })
}
