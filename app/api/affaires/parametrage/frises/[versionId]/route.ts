import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, getFriseDetail, toHttp } from '@/lib/affaires'

// GET /api/affaires/parametrage/frises/:versionId — détail complet d'une version
export async function GET(_request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const detail = await getFriseDetail(supabase, versionId)
    if (!detail) return NextResponse.json({ error: 'Version introuvable' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
