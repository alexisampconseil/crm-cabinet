import type { SnapshotPrefill, QuestionnaireCondition } from '@/lib/collecte'

// ── Clé de formulaire ─────────────────────────────────────────────────────────
// Format : "${question_code}|${portee}|${groupe_instance_id ?? ''}"
// Aligné sur l'index unique de questionnaire_reponses :
//   (session_id, question_code, portee, groupe_instance_id)

export function makeFormKey(
  code: string,
  portee: string,
  groupeInstanceId: string | null
): string {
  return `${code}|${portee}|${groupeInstanceId ?? ''}`
}

// ── Résolution de chemin absolu dans snapshot_prefill ────────────────────────
// Chemin dot depuis la racine, ex : "identite.nom", "fiscalite.tranche_ir"

export function resolvePrefillAbsolute(
  snapshot: SnapshotPrefill,
  path: string
): string {
  const parts = path.split('.')
  let current: unknown = snapshot
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return ''
    current = (current as Record<string, unknown>)[part]
  }
  return serializeValue(current)
}

// ── Résolution de chemin relatif sur un item répétable ───────────────────────
// path est toujours de la forme "item.champ", ex : "item.libelle", "item.montant"

export function resolvePrefillItem(
  item: Record<string, unknown>,
  path: string
): string {
  const field = path.slice(5) // retire "item."
  // Chemin imbriqué (ex : "detail.mode_detention") — walk complet. Rétrocompatible
  // avec les chemins à un seul niveau (ex : "libelle").
  const parts = field.split('.')
  let cur: unknown = item
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return ''
    cur = (cur as Record<string, unknown>)[part]
  }
  return serializeValue(cur)
}

// ── Extraction du tableau source d'un bloc répétable ─────────────────────────
// repeteSource est un chemin dot, ex : "patrimoine_financier", "foyer.enfants"

export function getRepeatableItems(
  snapshot: SnapshotPrefill,
  repeteSource: string
): Array<Record<string, unknown> & { id: string }> {
  const parts = repeteSource.split('.')
  let current: unknown = snapshot
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return []
    current = (current as Record<string, unknown>)[part]
  }
  if (!Array.isArray(current)) return []
  return current as Array<Record<string, unknown> & { id: string }>
}

// ── Évaluation des conditions d'affichage ────────────────────────────────────
// Toutes les conditions sont évaluées en AND.
// Champ spécial "perimetre" : compare la valeur de session.
// Autres champs : cherchent la valeur du question_code référencé, avec
//   portee=cond.portee (défaut 'client', comportement historique v1.0/v1.1).
// groupeInstanceId : pour une question répétable, transmettre le groupe_instance_id
//   de l'instance courante — la condition se résout alors DANS la même instance
//   (ex : afficher "employeur" si "nature"='salaire' pour CETTE ligne de revenu).
//   null (défaut) pour les questions non-répétables (foyer/identite/situation_pro).
export function evaluateConditions(
  conditions: QuestionnaireCondition[],
  formState: Map<string, string>,
  perimetre: string,
  groupeInstanceId: string | null = null
): boolean {
  for (const cond of conditions) {
    let actual: string
    if (cond.champ === 'perimetre') {
      actual = perimetre
    } else {
      actual = formState.get(makeFormKey(cond.champ, cond.portee ?? 'client', groupeInstanceId)) ?? ''
    }
    if (cond.operateur === 'in') {
      const liste = Array.isArray(cond.valeur) ? cond.valeur.map(String) : [String(cond.valeur)]
      if (!liste.includes(actual)) return false
      continue
    }

    const expected = String(cond.valeur)
    const pass = evalOp(actual, cond.operateur, expected)
    if (!pass) return false
  }
  return true
}

function evalOp(
  a: string,
  op: '=' | '!=' | '>' | '<' | '>=' | '<=',
  b: string
): boolean {
  switch (op) {
    case '=':  return a === b
    case '!=': return a !== b
    case '>':  return Number(a) > Number(b)
    case '<':  return Number(a) < Number(b)
    case '>=': return Number(a) >= Number(b)
    case '<=': return Number(a) <= Number(b)
  }
}

function serializeValue(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (Array.isArray(val)) return JSON.stringify(val)
  return String(val)
}
