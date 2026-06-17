import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { deciderEcart } from '@/lib/collecte'

const DecisionSchema = z.object({
  action: z.enum(['accepte', 'rejete']),
  motif:  z.string().max(2000).optional(),
})

// PATCH /api/collecte/sessions/:id/ecarts/:ecartId
// Accepte ou refuse un écart individuel. Réservé aux conseillers authentifiés.
// Seuls les écarts en statut 'a_revoir' peuvent être décidés.
// Le statut 'traite' est réservé à la Phase 7 (application au référentiel).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ecartId: string }> }
) {
  const { id: sessionId, ecartId } = await params

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

  const parsed = DecisionSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  const { action, motif } = parsed.data

  if (action === 'rejete' && !motif?.trim()) {
    return NextResponse.json({ error: 'Le motif est obligatoire en cas de refus' }, { status: 422 })
  }

  // Défense en profondeur : la décision n'est autorisée que sur une session en revue active
  const { data: session } = await supabaseAdmin
    .from('collecte_sessions')
    .select('statut')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session || session.statut !== 'en_revue') {
    return NextResponse.json(
      { error: `La décision d'écart n'est possible qu'en statut "en_revue" (statut actuel : ${session?.statut ?? 'introuvable'})` },
      { status: 409 }
    )
  }

  // Vérifier que l'écart existe et appartient à la session
  const { data: ecart } = await supabaseAdmin
    .from('session_ecarts')
    .select('id, statut')
    .eq('id', ecartId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!ecart) {
    return NextResponse.json({ error: 'Écart introuvable' }, { status: 404 })
  }

  if (ecart.statut !== 'a_revoir') {
    return NextResponse.json(
      { error: `Cet écart est déjà décidé (statut : ${ecart.statut})` },
      { status: 409 }
    )
  }

  try {
    const updated = await deciderEcart(
      ecartId, sessionId, action, user.id, motif?.trim() ?? null, supabaseAdmin
    )
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la décision'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
