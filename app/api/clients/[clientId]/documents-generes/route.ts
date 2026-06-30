import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getDocumentsByClient } from '@/lib/documents-generes'
import type { DocumentTemplateCode } from '@/lib/documents-generes'

export const runtime = 'nodejs'

// GET /api/clients/:clientId/documents-generes?template_code=kyc_particulier
// Historique des documents générés pour un client — un par snapshot finalisé.
// Filtré par RLS via le client supabase lié à la session (conseiller : tous
// les clients ; client : uniquement le sien).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const templateCode = request.nextUrl.searchParams.get('template_code') as
    | DocumentTemplateCode
    | null

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const documents = await getDocumentsByClient(
      clientId,
      supabase,
      templateCode ?? undefined
    )
    return NextResponse.json({ documents })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors du chargement des documents'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
