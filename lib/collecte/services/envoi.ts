import type { SupabaseClient } from '@supabase/supabase-js'
import type { OuvrirSessionResult } from '../types'
import { getSession, updateSessionPrefillEtStatut } from '../repository/sessions'
import { getVersionActive } from '../repository/versions'
import { buildSnapshotPrefill } from './prefill'

// Ouvre une session : brouillon → en_cours.
// Séquence :
//   1. Vérifie que la session est en statut brouillon.
//   2. Récupère la version active du questionnaire.
//   3. Construit le snapshot_prefill à partir du référentiel courant.
//   4. Persiste les trois champs en une requête atomique.
//   5. Le trigger trg_cs_set_dates (migration 014) renseigne date_ouverture.
export async function ouvrirSession(
  sessionId: string,
  supabase: SupabaseClient
): Promise<OuvrirSessionResult> {
  const session = await getSession(sessionId, supabase)

  if (session.statut !== 'brouillon') {
    throw new Error(
      `La session ${sessionId} est en statut "${session.statut}" — seul le statut "brouillon" permet l'ouverture.`
    )
  }

  const versionActive = await getVersionActive(supabase)
  if (!versionActive) {
    throw new Error(
      "Aucune version de questionnaire active. Publiez une version avant d'ouvrir une session."
    )
  }

  const prefill = await buildSnapshotPrefill(session.client_id, supabase)

  const sessionMaj = await updateSessionPrefillEtStatut(
    sessionId,
    prefill,
    versionActive.id,
    supabase
  )

  return { session: sessionMaj, prefill }
}
