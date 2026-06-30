import type { SupabaseClient } from '@supabase/supabase-js'
import type { CollecteSession, CreeSessionParams } from '../types'
import { getSessionActive, createSession } from '../repository/sessions'

// Crée une session de collecte en statut 'brouillon'.
// Vérifie qu'aucune session active (brouillon ou en_cours) n'existe déjà
// pour ce client — une seule session active à la fois est autorisée.
// La version du questionnaire et le snapshot_prefill sont attachés lors de
// l'ouverture (ouvrirSession), pas ici.
export async function creerSession(
  params: CreeSessionParams,
  supabase: SupabaseClient
): Promise<CollecteSession> {
  // Le parcours de mise à jour annuelle simplifié est réservé aux clients
  // dont un premier KYC complet est déjà enregistré — pas aux prospects ni
  // aux nouveaux clients dont le référentiel est vide.
  if (params.type === 'verification_annuelle') {
    const { data: client } = await supabase
      .from('clients')
      .select('statut, kyc_status')
      .eq('id', params.clientId)
      .maybeSingle()

    if (!client || client.statut === 'prospect' || client.kyc_status === 'non_fait') {
      throw new Error(
        "Le parcours de mise à jour annuelle n'est disponible que pour les clients dont un premier KYC est déjà complété."
      )
    }
  }

  const existante = await getSessionActive(params.clientId, supabase)
  if (existante) {
    throw new Error(
      `Une session est déjà en cours pour ce client (id: ${existante.id}, statut: ${existante.statut})`
    )
  }

  return createSession(
    {
      client_id: params.clientId,
      perimetre: params.perimetre ?? 'client_seul',
      type: params.type,
      canal: params.canal,
      notes_conseiller: params.notes_conseiller,
    },
    supabase
  )
}
