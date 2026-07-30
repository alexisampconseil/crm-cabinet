import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import {
  requireConseiller, peutParametrer, toHttp,
  listFamilles, listTypes, listPartenaires, listMotifs, listFrises,
} from '@/lib/affaires'

// GET /api/affaires/parametrage — configuration complète pour l'écran d'admin.
export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requireConseiller(supabase)
    const [peut_parametrer, familles, types, partenaires, motifs, frises] = await Promise.all([
      peutParametrer(supabase),
      listFamilles(supabase), listTypes(supabase), listPartenaires(supabase),
      listMotifs(supabase), listFrises(supabase),
    ])
    return NextResponse.json({ peut_parametrer, familles, types, partenaires, motifs, frises })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
