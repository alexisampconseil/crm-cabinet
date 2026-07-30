import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp } from '@/lib/affaires'

const CATS_PATRIMOINE = ['actif_financier', 'patrimoine_immobilier', 'passif', 'contrat_prevoyance'] as const
const CATS_PRODUIT = ['OPCVM', 'FIA', 'assurance_vie', 'capitalisation', 'per_individuel', 'per_collectif', 'scpi', 'opci', 'produit_structure', 'autre'] as const

const Schema = z.object({
  libelle: z.string().min(1).max(150).optional(),
  ordre: z.number().int().nonnegative().optional(),
  actif: z.boolean().optional(),
  categorie_patrimoniale: z.enum(CATS_PATRIMOINE).nullish(),
  categorie_produit: z.enum(CATS_PRODUIT).nullish(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ typeId: string }> }) {
  const { typeId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const row = await parametrage.updateType(supabase, typeId, parsed.data)
    return NextResponse.json(row)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
