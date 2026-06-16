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
