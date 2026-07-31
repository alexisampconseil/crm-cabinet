// Génération applicative des identifiants techniques (code), de l'ordre et des
// numéros de version pour le paramétrage des affaires. Objectif : le conseiller
// ne saisit plus jamais de code interne ni d'ordre — le CRM les dérive du libellé.
// Purement applicatif : aucune règle métier, aucune migration.

// Slug technique stable dérivé d'un libellé (« Assurance vie » → « assurance_vie »).
export function slugCode(libelle: string): string {
  const base = (libelle ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base || 'element'
}

// Rend le code unique dans un ensemble existant (suffixe _2, _3…).
export function uniqueCode(libelle: string, existing: Iterable<string>): string {
  const set = new Set(existing)
  const base = slugCode(libelle)
  if (!set.has(base)) return base
  let i = 2
  while (set.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

// Prochain ordre = max + 1 (ordres commençant à 0).
export function nextOrdre(ordres: Array<number | null | undefined>): number {
  let max = -1
  for (const o of ordres) if (typeof o === 'number' && o > max) max = o
  return max + 1
}

// Prochaine version majeure d'une famille au format « N.0 » (« 1.0 », « 2.0 »…).
export function nextVersionLabel(existing: Array<string | null | undefined>): string {
  let maxMajor = 0
  for (const v of existing) {
    const m = /^(\d+)/.exec(v ?? '')
    if (m) { const n = parseInt(m[1], 10); if (n > maxMajor) maxMajor = n }
  }
  return `${maxMajor + 1}.0`
}
