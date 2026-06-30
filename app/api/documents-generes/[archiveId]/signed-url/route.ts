import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getSignedDocumentUrl } from '@/lib/supabase-service'

export const runtime = 'nodejs'

const BUCKET = 'documents-generes'
const SIGNED_URL_TTL = 3600

// GET /api/documents-generes/:archiveId/signed-url
// Génère une signed URL temporaire (1h) pour télécharger un document généré.
// Le document est d'abord chargé via le client lié à la session utilisateur —
// les policies RLS de documents_generes filtrent l'accès (conseiller : tout ;
// client : ses documents uniquement). Seul un document accessible donne lieu
// à une signed URL ; le bucket lui-même est privé et sans policy storage.objects
// (migration 018) — toute lecture passe par cette route, jamais par une URL
// publique ou un accès direct au bucket.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ archiveId: string }> }
) {
  const { archiveId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: document, error } = await supabase
    .from('documents_generes')
    .select('id, storage_path')
    .eq('id', archiveId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!document) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  const url = await getSignedDocumentUrl(document.storage_path, SIGNED_URL_TTL, BUCKET)
  if (!url) {
    return NextResponse.json({ error: 'Impossible de générer la signed URL' }, { status: 500 })
  }

  return NextResponse.json({ url, expires_in: SIGNED_URL_TTL })
}
