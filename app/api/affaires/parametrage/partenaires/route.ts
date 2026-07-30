import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp } from '@/lib/affaires'

const TYPES = ['assureur', 'plateforme', 'courtier', 'banque', 'societe_gestion', 'autre'] as const
const Schema = z.object({
  nom: z.string().min(1).max(200),
  type_partenaire: z.enum(TYPES),
  actif: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const row = await parametrage.createPartenaire(supabase, parsed.data)
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
