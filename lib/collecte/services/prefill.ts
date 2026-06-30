import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SnapshotPrefill } from '../types'
import {
  readIdentite,
  readFoyer,
  readSituationPro,
  readActifsFinanciers,
  readPatrimoineImmobilier,
  readPassifs,
  readBudget,
  readFiscalite,
  readPrevoyance,
  readObjectifs,
} from '../repository/prefill'

// ── Checksum ──────────────────────────────────────────────────────────────────

export interface SnapshotChecksumInput {
  client_id:        string
  genere_le:        string
  // Nullable : un snapshot généré hors session (type_declencheur='manuel' ou
  // 'bilan_annuel') a session_id=null, ce qui est représenté tel quel dans le
  // canonical pour garantir un checksum stable et cohérent avec la DB.
  session_id:       string | null
  snapshot:         SnapshotPrefill
  type_declencheur: string
  version_schema:   string
}

// Sérialisation déterministe : toutes les clés d'objet triées alphabétiquement,
// récursivement. Les tableaux conservent leur ordre (sémantiquement ordonné).
function sortedJsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k]
      }
      return sorted
    }
    return val
  })
}

// Calcule le SHA-256 du snapshot selon le contrat de migration 014 §14c §D.
// Le canonical couvre exactement les 6 champs identifiants du snapshot :
// client_id, genere_le, session_id, snapshot, type_declencheur, version_schema.
export function computeSnapshotChecksum(input: SnapshotChecksumInput): string {
  const canonical: SnapshotChecksumInput = {
    client_id:        input.client_id,
    genere_le:        input.genere_le,
    session_id:       input.session_id,
    snapshot:         input.snapshot,
    type_declencheur: input.type_declencheur,
    version_schema:   input.version_schema,
  }
  return createHash('sha256')
    .update(sortedJsonStringify(canonical))
    .digest('hex')
}

// Assemble le snapshot_prefill à partir de l'état courant du référentiel.
// Toutes les lectures sont lancées en parallèle (Promise.all).
// Appelée lors du passage brouillon → en_cours — capture l'état du référentiel
// au moment exact où la session est ouverte (pas à sa création).
export async function buildSnapshotPrefill(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefill> {
  const [
    identite,
    foyer,
    situation_professionnelle,
    patrimoine_financier,
    patrimoine_immobilier,
    passifs,
    budget,
    fiscalite,
    prevoyance,
    objectifs,
  ] = await Promise.all([
    readIdentite(clientId, supabase),
    readFoyer(clientId, supabase),
    readSituationPro(clientId, supabase),
    readActifsFinanciers(clientId, supabase),
    readPatrimoineImmobilier(clientId, supabase),
    readPassifs(clientId, supabase),
    readBudget(clientId, supabase),
    readFiscalite(clientId, supabase),
    readPrevoyance(clientId, supabase),
    readObjectifs(clientId, supabase),
  ])

  return {
    version_schema: '1.0',
    date_reference: new Date().toISOString().slice(0, 10),
    identite,
    foyer,
    situation_professionnelle,
    patrimoine_financier,
    patrimoine_immobilier,
    passifs,
    budget,
    fiscalite,
    prevoyance,
    objectifs,
  }
}
