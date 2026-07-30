import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, archiverFrise, toHttp } from '@/lib/affaires'

// POST /api/affaires/parametrage/frises/:versionId/archiver
export async function POST(_request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const row = await archiverFrise(supabase, versionId)
    return NextResponse.json(row)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
