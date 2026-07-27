import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, modifierChamp, toHttp } from '@/lib/affaires'

const Schema = z.object({
  versionAttendue: z.number().int().nonnegative(),
  // valeur JSON libre (null autorisé) ; le type réel est validé côté RPC.
  valeur: z.unknown().nullable().optional(),
})

// POST /api/affaires/:id/champs/:champValeurId — modifier une valeur de champ
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; champValeurId: string }> }
) {
  const { id, champValeurId } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const result = await modifierChamp(supabase, {
      affaireId: id, champValeurId, versionAttendue: parsed.data.versionAttendue,
      valeur: parsed.data.valeur ?? null,
    })
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
