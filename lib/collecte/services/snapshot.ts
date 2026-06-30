import type { SupabaseClient } from '@supabase/supabase-js'
import type { PatrimoineSnapshot, PatrimoineSnapshotDeclencheur } from '../types'
import { buildSnapshotPrefill, computeSnapshotChecksum } from './prefill'

export interface CreerSnapshotFinaliseParams {
  clientId:        string
  sessionId:       string | null
  typeDeclencheur: PatrimoineSnapshotDeclencheur
  userId:          string
}

// Crée et finalise immédiatement un patrimoine_snapshot à partir du
// référentiel courant du client. Utilisée dans deux contextes :
//
//   - Via une session de collecte (appliquer-ecarts, typeDeclencheur =
//     'validation_session', sessionId non null) — le snapshot capture l'état
//     du référentiel APRÈS application des écarts.
//
//   - Directement depuis la fiche client conseiller (typeDeclencheur = 'manuel',
//     sessionId = null) — le snapshot capture l'état courant du CRM sans
//     qu'une collecte KYC soit nécessaire.
//
// Dans les deux cas, le snapshot généré est immédiatement finalisé (statut
// 'finalise', checksum calculé) et immuable dès insertion (trigger
// fn_guard_snapshot de la migration 012).
export async function creerSnapshotFinalise(
  { clientId, sessionId, typeDeclencheur, userId }: CreerSnapshotFinaliseParams,
  supabase: SupabaseClient
): Promise<PatrimoineSnapshot> {
  const prefill   = await buildSnapshotPrefill(clientId, supabase)
  const genere_le = new Date().toISOString()
  const checksum  = computeSnapshotChecksum({
    client_id:        clientId,
    genere_le,
    session_id:       sessionId,
    snapshot:         prefill,
    type_declencheur: typeDeclencheur,
    version_schema:   '1.0',
  })

  const { data, error } = await supabase
    .from('patrimoine_snapshots')
    .insert({
      client_id:        clientId,
      session_id:       sessionId,
      type_declencheur: typeDeclencheur,
      version_schema:   '1.0',
      statut:           'finalise',
      snapshot:         prefill,
      checksum,
      genere_par:       userId,
      genere_le,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PatrimoineSnapshot
}
