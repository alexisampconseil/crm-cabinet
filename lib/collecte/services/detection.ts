// =============================================================================
// Service de détection des écarts — Phase 5
//
// Compare questionnaire_reponses (réponses soumises) avec snapshot_prefill
// (état du référentiel au moment de l'ouverture) pour chaque session 'soumis'.
// Crée les lignes session_ecarts correspondantes, puis transite le statut :
//   soumis + 0 écarts → valide
//   soumis + N écarts → en_revue
//
// Limitations v1 (intentionnelles) :
//   - Seul type_ecart = 'modification' (pas d'ajout ni de suppression)
//   - valeur_proposee construit depuis reponse_valeur (string), pas reponse_metadata
//   - Comparaison string normalisée (pas de tolérance numérique)
//   - Groupe_instance_id absent du snapshot → ignoré (log warning)
//
// Les fonctions resolveAbsolutePath / resolveItemField / getSnapshotArray
// dupliquent délibérément la logique de _components/prefillResolver.ts
// (fonctions pures sans dépendance browser).
// TODO Phase 6 : extraire vers lib/collecte/prefillUtils.ts.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SnapshotPrefill,
  QuestionnaireStructure,
  QuestionnaireReponseBloc,
  QuestionnaireReponsePortee,
  SessionEcartNiveauImpact,
} from '../types'
import { ECART_MAPPING } from '../mapping'

// ── Types internes ────────────────────────────────────────────────────────────

// Le statut valide est réservé à la validation conseiller, jamais à la détection automatique.
export interface DetectionResult {
  nb_ecarts:     number
  statut_final:  'en_revue' | 'already_detected' | 'session_invalide'
}

interface QuestionIndexEntry {
  bloc_code:          QuestionnaireReponseBloc
  bloc_libelle:       string
  bloc_repete_source: string | undefined
  prefill_path:       string
  repete:             boolean
  question_libelle:   string
}

interface EcartRow {
  session_id:         string
  reponse_id:         string
  bloc:               string
  question_code:      string
  portee:             string
  groupe_instance_id: string | null
  entite_cible:       string
  colonne_cible:      string
  entite_id:          string | null
  type_ecart:         'modification'
  valeur_reference:   { valeur: string | null }
  valeur_proposee:    { valeur: string | null }
  libelle_lisible:    string
  niveau_impact:      SessionEcartNiveauImpact
  statut:             'a_revoir'
}

// ── Fonctions utilitaires (privées) ───────────────────────────────────────────

function normalizeValue(val: string | null | undefined): string {
  if (val == null) return ''
  return val.trim()
}

function resolveAbsolutePath(obj: unknown, path: string): string {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return ''
    cur = (cur as Record<string, unknown>)[part]
  }
  if (cur == null) return ''
  if (typeof cur === 'boolean') return cur ? 'true' : 'false'
  if (Array.isArray(cur)) return JSON.stringify(cur)
  return String(cur)
}

function resolveItemField(item: Record<string, unknown>, path: string): string {
  const field = path.slice(5)  // retire "item."
  const val = item[field]
  if (val == null) return ''
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (Array.isArray(val)) return JSON.stringify(val)
  return String(val)
}

function getSnapshotArray(
  snapshot: SnapshotPrefill,
  path: string
): Array<Record<string, unknown> & { id: string }> {
  const parts = path.split('.')
  let cur: unknown = snapshot
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return []
    cur = (cur as Record<string, unknown>)[part]
  }
  if (!Array.isArray(cur)) return []
  return cur as Array<Record<string, unknown> & { id: string }>
}

