import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { appliquerEcarts, creerSnapshotFinalise, countEcartsARevoir } from '@/lib/collecte'
import { genererEtArchiverDocument } from '@/lib/documents-generes'

// POST /api/collecte/sessions/:id/appliquer-ecarts
// Phase 7 : applique les écarts statut='accepte' au référentiel, génère le snapshot
// final, génère et archive le document KYC (PDF), puis archive la session.
//
// Ordre garanti :
//   1. Appliquer écarts → traite (idempotent : filtre applique_le IS NULL)
//   2. Générer patrimoine_snapshot (type_declencheur = 'validation_session')
//   2bis. Générer et archiver le document KYC (documents_generes) à partir de ce
//      snapshot finalisé — jamais depuis le référentiel live. Idempotent par
//      (snapshot_id, template_code).
//   3. Passer la session en 'archive' — SEULEMENT si le snapshot ET le document
//      KYC ont été générés avec succès
//   4. Marquer clients.kyc_status = 'complet' — non bloquant, ne remet jamais
//      en cause un archivage déjà réussi
//
// Si le snapshot ou le document KYC échoue, la session reste en 'valide' et le
// conseiller peut relancer. Aucun écart rejeté n'est touché. Aucune application
// au référentiel n'est faite dans d'autres phases.
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
  // On rappelle genererEtArchiverDocument même ici plutôt que de se contenter
  // de lire l'existant : appel idempotent par (snapshot_id, template_code),
  // donc sans coût si le document existe déjà — mais cela permet de
  // régénérer automatiquement si la ligne documents_generes a été supprimée
  // (ex : nettoyage de données de test) sans repasser par tout le workflow.
  if (session.statut === 'archive') {
    const { data: existingSnap } = await supabaseAdmin
      .from('patrimoine_snapshots')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle()

    if (!existingSnap) {
      return NextResponse.json({
        applied: 0, errors: [], archived: true,
        snapshot_id: null, document_id: null,
        message: 'Session déjà archivée',
      })
    }

    try {
      const { document } = await genererEtArchiverDocument(
        existingSnap.id,
        'kyc_particulier',
        user.id,
        supabaseAdmin
      )
      return NextResponse.json({
        applied: 0, errors: [], archived: true,
        snapshot_id: existingSnap.id,
        document_id: document.id,
        message: 'Session déjà archivée',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la génération du document KYC'
      return NextResponse.json({
        applied: 0, errors: [], archived: true,
        snapshot_id: existingSnap.id, document_id: null,
        document_error: message,
      }, { status: 500 })
    }
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
  // Idempotence : si un snapshot de validation existe déjà (relance après
  // échec d'archivage), réutiliser son id sans ré-insérer.
  // En cas d'échec, la session reste en 'valide' pour permettre une relance.
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
      const snap = await creerSnapshotFinalise(
        {
          clientId:        session.client_id as string,
          sessionId:       sessionId,
          typeDeclencheur: 'validation_session',
          userId:          user.id,
        },
        supabaseAdmin
      )
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

  // ── 2bis. Générer et archiver le document KYC ────────────────────────────────
  // À partir du snapshot finalisé ci-dessus, jamais depuis le référentiel live.
  // Idempotent par (snapshot_id, template_code) : une relance après échec
  // d'archivage réutilise le document déjà généré sans le regénérer.
  let document_id: string | null = null
  try {
    const { document } = await genererEtArchiverDocument(
      snapshot_id as string,
      'kyc_particulier',
      user.id,
      supabaseAdmin
    )
    document_id = document.id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la génération du document KYC'
    return NextResponse.json({
      applied:        result.applied,
      errors:         [],
      archived:       false,
      snapshot_id,
      document_id:    null,
      document_error: message,
    }, { status: 500 })
  }

  // ── 3. Archiver la session (seulement après snapshot et document réussis) ───
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
      document_id,
      archive_error: archiveError.message,
    }, { status: 500 })
  }

  // ── 4. Marquer le KYC du client comme complet ────────────────────────────────
  // Non bloquant : l'archivage de la session (étape critique déjà sécurisée)
  // ne doit jamais être remis en cause par un échec isolé sur cette mise à jour.
  const { error: kycError } = await supabaseAdmin
    .from('clients')
    .update({ kyc_status: 'complet' })
    .eq('id', session.client_id)

  if (kycError) {
    console.error('[appliquer-ecarts] Échec mise à jour clients.kyc_status', kycError)
  }

  return NextResponse.json({
    applied:     result.applied,
    errors:      [],
    archived:    true,
    snapshot_id,
    document_id,
  })
}
