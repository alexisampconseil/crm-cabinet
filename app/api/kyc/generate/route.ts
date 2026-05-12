import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { KycContexte } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Vérifier que l'appelant est un conseiller authentifié
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (roleData?.role !== 'conseiller') {
      return NextResponse.json({ error: 'Accès réservé au conseiller' }, { status: 403 })
    }

    const body = await request.json()
    const { client_id, contexte = 'prospect', expires_in_hours = 72 } = body

    if (!client_id) return NextResponse.json({ error: 'client_id requis' }, { status: 400 })
    const validContextes: KycContexte[] = ['prospect', 'maj_annuelle', 'modif_situation']
    if (!validContextes.includes(contexte)) {
      return NextResponse.json({ error: 'contexte invalide' }, { status: 400 })
    }

    // Vérifier que le client existe
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, nom, prenom, email')
      .eq('id', client_id)
      .single()
    if (clientErr || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const expiresAt = new Date(Date.now() + expires_in_hours * 3600 * 1000).toISOString()

    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from('kyc_tokens')
      .insert({ client_id, contexte, expires_at: expiresAt })
      .select()
      .single()

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: 'Impossible de créer le token' }, { status: 500 })
    }

    // Mettre à jour le statut KYC du client
    await supabaseAdmin
      .from('clients')
      .update({ kyc_status: 'en_cours' })
      .eq('id', client_id)
      .in('kyc_status', ['non_fait', 'a_renouveler'])

    const kycUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/kyc/${tokenRow.token}`

    // Log RGPD
    await supabaseAdmin.from('access_logs').insert({
      user_id: user.id,
      role: 'conseiller',
      action: 'kyc_token_generated',
      resource: `client:${client_id}`,
    })

    return NextResponse.json({
      token: tokenRow.token,
      url: kycUrl,
      expires_at: expiresAt,
      client: { id: client.id, nom: client.nom, prenom: client.prenom },
    })
  } catch (err) {
    console.error('[kyc/generate]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
