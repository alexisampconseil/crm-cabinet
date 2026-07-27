import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, corrigerRevenu, toHttp } from '@/lib/affaires'

const Schema = z.object({
  versionAttendue: z.number().int().nonnegative(),
  revenu: z.number().nonnegative(),
  motif: z.string().min(1),
})

// POST /api/affaires/:id/corriger-revenu — corriger le revenu réalisé
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide (revenu ≥ 0 et motif requis)' }, { status: 400 })
    const result = await corrigerRevenu(supabase, { affaireId: id, ...parsed.data })
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
