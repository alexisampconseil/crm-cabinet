import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp } from '@/lib/affaires'

const Schema = z.object({
  code: z.string().min(1).max(50),
  libelle: z.string().min(1).max(150),
  ordre: z.number().int().nonnegative().optional(),
  actif: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const row = await parametrage.createFamille(supabase, parsed.data)
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
