import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'

export const runtime = 'nodejs'

const BUCKET = 'produits-documents'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const service = createServiceSupabase()

  // Récupérer le document pour obtenir le storage_path
  const { data: doc, error: docError } = await service
    .from('produits_documents')
    .select('id, storage_path')
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  }

  // Supprimer le fichier Storage (erreur ignorée si déjà absent)
  if (doc.storage_path) {
    await service.storage.from(BUCKET).remove([doc.storage_path])
  }

  // Si ce document était la source d'une analyse gouvernance → invalider
  await service
    .from('produits_gouvernance')
    .update({ source_document_id: null, statut_validation: 'a_valider' })
    .eq('source_document_id', documentId)

  // Supprimer les extraits liés
  await service
    .from('documents_extraits')
    .delete()
    .eq('document_id', documentId)

  // Supprimer le document lui-même
  const { error: delError } = await service
    .from('produits_documents')
    .delete()
    .eq('id', documentId)

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
