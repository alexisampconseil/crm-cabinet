import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, modifierDocument, toHttp } from '@/lib/affaires'

const Schema = z.object({
  versionAttendue: z.number().int().nonnegative(),
  statut: z.enum(['attendu', 'depose', 'valide', 'refuse', 'non_requis']),
})

// POST /api/affaires/:id/documents/:documentId — changer le statut d'un document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { id, documentId } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const result = await modifierDocument(supabase, {
      affaireId: id, versionAttendue: parsed.data.versionAttendue, elementId: documentId, statut: parsed.data.statut,
    })
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
