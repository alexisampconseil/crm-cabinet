import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase, getSignedDocumentUrl } from '@/lib/supabase-service'

export const runtime = 'nodejs'

// Génère une signed URL temporaire (1h) pour ouvrir/télécharger un document stocké.
// Utilisé par les Client Components qui ont besoin d'une URL fraîche à la demande.
// (Les Server Components utilisent directement getSignedDocumentUrl.)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleRow || !['conseiller', 'client'].includes(roleRow.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Charger le document ───────────────────────────────────────────────────
  const service = createServiceSupabase()
  const { data: doc, error } = await service
    .from('produits_documents')
    .select('id, storage_path, produit_id')
    .eq('id', documentId)
    .single()

  if (error || !doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  if (!doc.storage_path) {
    return NextResponse.json(
      { error: 'Ce document est externe et ne nécessite pas de signed URL' },
      { status: 400 }
    )
  }

  // ── Générer la signed URL ────────────────────────────────────────────────
  const url = await getSignedDocumentUrl(doc.storage_path)
  if (!url) {
    return NextResponse.json({ error: 'Impossible de générer la signed URL' }, { status: 500 })
  }

  return NextResponse.json({ url, expires_in: 3600 })
}
