// =============================================================================
// Matrices nature -> questions pertinentes — source unique pour la logique
// conditionnelle "pilotée par type de produit" (cf. questionnaire v1.4).
//
// Utilisées à la fois par :
//   - le script de génération de seed questionnaire (conditions d'affichage) ;
//   - le CRM conseiller (quels champs `detail` afficher pour une ligne donnée).
// Toute évolution de cette matrice doit être reportée dans les DEUX, et dans
// une nouvelle version de questionnaire si le KYC est concerné (une version
// publiée reste figée).
// =============================================================================

// ── Actifs financiers ─────────────────────────────────────────────────────────

// Natures pour lesquelles la date de souscription est pertinente.
export const AF_NATURES_AVEC_DATE = [
  'AV', 'PER', 'SCPI', 'Capitalisation', 'PEA', 'CTO', 'PrivateEquity', 'Autre',
] as const

// Natures pour lesquelles le mode de détention (+ démembrement) est pertinent.
export const AF_NATURES_AVEC_DETENTION = [
  'AV', 'PER', 'SCPI', 'Capitalisation', 'Autre',
] as const

// Natures d'actifs financiers ÉLIGIBLES à la gestion cabinet : produits
// réellement distribués/suivis par le cabinet. Les produits bancaires classiques
// (Livret A/LDDS/LEP/CEL/PEL → 'Livret', 'CompteCourant') et le fourre-tout
// 'Autre' en sont exclus. Source unique côté applicatif — doit rester alignée
// avec la fonction SQL public.af_nature_eligible_gestion (migration 032).
export const AF_NATURES_ELIGIBLES_GESTION = [
  'AV', 'PER', 'SCPI', 'Capitalisation', 'PEA', 'CTO', 'PrivateEquity',
] as const

// ── Patrimoine immobilier ─────────────────────────────────────────────────────

// Natures génératrices de revenus locatifs.
export const IMMO_NATURES_LOCATIVES = ['LocatifNu', 'LocatifMeuble', 'SCI'] as const

// Régime fiscal foncier (micro-foncier/réel) — location nue + SCI à l'IR (cas par défaut).
export const IMMO_NATURES_REGIME_FONCIER = ['LocatifNu', 'SCI'] as const

// Régime fiscal meublé (micro-BIC/réel).
export const IMMO_NATURES_REGIME_MEUBLE = ['LocatifMeuble'] as const

// Le mode de détention (+ démembrement) reste pertinent pour TOUTE nature —
// un démembrement peut s'appliquer à une résidence principale (transmission
// aux enfants avec réserve d'usufruit), pas seulement à un bien locatif.
// Aucune restriction de nature ici, volontairement.
