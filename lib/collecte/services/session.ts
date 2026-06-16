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
      notes: params.notes,
    },
    supabase
  )
}
