import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, creerAffaire, listAffairesByClient, toHttp } from '@/lib/affaires'

const CreateSchema = z.object({
  clientId: z.string().uuid(),
  familleId: z.string().uuid(),
  typeId: z.string().uuid(),
  libelle: z.string().min(1).max(300),
  montant: z.number().nonnegative().nullish(),
  frais: z.number().nonnegative().nullish(),
  revenuPrevisionnel: z.number().nonnegative().nullish(),
  produitId: z.string().uuid().nullish(),
  partenaireId: z.string().uuid().nullish(),
})

// POST /api/affaires — créer une affaire
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 })
    }
    const result = await creerAffaire(supabase, parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}

// GET /api/affaires?clientId=... — lister les affaires d'un client
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
    const affaires = await listAffairesByClient(supabase, clientId)
    return NextResponse.json({ affaires })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
