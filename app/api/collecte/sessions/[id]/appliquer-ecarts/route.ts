import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { appliquerEcarts, buildSnapshotPrefill, computeSnapshotChecksum, countEcartsARevoir } from '@/lib/collecte'

// POST /api/collecte/sessions/:id/appliquer-ecarts
// Phase 7 : applique les écarts statut='accepte' au référentiel, génère le snapshot final,
// puis archive la session.
//
// Ordre garanti :
//   1. Appliquer écarts → traite (idempotent : filtre applique_le IS NULL)
//   2. Générer patrimoine_snapshot (type_declencheur = 'validation_session')
//   3. Passer la session en 'archive' — SEULEMENT si le snapshot réussit
//
// Si le snapshot échoue, la session reste en 'valide' et le conseiller peut relancer.
// Aucun écart rejeté n'est touché. Aucune application au référentiel n'est faite dans d'autres phases.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params

  // ── Auth ────────────────────────────────────────────────────────────────────
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

  // ── Charger la session ──────────────────────────────────────────────────────
  const { data: session } = await supabaseAdmin
    .from('collecte_sessions')
    .select('id, statut, client_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  // Idempotence : session déjà archivée
  if (session.statut === 'archive') {
    const { data: existingSnap } = await supabaseAdmin
      .from('patrimoine_snapshots')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle()
    return NextResponse.json({
      applied:     0,
      errors:      [],
      archived:    true,
      snapshot_id: existingSnap?.id ?? null,
      message:     'Session déjà archivée',
    })
  }

  if (session.statut !== 'valide') {
    return NextResponse.json(
      { error: `L'application n'est possible qu'en statut "valide" (statut actuel : ${session.statut})` },
      { status: 409 }
    )
  }

  // Défense en profondeur : aucun écart a_revoir (normalement garanti par Phase 6)
  const nbARevoir = await countEcartsARevoir(sessionId, supabaseAdmin)
  if (nbARevoir > 0) {
    return NextResponse.json(
      { error: `${nbARevoir} écart${nbARevoir > 1 ? 's' : ''} en statut "a_revoir" — validation conseiller incomplète` },
      { status: 409 }
    )
  }

  // ── 1. Appliquer les écarts acceptés ────────────────────────────────────────
  const result = await appliquerEcarts(
    sessionId,
    session.client_id as string,
    user.id,
    supabaseAdmin
  )

  // Application partielle (erreurs sur certains écarts) : ne pas archiver
  if (result.errors.length > 0) {
    return NextResponse.json({
      applied:     result.applied,
      errors:      result.errors,
      archived:    false,
      snapshot_id: null,
    }, { status: 207 })
  }

  // ── 2. Générer le snapshot patrimonial final ─────────────────────────────────
  // Idempotence : si un snapshot de validation existe déjà (relance après échec d'archivage),
  // réutiliser son id sans ré-insérer.
  // En cas d'échec de la génération, la session reste en 'valide' pour permettre une relance.
  let snapshot_id: string | null = null
  try {
    const { data: existingSnap } = await supabaseAdmin
      .from('patrimoine_snapshots')
      .select('id')
      .eq('session_id', sessionId)
      .eq('type_declencheur', 'validation_session')
      .maybeSingle()

    if (existingSnap) {
      snapshot_id = existingSnap.id
    } else {
      const prefill   = await buildSnapshotPrefill(session.client_id as string, supabaseAdmin)
      const genere_le = new Date().toISOString()
      const checksum  = computeSnapshotChecksum({
        client_id:        session.client_id as string,
        genere_le,
        session_id:       sessionId,
        snapshot:         prefill,
        type_declencheur: 'validation_session',
        version_schema:   '1.0',
      })

      const { data: snap, error: snapError } = await supabaseAdmin
        .from('patrimoine_snapshots')
        .insert({
          client_id:        session.client_id,
          session_id:       sessionId,
          type_declencheur: 'validation_session',
          version_schema:   '1.0',
          statut:           'finalise',
          snapshot:         prefill,
          checksum,
          genere_par:       user.id,
          genere_le,
        })
        .select('id')
        .single()

      if (snapError) throw new Error(snapError.message)
      snapshot_id = snap.id
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la génération du snapshot'
    return NextResponse.json({
      applied:        result.applied,
      errors:         [],
      archived:       false,
      snapshot_id:    null,
      snapshot_error: message,
    }, { status: 500 })
  }

  // ── 3. Archiver la session (seulement après snapshot réussi) ────────────────
  const { error: archiveError } = await supabaseAdmin
    .from('collecte_sessions')
    .update({ statut: 'archive' })
    .eq('id', sessionId)

  if (archiveError) {
    return NextResponse.json({
      applied:       result.applied,
      errors:        [],
      archived:      false,
      snapshot_id,
      archive_error: archiveError.message,
    }, { status: 500 })
  }

  return NextResponse.json({
    applied:     result.applied,
    errors:      [],
    archived:    true,
    snapshot_id,
  })
}
