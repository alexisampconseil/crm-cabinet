import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { detecterEcarts } from '@/lib/collecte'

// PATCH /api/collecte/sessions/:id/detecter-ecarts
// Déclenche (ou relance) la détection des écarts pour une session en statut 'soumis'.
// Réservé aux conseillers authentifiés.
//
// Comportement de relance :
//   Seuls les écarts en statut 'a_revoir' sont supprimés avant une nouvelle détection.
//   Les écarts 'accepte', 'rejete' et 'traite' ne sont jamais supprimés.
//   Le statut valide est réservé à la validation conseiller, jamais à la détection automatique.
//
// Cas nominal (première détection) : aucune suppression préalable.
export async function PATCH(
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

  // Vérifier que la session existe et est en statut 'soumis'
  const { data: sessionData, error: sessionError } = await supabaseAdmin
    .from('collecte_sessions')
    .select('id, statut')
    .eq('id', sessionId)
    .single()

  if (sessionError || !sessionData) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  if (sessionData.statut !== 'soumis') {
    return NextResponse.json(
      { error: `La détection n'est possible qu'en statut "soumis" (statut actuel : ${sessionData.statut})` },
      { status: 409 }
    )
  }

  // Supprimer uniquement les écarts 'a_revoir' pour permettre la relance.
  // Les écarts 'accepte', 'rejete' et 'traite' (décisions conseiller) ne sont jamais supprimés.
  const { error: deleteError } = await supabaseAdmin
    .from('session_ecarts')
    .delete()
    .eq('session_id', sessionId)
    .eq('statut', 'a_revoir')

  if (deleteError) {
    return NextResponse.json(
      { error: `Erreur lors de la suppression des écarts existants : ${deleteError.message}` },
      { status: 500 }
    )
  }

  try {
    const result = await detecterEcarts(sessionId, supabaseAdmin)

    return NextResponse.json({
      nb_ecarts:    result.nb_ecarts,
      statut_final: result.statut_final,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la détection des écarts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
