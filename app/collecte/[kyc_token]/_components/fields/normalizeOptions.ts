import type { QuestionnaireOption } from '@/lib/collecte'

// Normalise les deux formats d'options coexistants :
//   - string[]              : ancien format (v1.0/v1.1) — la valeur technique
//     sert aussi de libellé, formaté mécaniquement (acronymes bruts non résolus).
//   - QuestionnaireOption[]  : nouveau format (v1.2+) — value/label explicites.
// Une session déjà ouverte garde la structure JSON figée à son ouverture
// (questionnaire_versions.structure) — les deux formats doivent donc rester
// acceptés indéfiniment, pas seulement pendant une période de transition.
export function normalizeOptions(
  options: string[] | QuestionnaireOption[] | undefined
): QuestionnaireOption[] {
  if (!options) return []
  return options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: formatLegacyOption(opt) } : opt
  )
}

function formatLegacyOption(opt: string): string {
  return opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
