export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(iso))
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
    .format(new Date(iso))
}

export function fmtMontant(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
  // Le séparateur de milliers fr-FR généré par Intl (U+202F, espace fine
  // insécable) n'existe pas dans l'encodage WinAnsi des polices PDF standard
  // (Helvetica) — il s'affiche comme un glyphe de remplacement ressemblant à
  // "/" (ex : "30/000 €" au lieu de "30 000 €"). On le remplace par un espace
  // standard, nativement supporté.
  return formatted.replace(/[  ]/g, ' ')
}

export function fmtBool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value ? 'Oui' : 'Non'
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value} %`
}
