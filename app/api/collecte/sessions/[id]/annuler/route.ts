import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST /api/collecte/sessions/:id/annuler
// Neutralise une session de collecte ouverte ou abandonnée (brouillon/en_cours).
// Réservé aux conseillers. Interdit pour soumis/en_revue/valide/archive.
//
// Séquence :
//   1. Invalider le kyc_token lié (used_at = NOW) s'il existe et n'est pas déjà utilisé.
//   2. Passer la session en 'archive' — aucun nouveau statut introduit.
//   3. Si clients.kyc_status = 'en_cours' et qu'aucune autre session active
//      (brouillon/en_cours) ne subsiste pour ce client :
//        - 'a_renouveler' si le client a déjà au moins un cycle complété
//          (collecte_sessions.statut='archive' AND date_validation IS NOT NULL) ;
//        - 'non_fait' sinon.
//      Si kyc_status='complet' (ou autre), aucune modification.
//
// Ne touche jamais au référentiel ni aux patrimoine_snapshots.
export async function POST(
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
    .select('id, statut, client_id, kyc_token_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  if (!['brouillon', 'en_cours'].includes(session.statut)) {
    return NextResponse.json(
      { error: `L'annulation n'est possible qu'en statut "brouillon" ou "en_cours" (statut actuel : ${session.statut})` },
      { status: 409 }
    )
  }

  // ── 1. Invalider le kyc_token lié ────────────────────────────────────────────
  if (session.kyc_token_id) {
    const { error: tokenError } = await supabaseAdmin
      .from('kyc_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', session.kyc_token_id)
      .is('used_at', null)
    if (tokenError) {
      return NextResponse.json({ error: `Échec invalidation du lien : ${tokenError.message}` }, { status: 500 })
    }
  }

  // ── 2. Archiver la session ────────────────────────────────────────────────────
  const { error: archiveError } = await supabaseAdmin
    .from('collecte_sessions')
    .update({ statut: 'archive' })
    .eq('id', sessionId)

  if (archiveError) {
    return NextResponse.json({ error: `Échec annulation : ${archiveError.message}` }, { status: 500 })
  }

  // ── 3. Réévaluation clients.kyc_status (non bloquant) ────────────────────────
  try {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('kyc_status')
      .eq('id', session.client_id)
      .single()

    if (client?.kyc_status === 'en_cours') {
      const { count: autresActives } = await supabaseAdmin
        .from('collecte_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', session.client_id)
        .in('statut', ['brouillon', 'en_cours'])

      if (!autresActives) {
        const { count: cyclesCompletes } = await supabaseAdmin
          .from('collecte_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', session.client_id)
          .eq('statut', 'archive')
          .not('date_validation', 'is', null)

        const nouveauStatut = (cyclesCompletes ?? 0) > 0 ? 'a_renouveler' : 'non_fait'

        await supabaseAdmin
          .from('clients')
          .update({ kyc_status: nouveauStatut })
          .eq('id', session.client_id)
      }
    }
  } catch (err) {
    console.error('[annuler] Échec réévaluation kyc_status', err)
  }

  // ── 4. Traçabilité — non bloquant ────────────────────────────────────────────
  const { error: logError } = await supabaseAdmin.from('access_logs').insert({
    user_id:  user.id,
    role:     'conseiller',
    action:   'collecte_session_annulee',
    resource: `session:${sessionId}`,
  })
  if (logError) {
    console.error('[annuler] Échec insertion access_logs', logError)
  }

  return NextResponse.json({ success: true, statut: 'archive' })
}
