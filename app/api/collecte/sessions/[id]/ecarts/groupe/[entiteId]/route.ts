import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { deciderGroupeEcarts } from '@/lib/collecte'

const DecisionSchema = z.object({
  action: z.enum(['accepte', 'rejete']),
  motif:  z.string().max(2000).optional(),
})

// PATCH /api/collecte/sessions/:id/ecarts/groupe/:entiteId
// Décide en bloc tous les écarts type_ecart='ajout' partageant le même entite_id
// (= une nouvelle instance proposée par le client dans un bloc répétable).
// Seul point d'entrée autorisé pour décider un ajout — la route PATCH
// /ecarts/:ecartId rejette explicitement toute décision champ par champ
// sur un écart type_ecart='ajout' (incohérence possible : INSERT incomplet
// violant une contrainte NOT NULL du référentiel).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entiteId: string }> }
) {
  const { id: sessionId, entiteId } = await params

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

  // Vérifier que le groupe existe et a au moins un écart encore à_revoir
  const { count } = await supabaseAdmin
    .from('session_ecarts')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('entite_id', entiteId)
    .eq('type_ecart', 'ajout')
    .eq('statut', 'a_revoir')

  if (!count || count === 0) {
    return NextResponse.json({ error: 'Groupe introuvable ou déjà décidé' }, { status: 404 })
  }

  try {
    const updated = await deciderGroupeEcarts(
      sessionId, entiteId, action, user.id, motif?.trim() ?? null, supabaseAdmin
    )
    return NextResponse.json({ ecarts: updated, count: updated.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la décision du groupe'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
