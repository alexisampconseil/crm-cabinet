import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { requireConseiller, getDonneesCreation, peutParametrer, toHttp } from '@/lib/affaires'

// GET /api/affaires/referentiel — données du formulaire de création
// (familles, types, partenaires, frises publiées actives) + permission de
// paramétrage de l'utilisateur courant.
export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const [data, peut_parametrer] = await Promise.all([
      getDonneesCreation(supabase),
      peutParametrer(supabase),
    ])
    return NextResponse.json({ ...data, peut_parametrer })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
