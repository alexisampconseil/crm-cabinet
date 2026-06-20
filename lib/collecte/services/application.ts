import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionEcart } from '../types'
import { ECART_MAPPING, type ColonneType } from '../mapping'
import { recalculerCompteurs } from '../repository/sessions'

export interface ApplicationResult {
  applied: number
  errors:  Array<{ ecart_id: string; message: string }>
}

// Coerce valeur_proposee.valeur (toujours string | null) vers le type SQL cible.
function coerceValeur(valeur: string | null, type: ColonneType): unknown {
  if (valeur === null || valeur === '') return null
  switch (type) {
    case 'number': {
      const n = parseFloat(valeur)
      if (isNaN(n)) throw new Error(`Valeur numérique invalide : "${valeur}"`)
      return n
    }
    case 'boolean':
      return valeur === 'true'
    case 'array': {
      try { return JSON.parse(valeur) } catch {
        throw new Error(`Tableau JSON invalide : "${valeur}"`)
      }
    }
    default:
      return valeur
  }
}

// Applique les écarts statut='accepte' non encore traités au référentiel patrimonial.
// Groupement par (entite_cible, entite_id) pour 1 UPDATE par ligne du référentiel.
// Tables simples  (entite_id IS NULL)  : WHERE client_id = clientId
// Tables répétables (entite_id IS NOT NULL) : WHERE id = entite_id
// Traçabilité : statut='traite', applique_le sur chaque écart appliqué.
// session_ecarts n'a pas de colonne applique_par (migration 010) — seul applique_le
// est tracé. userId est conservé dans la signature pour un futur ajout de colonne.
// Idempotent : filtre applique_le IS NULL — un écart traite n'est jamais recalculé.
export async function appliquerEcarts(
  sessionId: string,
  clientId:  string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId:    string,
  supabase:  SupabaseClient
): Promise<ApplicationResult> {

  // 1. Charger les écarts acceptés non encore appliqués
  const { data: ecartsRaw, error: fetchError } = await supabase
    .from('session_ecarts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('statut', 'accepte')
    .is('applique_le', null)
  if (fetchError) throw fetchError

  const ecarts = (ecartsRaw ?? []) as SessionEcart[]
  if (ecarts.length === 0) return { applied: 0, errors: [] }

  // 2. Construire les batches d'UPDATE (1 par entité du référentiel)
  type Batch = {
    entite_cible: string
    entite_id:    string | null
    columns:      Record<string, unknown>
    ecart_ids:    string[]
  }

  const errors: Array<{ ecart_id: string; message: string }> = []
  const batchMap = new Map<string, Batch>()

  for (const ecart of ecarts) {
    const mappingKey = `${ecart.question_code}|${ecart.portee}`
    const entry = ECART_MAPPING[mappingKey]
    if (!entry) continue
    if (!ecart.colonne_cible) continue

    const batchKey = `${ecart.entite_cible}::${ecart.entite_id ?? '__simple__'}`
    if (!batchMap.has(batchKey)) {
      batchMap.set(batchKey, {
        entite_cible: ecart.entite_cible,
        entite_id:    ecart.entite_id,
        columns:      {},
        ecart_ids:    [],
      })
    }

    const batch     = batchMap.get(batchKey)!
    const valeurRaw = (ecart.valeur_proposee as { valeur: string | null } | null)?.valeur ?? null

    try {
      batch.columns[ecart.colonne_cible] = coerceValeur(valeurRaw, entry.colonne_type)
      batch.ecart_ids.push(ecart.id)
    } catch (err) {
      errors.push({
        ecart_id: ecart.id,
        message:  err instanceof Error ? err.message : 'Erreur de coercion',
      })
    }
  }

  // 3. Exécuter chaque batch
  let applied = 0

  for (const batch of batchMap.values()) {
    if (batch.ecart_ids.length === 0) continue

    try {
      // Supabase sans types générés — accès dynamique à la table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (supabase as any).from(batch.entite_cible)
      let updateError: { message: string } | null = null

      if (batch.entite_id) {
        const res = await table.update(batch.columns).eq('id', batch.entite_id)
        updateError = res.error
      } else {
        const res = await table.update(batch.columns).eq('client_id', clientId)
        updateError = res.error
      }

      if (updateError) throw new Error(updateError.message)

      // Traçabilité : marquer les écarts du batch en 'traite'
      const { error: traceError } = await supabase
        .from('session_ecarts')
        .update({
          statut:      'traite' as const,
          applique_le: new Date().toISOString(),
        })
        .in('id', batch.ecart_ids)
      if (traceError) throw new Error(traceError.message)

      applied += batch.ecart_ids.length
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      for (const id of batch.ecart_ids) {
        errors.push({ ecart_id: id, message: msg })
      }
    }
  }

  // 4. Recalculer nb_ecarts_traites
  await recalculerCompteurs(sessionId, supabase)

  return { applied, errors }
}
