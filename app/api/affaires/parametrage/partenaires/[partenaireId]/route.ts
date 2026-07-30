import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp } from '@/lib/affaires'

const TYPES = ['assureur', 'plateforme', 'courtier', 'banque', 'societe_gestion', 'autre'] as const
const Schema = z.object({
  nom: z.string().min(1).max(200).optional(),
  type_partenaire: z.enum(TYPES).optional(),
  actif: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ partenaireId: string }> }) {
  const { partenaireId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const row = await parametrage.updatePartenaire(supabase, partenaireId, parsed.data)
    return NextResponse.json(row)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
