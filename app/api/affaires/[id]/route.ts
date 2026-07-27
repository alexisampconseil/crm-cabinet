import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import {
  requireConseiller, getAffaireDetail, getAffaireEvenements, getAffairePropositions,
  modifierInfos, toHttp,
} from '@/lib/affaires'

// GET /api/affaires/:id — détail (frise + événements + propositions)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const detail = await getAffaireDetail(supabase, id)
    if (!detail) return NextResponse.json({ error: 'Affaire introuvable' }, { status: 404 })
    const [evenements, propositions] = await Promise.all([
      getAffaireEvenements(supabase, id),
      getAffairePropositions(supabase, id),
    ])
    return NextResponse.json({ ...detail, evenements, propositions })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}

const PatchSchema = z.object({
  versionAttendue: z.number().int().nonnegative(),
  libelle: z.string().min(1).max(300),
  montant: z.number().nonnegative().nullish(),
  frais: z.number().nonnegative().nullish(),
  revenuPrevisionnel: z.number().nonnegative().nullish(),
  produitId: z.string().uuid().nullish(),
  partenaireId: z.string().uuid().nullish(),
})

// PATCH /api/affaires/:id — modifier les informations
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 })
    }
    const result = await modifierInfos(supabase, { affaireId: id, ...parsed.data })
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
