import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, getDonneesCreation, toHttp } from '@/lib/affaires'

// GET /api/affaires/referentiel — données pour le formulaire de création
// (familles, types, partenaires, frises publiées actives).
export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const data = await getDonneesCreation(supabase)
    return NextResponse.json(data)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
