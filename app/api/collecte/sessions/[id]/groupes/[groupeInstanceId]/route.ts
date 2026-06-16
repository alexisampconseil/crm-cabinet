import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getSession, deleteReponsesByGroupe } from '@/lib/collecte'

// DELETE /api/collecte/sessions/:id/groupes/:groupeInstanceId
// Supprime toutes les réponses d'une instance de groupe répétable.
// La session doit être en statut brouillon ou en_cours.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupeInstanceId: string }> }
) {
  const { id: sessionId, groupeInstanceId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let session
  try {
    session = await getSession(sessionId, supabase)
  } catch {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  if (!['brouillon', 'en_cours'].includes(session.statut)) {
    return NextResponse.json(
      { error: `La session est verrouillée (statut : ${session.statut}) — aucune suppression après soumission` },
      { status: 409 }
    )
  }

  try {
    await deleteReponsesByGroupe(sessionId, groupeInstanceId, supabase)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la suppression du groupe'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
