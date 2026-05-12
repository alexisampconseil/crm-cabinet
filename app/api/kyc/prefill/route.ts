import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Renvoie les données pré-remplissage pour un client donné (conseiller uniquement)
export async function GET(request: NextRequest) {
  try {
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

    const clientId = request.nextUrl.searchParams.get('client_id')
    if (!clientId) return NextResponse.json({ error: 'client_id requis' }, { status: 400 })

    const [familleRes, fiscaliteRes] = await Promise.allSettled([
      supabaseAdmin.from('famille').select('*').eq('client_id', clientId).single(),
      supabaseAdmin.from('fiscalite').select('*').eq('client_id', clientId).single(),
    ])

    return NextResponse.json({
      famille: familleRes.status === 'fulfilled' ? familleRes.value.data : null,
      fiscalite: fiscaliteRes.status === 'fulfilled' ? fiscaliteRes.value.data : null,
    })
  } catch (err) {
    console.error('[kyc/prefill]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
