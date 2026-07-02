import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { annulerDocument } from '@/lib/documents-generes'

export const runtime = 'nodejs'

// PATCH /api/documents-generes/:archiveId/annuler
//
// Annulation logique d'un document généré (statut 'actif' → 'annule').
// Réservé aux conseillers. Irréversible — aucune réactivation possible.
//
// Le document reste physiquement archivé (Storage + ligne DB) : seul son statut
// change. Le fichier PDF reste téléchargeable par le conseiller pour la
// traçabilité réglementaire. Le client ne voit plus le document (RLS 020).
//
// Après annulation, la régénération depuis le même snapshot est possible
// (l'index unique partiel ne couvre que les documents actifs — migration 020).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ archiveId: string }> }
) {
  const { archiveId } = await params

  // ── Auth : conseiller uniquement ────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès réservé aux conseillers' }, { status: 403 })
  }

  // ── Vérifier que le document existe et est actif ────────────────────────────
  const { data: document, error: fetchError } = await supabase
    .from('documents_generes')
    .select('id, statut')
    .eq('id', archiveId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!document)  return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (document.statut === 'annule') {
    return NextResponse.json({ error: 'Ce document est déjà annulé' }, { status: 409 })
  }

  // ── Motif optionnel ─────────────────────────────────────────────────────────
  let motif: string | null = null
  try {
    const body = await request.json()
    motif = typeof body?.motif === 'string' && body.motif.trim() ? body.motif.trim() : null
  } catch {
    // Corps absent ou malformé : motif null, annulation sans motif autorisée
  }

  // ── Annulation ──────────────────────────────────────────────────────────────
  try {
    await annulerDocument(archiveId, user.id, motif, supabase)
    return NextResponse.json({ annule: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de l\'annulation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
