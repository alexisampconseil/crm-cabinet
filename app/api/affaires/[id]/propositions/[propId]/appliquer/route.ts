import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, appliquerProposition, toHttp } from '@/lib/affaires'

const Schema = z.object({ versionAttendue: z.number().int().nonnegative() })

// POST /api/affaires/:id/propositions/:propId/appliquer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; propId: string }> }
) {
  const { id, propId } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const body = await request.json().catch(() => null)
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const result = await appliquerProposition(supabase, {
      affaireId: id, propositionId: propId, versionAttendue: parsed.data.versionAttendue,
    })
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
