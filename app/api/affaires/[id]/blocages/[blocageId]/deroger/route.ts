import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, derogerBlocage, toHttp } from '@/lib/affaires'

const Schema = z.object({
  versionAttendue: z.number().int().nonnegative(),
  motif: z.string().min(1),
})

// POST /api/affaires/:id/blocages/:blocageId/deroger — déroger à un blocage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blocageId: string }> }
) {
  const { id, blocageId } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Un motif est requis' }, { status: 400 })
    const result = await derogerBlocage(supabase, {
      affaireId: id, versionAttendue: parsed.data.versionAttendue, blocageId, motif: parsed.data.motif,
    })
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
