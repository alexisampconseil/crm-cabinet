import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getSession, deleteReponse } from '@/lib/collecte'

// DELETE /api/collecte/reponses/:id — supprimer une réponse individuelle
// La session parente doit être en statut brouillon ou en_cours.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Récupérer le session_id via la réponse pour vérifier le statut
  const { data: reponseRow, error: lookupError } = await supabase
    .from('questionnaire_reponses')
    .select('session_id')
    .eq('id', id)
    .single()

  if (lookupError || !reponseRow) {
    return NextResponse.json({ error: 'Réponse introuvable' }, { status: 404 })
  }

  let session
  try {
    session = await getSession(reponseRow.session_id, supabase)
  } catch {
    return NextResponse.json({ error: 'Session parente introuvable' }, { status: 404 })
  }

  if (!['brouillon', 'en_cours'].includes(session.statut)) {
    return NextResponse.json(
      { error: `La session est verrouillée (statut : ${session.statut}) — aucune suppression après soumission` },
      { status: 409 }
    )
  }

  try {
    await deleteReponse(id, supabase)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la suppression de la réponse'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
