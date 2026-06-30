import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/documents-generes/:archiveId
// Métadonnées d'un document généré (KYC aujourd'hui, autres modèles demain).
// Pas de vérification applicative d'accès ici : la requête passe par le client
// supabase lié à la session de l'utilisateur, donc par les policies RLS de
// documents_generes (conseiller : tout ; client : uniquement ses documents).
// Un utilisateur sans droit reçoit simplement "introuvable", pas une erreur
// distincte — comportement RLS standard déjà utilisé sur patrimoine_snapshots.
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
    .select('*')
    .eq('id', archiveId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!document) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  return NextResponse.json({ document })
}
