import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp } from '@/lib/affaires'

const Schema = z.object({
  libelle: z.string().min(1).max(150).optional(),
  ordre: z.number().int().nonnegative().optional(),
  actif: z.boolean().optional(),
  necessite_commentaire: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ motifId: string }> }) {
  const { motifId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const row = await parametrage.updateMotif(supabase, motifId, parsed.data)
    return NextResponse.json(row)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