function generateLibelle(
  blocLibelle:      string,
  questionLibelle:  string,
  portee:           string,
  snapshotNorm:     string,
  reponseNorm:      string,
  instanceIndex?:   number
): string {
  const porteeLabel    = portee === 'conjoint' ? ' (conjoint)' : ''
  const instanceLabel  = instanceIndex != null ? ` — Élément ${instanceIndex + 1}` : ''
  const prev = snapshotNorm ? `« ${snapshotNorm} »` : '(vide)'
  const next = reponseNorm  ? `« ${reponseNorm} »` : '(vide)'
  return `${blocLibelle} — ${questionLibelle}${porteeLabel}${instanceLabel} : ${prev} → ${next}`
}

// ── Service principal ─────────────────────────────────────────────────────────

export async function detecterEcarts(
  sessionId: string,
  supabase:  SupabaseClient
): Promise<DetectionResult> {

  // 1. Charger la session ─────────────────────────────────────────────────────
  const { data: sessionData, error: sessionError } = await supabase
    .from('collecte_sessions')
    .select('id, statut, client_id, snapshot_prefill, questionnaire_version_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !sessionData) {
    return { nb_ecarts: 0, statut_final: 'session_invalide' }
  }

  if (sessionData.statut !== 'soumis') {
    return { nb_ecarts: 0, statut_final: 'session_invalide' }
  }

  if (!sessionData.snapshot_prefill || !sessionData.questionnaire_version_id) {
    return { nb_ecarts: 0, statut_final: 'session_invalide' }
  }

  const snapshot  = sessionData.snapshot_prefill as SnapshotPrefill

  // 2. Déduplication — skip si des écarts existent déjà ─────────────────────
  const { count: existingCount } = await supabase
    .from('session_ecarts')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  if ((existingCount ?? 0) > 0) {
    return { nb_ecarts: existingCount ?? 0, statut_final: 'already_detected' }
  }

  // 3. Charger la structure du questionnaire ─────────────────────────────────
  const { data: versionData, error: versionError } = await supabase
    .from('questionnaire_versions')
    .select('structure')
    .eq('id', sessionData.questionnaire_version_id)
    .single()

  if (versionError || !versionData) {
    return { nb_ecarts: 0, statut_final: 'session_invalide' }
  }

  const structure = versionData.structure as QuestionnaireStructure

  // 4. Construire l'index des questions : "code|portee" → métadonnées ─────────
  const questionIndex = new Map<string, QuestionIndexEntry>()

  for (const bloc of structure.blocs) {
    for (const q of bloc.questions) {
      if (!q.prefill_path) continue
      questionIndex.set(`${q.code}|${q.portee}`, {
        bloc_code:          bloc.code,
        bloc_libelle:       bloc.libelle,
        bloc_repete_source: bloc.repete_source,
        prefill_path:       q.prefill_path,
        repete:             q.repete,
        question_libelle:   q.libelle,
      })
    }
  }

  // 5. Indexer les items répétables du snapshot par bloc et par groupe_instance_id
  const repeteItems   = new Map<string, Map<string, Record<string, unknown>>>()
  const instanceIndex = new Map<string, Map<string, number>>()

  for (const bloc of structure.blocs) {
    if (!bloc.repete_source) continue
    const items   = getSnapshotArray(snapshot, bloc.repete_source)
    const itemMap = new Map<string, Record<string, unknown>>()
    const idxMap  = new Map<string, number>()
    items.forEach((item, idx) => {
      itemMap.set(item.id, item)
      idxMap.set(item.id, idx)
    })
    repeteItems.set(bloc.code, itemMap)
    instanceIndex.set(bloc.code, idxMap)
  }

  // 6. Charger TOUTES les réponses de la session (y compris reponse_valeur null)
  const { data: reponses, error: reponsesError } = await supabase
    .from('questionnaire_reponses')
    .select('id, bloc, question_code, portee, groupe_instance_id, reponse_valeur')
    .eq('session_id', sessionId)

  if (reponsesError || !reponses) {
    return { nb_ecarts: 0, statut_final: 'session_invalide' }
  }

  // 7. Comparer chaque réponse avec le snapshot ──────────────────────────────
  const ecartsACreer: EcartRow[] = []

  for (const reponse of reponses) {
    const qKey   = `${reponse.question_code}|${reponse.portee}`
    const qEntry = questionIndex.get(qKey)
    if (!qEntry) continue  // question absente de la structure courante

    const mappingEntry = ECART_MAPPING[qKey]
    if (!mappingEntry) continue  // question sans mapping métier connu

    let snapshotVal: string
    let entiteId:     string | null = null
    let instanceIdx:  number | undefined

    if (!qEntry.repete) {
      // Question non-répétable : résolution chemin absolu dans le snapshot
      snapshotVal = resolveAbsolutePath(snapshot, qEntry.prefill_path)
    } else {
      // Question répétable : retrouver l'item par groupe_instance_id
      const groupeId = reponse.groupe_instance_id as string | null
      if (!groupeId) continue  // anomalie — répétable sans instance id

      const item = repeteItems.get(qEntry.bloc_code)?.get(groupeId)

      if (!item) {
        // Item absent du snapshot : potentiel 'ajout', non traité en v1
        console.warn(`[detection] groupe_instance_id ${groupeId} absent du snapshot (${qKey}) — ajout non détecté en v1`)
        continue
      }

      snapshotVal = resolveItemField(item, qEntry.prefill_path)
      entiteId    = groupeId  // groupe_instance_id = id de la ligne dans la table cible
      instanceIdx = instanceIndex.get(qEntry.bloc_code)?.get(groupeId)
    }

    // Règles de comparaison (4 cas définis dans le plan)
    const snapshotNorm = normalizeValue(snapshotVal)
    const reponseNorm  = normalizeValue(reponse.reponse_valeur as string | null)

    // Pas d'écart si les valeurs normalisées sont identiques
    // (inclut le cas snapshot vide + réponse vide = aucun écart)
    if (snapshotNorm === reponseNorm) continue

    ecartsACreer.push({
      session_id:         sessionId,
      reponse_id:         reponse.id as string,
      bloc:               qEntry.bloc_code,
      question_code:      reponse.question_code as string,
      portee:             reponse.portee as string,
      groupe_instance_id: reponse.groupe_instance_id as string | null,
      entite_cible:       mappingEntry.entite_cible,
      colonne_cible:      mappingEntry.colonne_cible,
      entite_id:          entiteId,
      type_ecart:         'modification',
      valeur_reference:   { valeur: snapshotNorm || null },
      valeur_proposee:    { valeur: reponseNorm  || null },
      libelle_lisible:    generateLibelle(
        qEntry.bloc_libelle,
        qEntry.question_libelle,
        reponse.portee as string,
        snapshotNorm,
        reponseNorm,
        instanceIdx
      ),
      niveau_impact: mappingEntry.niveau_impact,
      statut:        'a_revoir',
    })
  }

  const nbEcarts = ecartsACreer.length

  // 8. INSERT bulk dans session_ecarts ───────────────────────────────────────
  if (nbEcarts > 0) {
    const { error: insertError } = await supabase
      .from('session_ecarts')
      .insert(ecartsACreer)

    if (insertError) {
      throw new Error(`Erreur lors de l'insertion des écarts : ${insertError.message}`)
    }
  }

  // 9. Transition de statut + nb_ecarts_detectes ─────────────────────────────
  // Toujours soumis → en_revue, que des écarts soient détectés ou non.
  // Le statut valide est réservé à la validation conseiller, jamais à la détection automatique.
  const statutFinal = 'en_revue' as const

  const { error: updateError } = await supabase
    .from('collecte_sessions')
    .update({
      statut:             statutFinal,
      nb_ecarts_detectes: nbEcarts,
    })
    .eq('id', sessionId)

  if (updateError) {
    throw new Error(`Erreur lors de la transition de statut : ${updateError.message}`)
  }

  return { nb_ecarts: nbEcarts, statut_final: statutFinal }
}
