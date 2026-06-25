import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionEcart, SessionEcartTypeEcart } from '../types'
import { ECART_MAPPING, COLONNES_OBLIGATOIRES_INSERT, type ColonneType } from '../mapping'
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
// Groupement par (entite_cible, entite_id) pour 1 opération par ligne du référentiel.
// type_ecart='modification' :
//   Tables simples  (entite_id IS NULL)  : UPDATE WHERE client_id = clientId
//   Tables répétables (entite_id IS NOT NULL) : UPDATE WHERE id = entite_id
// type_ecart='ajout' :
//   INSERT avec entite_id = faux UUID temporaire (généré côté client) — remplacé
//   par l'id réel après succès. Voir COLONNES_OBLIGATOIRES_INSERT (mapping.ts).
// type_ecart='suppression' :
//   DELETE WHERE id = entite_id — entite_id est déjà l'id réel (l'instance
//   existait dans le snapshot). Aucune colonne à fusionner ni à vérifier.
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

  // 2. Construire les batches (1 par entité du référentiel — UPDATE ou INSERT)
  type Batch = {
    entite_cible: string
    entite_id:    string | null
    bloc:         string
    type_ecart:   SessionEcartTypeEcart
    columns:      Record<string, unknown>
    // Sous-champs JSONB en attente de fusion, indexés par colonne JSONB.
    // colonne_cible "detail.mode_detention" → jsonColumns.detail.mode_detention.
    // Fusionnés dans `columns` juste avant l'exécution (cf. étape 3) — jamais
    // un UPDATE direct sur une colonne nommée "detail.mode_detention".
    jsonColumns:  Record<string, Record<string, unknown>>
    ecart_ids:    string[]
  }

  const errors: Array<{ ecart_id: string; message: string }> = []
  const batchMap = new Map<string, Batch>()

  for (const ecart of ecarts) {
    const mappingKey = `${ecart.question_code}|${ecart.portee}`
    const entry = ECART_MAPPING[mappingKey]
    if (!entry) continue
    // Une suppression n'a pas de colonne_cible (rien à modifier, la ligne
    // entière sera supprimée) — seuls modification/ajout en exigent une.
    if (!ecart.colonne_cible && ecart.type_ecart !== 'suppression') continue

    const batchKey = `${ecart.entite_cible}::${ecart.entite_id ?? '__simple__'}`
    if (!batchMap.has(batchKey)) {
      batchMap.set(batchKey, {
        entite_cible: ecart.entite_cible,
        entite_id:    ecart.entite_id,
        bloc:         ecart.bloc,
        type_ecart:   ecart.type_ecart,
        columns:      {},
        jsonColumns:  {},
        ecart_ids:    [],
      })
    }

    const batch = batchMap.get(batchKey)!

    if (ecart.type_ecart === 'suppression') {
      batch.ecart_ids.push(ecart.id)
      continue
    }

    const valeurRaw = (ecart.valeur_proposee as { valeur: string | null } | null)?.valeur ?? null

    try {
      const valeur = coerceValeur(valeurRaw, entry.colonne_type)
      const [colonneOuJson, sousChamp] = (ecart.colonne_cible as string).split('.')

      if (sousChamp) {
        if (!batch.jsonColumns[colonneOuJson]) batch.jsonColumns[colonneOuJson] = {}
        batch.jsonColumns[colonneOuJson][sousChamp] = valeur
      } else {
        batch.columns[colonneOuJson] = valeur
      }
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
      let opError: { message: string } | null = null
      let nouvelId: string | null = null

      // Fusion des sous-champs JSONB avant l'INSERT/UPDATE.
      // Ajout (nouvelle ligne) : aucun existant à préserver, le sous-objet
      // devient directement la valeur de la colonne JSONB.
      // Modification (ligne existante) : lire la valeur JSONB actuelle pour
      // ne pas écraser les sous-champs déjà renseignés par ailleurs (CRM ou
      // précédente application d'écarts).
      // Suppression : aucune colonne, sans objet — jsonColumns est toujours vide.
      const jsonColNames = Object.keys(batch.jsonColumns)
      if (jsonColNames.length > 0) {
        if (batch.type_ecart === 'ajout') {
          for (const [jsonCol, sousChamps] of Object.entries(batch.jsonColumns)) {
            batch.columns[jsonCol] = sousChamps
          }
        } else {
          const selectCols = jsonColNames.join(',')
          const lecture = batch.entite_id
            ? await table.select(selectCols).eq('id', batch.entite_id).maybeSingle()
            : await table.select(selectCols).eq('client_id', clientId).maybeSingle()
          if (lecture.error) throw new Error(lecture.error.message)

          for (const jsonCol of jsonColNames) {
            const existant = (lecture.data?.[jsonCol] ?? {}) as Record<string, unknown>
            batch.columns[jsonCol] = { ...existant, ...batch.jsonColumns[jsonCol] }
          }
        }
      }

      if (batch.type_ecart === 'suppression') {
        const res = await table.delete().eq('id', batch.entite_id)
        opError = res.error
      } else if (batch.type_ecart === 'ajout') {
        const columns: Record<string, unknown> = { ...batch.columns, client_id: clientId }

        // Cas spécial : budget_postes.type n'est jamais saisi par le client —
        // dérivé du bloc d'origine ('revenus' → 'revenu', 'charges' → 'charge').
        if (batch.entite_cible === 'budget_postes') {
          columns.type = batch.bloc === 'revenus' ? 'revenu' : 'charge'
        }

        // Défense en profondeur : vérifier les colonnes NOT NULL avant l'INSERT.
        // En pratique ne devrait jamais se produire (champs déjà obligatoires
        // côté questionnaire), sauf décision partielle contournant l'UI groupée.
        const requises   = COLONNES_OBLIGATOIRES_INSERT[batch.entite_cible] ?? []
        const manquantes = requises.filter(col => columns[col] === undefined || columns[col] === null || columns[col] === '')
        if (manquantes.length > 0) {
          throw new Error(`Champ(s) obligatoire(s) manquant(s) pour l'ajout : ${manquantes.join(', ')}`)
        }

        const res = await table.insert(columns).select('id').single()
        opError = res.error
        if (!res.error) nouvelId = res.data.id
      } else if (batch.entite_id) {
        const res = await table.update(batch.columns).eq('id', batch.entite_id)
        opError = res.error
      } else {
        const res = await table.update(batch.columns).eq('client_id', clientId)
        opError = res.error
      }

      if (opError) throw new Error(opError.message)

      // Traçabilité : marquer les écarts du batch en 'traite'
      const { error: traceError } = await supabase
        .from('session_ecarts')
        .update({
          statut:      'traite' as const,
          applique_le: new Date().toISOString(),
        })
        .in('id', batch.ecart_ids)
      if (traceError) throw new Error(traceError.message)

      // Remplacer l'entite_id temporaire (faux UUID côté client) par l'id réel
      // généré par l'INSERT — préserve la traçabilité (snapshot, audit futur).
      if (batch.type_ecart === 'ajout' && nouvelId) {
        const { error: idError } = await supabase
          .from('session_ecarts')
          .update({ entite_id: nouvelId })
          .in('id', batch.ecart_ids)
        if (idError) throw new Error(idError.message)
      }

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
