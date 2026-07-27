import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, creerProposition, getAffairePropositions, toHttp } from '@/lib/affaires'

const CreateSchema = z.object({
  versionAttendue: z.number().int().nonnegative(),
  operation: z.enum(['creation', 'mise_a_jour']),
  cibleType: z.enum(['actif_financier', 'patrimoine_immobilier', 'passif', 'contrat_prevoyance']),
  donnees: z.record(z.string(), z.unknown()).default({}),
  actifFinancierId: z.string().uuid().nullish(),
  patrimoineImmobilierId: z.string().uuid().nullish(),
  passifId: z.string().uuid().nullish(),
  contratPrevoyanceId: z.string().uuid().nullish(),
})

// POST /api/affaires/:id/propositions — créer une proposition patrimoniale
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 })
    }
    const result = await creerProposition(supabase, { affaireId: id, ...parsed.data })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}

// GET /api/affaires/:id/propositions — lister les propositions de l'affaire
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const propositions = await getAffairePropositions(supabase, id)
    return NextResponse.json({ propositions })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
