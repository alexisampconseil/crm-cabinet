import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { countEcartsARevoir } from '@/lib/collecte'

// POST /api/collecte/sessions/:id/valider
// Transition en_revue → valide après revue complète de tous les écarts.
// Le statut valide signifie "revue conseiller terminée".
// Aucune application au référentiel n'est effectuée ici — réservé à la Phase 7.
// Les écarts accepte/rejete restent tels quels ; traite est réservé à la Phase 7.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!userRole || userRole.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès réservé aux conseillers' }, { status: 403 })
  }

  const { data: sessionData } = await supabaseAdmin
    .from('collecte_sessions')
    .select('id, statut')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sessionData) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  if (sessionData.statut !== 'en_revue') {
    return NextResponse.json(
      { error: `La validation n'est possible qu'en statut "en_revue" (statut actuel : ${sessionData.statut})` },
      { status: 409 }
    )
  }

  const nbARevoir = await countEcartsARevoir(sessionId, supabaseAdmin)
  if (nbARevoir > 0) {
    return NextResponse.json(
      {
        error: `${nbARevoir} écart${nbARevoir > 1 ? 's' : ''} rest${nbARevoir > 1 ? 'ent' : 'e'} à décider avant de valider`,
      },
      { status: 409 }
    )
  }

  // Le trigger trg_cs_set_dates (migration 014) remplit date_validation automatiquement.
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('collecte_sessions')
    .update({ statut: 'valide' })
    .eq('id', sessionId)
    .select('statut, date_validation')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ statut: updated.statut, date_validation: updated.date_validation })
}
