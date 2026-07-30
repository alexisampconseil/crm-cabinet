import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, publierFrise, toHttp } from '@/lib/affaires'

// POST /api/affaires/parametrage/frises/:versionId/publier
export async function POST(_request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const row = await publierFrise(supabase, versionId)
    return NextResponse.json(row)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
