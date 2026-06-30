import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { creerSnapshotFinalise } from '@/lib/collecte'
import { genererEtArchiverDocument } from '@/lib/documents-generes'

export const runtime = 'nodejs'

// POST /api/clients/:clientId/generer-kyc-pdf
//
// Génère un PDF KYC à partir de la situation patrimoniale actuelle du client
// dans le CRM, sans nécessiter de session de collecte.
//
// Chaque appel crée un nouveau patrimoine_snapshot (type_declencheur='manuel',
// session_id=null) qui capture l'état du référentiel au moment exact de la
// génération, puis génère et archive le document via genererEtArchiverDocument.
//
// Idempotence : genererEtArchiverDocument est idempotent par
// (snapshot_id, template_code) — si pour une raison quelconque l'appel est
// rejoué avec le même snapshot_id (impossible ici puisque chaque snapshot
// reçoit un id et un genere_le distincts), le document existant est retourné
// sans doublon. Chaque appel produit délibérément un nouveau snapshot + PDF
// daté ("situation au jour de génération").
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params

  // ── Auth : conseiller uniquement ────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès réservé aux conseillers' }, { status: 403 })
  }

  // ── Vérifier que le client existe ───────────────────────────────────────────
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle()

  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
  if (!client)     return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  // ── Créer un snapshot depuis le référentiel courant ─────────────────────────
  let snapshot_id: string
  try {
    const snapshot = await creerSnapshotFinalise(
      {
        clientId,
        sessionId:       null,
        typeDeclencheur: 'manuel',
        userId:          user.id,
      },
      supabaseAdmin
    )
    snapshot_id = snapshot.id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la création du snapshot'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── Générer et archiver le document PDF ─────────────────────────────────────
  try {
    const { document, reused } = await genererEtArchiverDocument(
      snapshot_id,
      'kyc_particulier',
      user.id,
      supabaseAdmin
    )
    return NextResponse.json({
      snapshot_id,
      document_id: document.id,
      numero_sequence: document.numero_sequence,
      genere_le: document.genere_le,
      reused,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la génération du document'
    return NextResponse.json({ error: message, snapshot_id }, { status: 500 })
  }
}
