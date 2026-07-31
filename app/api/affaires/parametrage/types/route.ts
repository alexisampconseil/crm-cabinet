import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp, uniqueCode, nextOrdre } from '@/lib/affaires'

const CATS_PATRIMOINE = ['actif_financier', 'patrimoine_immobilier', 'passif', 'contrat_prevoyance'] as const
const CATS_PRODUIT = ['OPCVM', 'FIA', 'assurance_vie', 'capitalisation', 'per_individuel', 'per_collectif', 'scpi', 'opci', 'produit_structure', 'autre'] as const

// Le conseiller ne fournit que la famille et le libellé ; le code technique et
// l'ordre sont générés automatiquement à partir du libellé.
const Schema = z.object({
  famille_id: z.string().uuid(),
  libelle: z.string().trim().min(1).max(150),
  categorie_patrimoniale: z.enum(CATS_PATRIMOINE).nullish(),
  categorie_produit: z.enum(CATS_PRODUIT).nullish(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const field = String(first?.path[0] ?? '')
      const msg = field === 'famille_id' ? 'Sélectionnez une famille.'
        : field === 'libelle' ? 'Le libellé du type est obligatoire.'
        : (first?.message ?? 'Données invalides.')
      return NextResponse.json({ error: msg, field }, { status: 400 })
    }
    const { famille_id, libelle, categorie_patrimoniale, categorie_produit } = parsed.data

    const { data: existing, error } = await supabase
      .from('affaire_types').select('code, ordre').eq('famille_id', famille_id)
    if (error) throw error
    const code = uniqueCode(libelle, (existing ?? []).map((r) => r.code as string))
    const ordre = nextOrdre((existing ?? []).map((r) => r.ordre as number))

    const row = await parametrage.createType(supabase, {
      famille_id, libelle, code, ordre,
      categorie_patrimoniale: categorie_patrimoniale ?? null,
      categorie_produit: categorie_produit ?? null,
    })
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
