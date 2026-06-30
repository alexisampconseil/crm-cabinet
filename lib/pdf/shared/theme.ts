// Tokens de design pour les rapports patrimoniaux générés (KYC aujourd'hui ;
// rapport d'adéquation, bilan patrimonial, ESG… demain). Distinct de
// lib/pdf/pdf-styles.ts, qui reste dédié aux PDF de gouvernance produit —
// aucun de ces tokens n'est utilisé par ces derniers.
//
// Police unique : Helvetica (standard react-pdf, aucune police custom à
// charger). La hiérarchie visuelle repose sur la taille, la graisse et les
// bandeaux — jamais sur un changement de police ni sur le letter-spacing.

export const reportColor = {
  navy:      '#2d4462',
  gold:      '#b69957',
  text:      '#2a3645',
  textMid:   '#5a6a7e',
  textLight: '#8a9aac',
  border:    '#e2ddd6',
  bandBg:    '#f4f3f1', // gris clair chaud — élément principal de hiérarchie
  rowAltBg:  '#faf9f7', // alternance de fond très légère dans les tableaux
  white:     '#ffffff',
} as const

export const reportFont = {
  regular: 'Helvetica',
  bold:    'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
} as const

export const reportSpace = {
  pageMargin:   48,
  sectionGap:   22, // au-dessus d'un bandeau de chapitre
  groupGap:     10, // au-dessus d'un sous-titre
} as const
