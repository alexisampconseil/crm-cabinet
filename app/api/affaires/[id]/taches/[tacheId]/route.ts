import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, modifierTache, toHttp } from '@/lib/affaires'

const Schema = z.object({
  versionAttendue: z.number().int().nonnegative(),
  statut: z.enum(['a_faire', 'en_cours', 'terminee', 'ignoree']),
})

// POST /api/affaires/:id/taches/:tacheId — changer le statut d'une tâche
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tacheId: string }> }
) {
  const { id, tacheId } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const result = await modifierTache(supabase, {
      affaireId: id, versionAttendue: parsed.data.versionAttendue, elementId: tacheId, statut: parsed.data.statut,
    })
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
