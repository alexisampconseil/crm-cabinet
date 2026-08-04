import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, modifierEtape, toHttp } from '@/lib/affaires'

const Schema = z.object({
  versionAttendue: z.number().int().nonnegative(),
  statut: z.enum(['a_faire', 'en_cours', 'terminee', 'ignoree']),
  // Date effective optionnelle (jour, sans heure) : 'YYYY-MM-DD'.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
})

// POST /api/affaires/:id/etapes/:etapeId — changer le statut d'une étape
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; etapeId: string }> }
) {
  const { id, etapeId } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const result = await modifierEtape(supabase, {
      affaireId: id, versionAttendue: parsed.data.versionAttendue, elementId: etapeId,
      statut: parsed.data.statut, date: parsed.data.date ?? null,
    })
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
