import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('kyc_tokens')
    .select('*, clients(id, nom, prenom, email)')
    .eq('token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Token invalide ou introuvable' }, { status: 404 })
  }

  if (data.used_at) {
    return NextResponse.json({ error: 'Ce lien a déjà été utilisé' }, { status: 410 })
  }

  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expiré. Contactez votre conseiller.' }, { status: 410 })
  }

  return NextResponse.json({
    valid: true,
    client_id: data.client_id,
    contexte: data.contexte,
    expires_at: data.expires_at,
    client: data.clients,
  })
}
