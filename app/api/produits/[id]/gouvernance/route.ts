import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'

export const runtime = 'nodejs'

// Champs du marché cible — déclenchent les règles de modification manuelle
const CHAMPS_MC = new Set([
  'mc_pos_connaissance', 'mc_pos_experience', 'mc_pos_capacite_pertes',
  'mc_pos_tolerance_risque', 'mc_pos_horizon', 'mc_pos_sensibilite_esg',
  'mc_neg_connaissance', 'mc_neg_experience', 'mc_neg_capacite_pertes',
  'mc_neg_tolerance_risque', 'mc_neg_horizon', 'mc_neg_sensibilite_esg',
  'mc_emetteur_texte',
])

const CHAMPS_AUTORISES = new Set([
  ...CHAMPS_MC,
  'statut_conformite', 'statut_validation',
  'public_exclu', 'conditions_acces', 'conflits_interet', 'notes_gouvernance',
  'frequence_revue', 'date_derniere_revue', 'date_prochaine_revue',
  'responsable_revue', 'alerte_revue',
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: produitId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  let toucheMC = false

  for (const [key, value] of Object.entries(body)) {
    if (CHAMPS_AUTORISES.has(key)) {
      update[key] = value
      if (CHAMPS_MC.has(key)) toucheMC = true
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ valide fourni' }, { status: 400 })
  }

  // Règle : toute modification manuelle d'un champ MC → source = manuel, statut → a_valider
  if (toucheMC) {
    update.source_marche_cible = 'manuel'
    if (!update.statut_validation) {
      update.statut_validation = 'a_valider'
    }
  }

  const service = createServiceSupabase()
  const { error } = await service
    .from('produits_gouvernance')
    .update(update)
    .eq('produit_id', produitId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
