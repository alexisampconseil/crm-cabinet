// Dictionnaires de libellés métier — traduisent les codes techniques stockés
// dans le snapshot en libellés lisibles par le client. Les libellés sont
// repris tels que présentés pendant la collecte (options du questionnaire,
// scripts/seed-questionnaire-v1.4.sql), pas inventés ici : c'est la même
// formulation que celle déjà validée et montrée au client.
//
// translate() ne masque jamais une valeur non répertoriée — elle retombe sur
// le code brut, ce qui signale visuellement qu'un libellé manque à compléter
// plutôt que de produire un blanc trompeur sur un document réglementaire.
export function translate(
  dict: Record<string, string>,
  code: string | null | undefined
): string | null {
  if (!code) return null
  return dict[code] ?? code
}

// Extrait une valeur string d'un champ JSONB `detail` (typé Record<string,
// unknown> dans SnapshotPrefill) — évite de répéter le typeof partout.
export function detailString(
  detail: Record<string, unknown>,
  key: string
): string | null {
  const value = detail[key]
  return typeof value === 'string' ? value : null
}

export const REGIME_MATRIMONIAL: Record<string, string> = {
  communaute_reduite:     'Communauté réduite aux acquêts',
  separation_biens:       'Séparation de biens',
  participation_acquets:  'Participation aux acquêts',
  communaute_universelle: 'Communauté universelle',
  autre:                  'Autre',
}

export const REGIME_PACS: Record<string, string> = {
  separation_biens: 'Séparation de biens (régime légal)',
  indivision:       'Indivision',
}

export const CATEGORIE_PROFESSIONNELLE: Record<string, string> = {
  salarie_prive:  'Salarié secteur privé',
  salarie_public: 'Salarié secteur public',
  fonctionnaire:  'Fonctionnaire',
  independant:    'Indépendant',
  tns:            'Travailleur non salarié (TNS)',
  dirigeant:      "Dirigeant d'entreprise",
  retraite:       'Retraité',
  sans_activite:  'Sans activité',
  autre:          'Autre',
}

export const FILIATION: Record<string, string> = {
  commun:   'Enfant commun',
  client:   'Enfant du client',
  conjoint: 'Enfant du conjoint',
  adoption: 'Enfant adopté',
}

export const NATURE_FINANCIER: Record<string, string> = {
  AV:             'Assurance-vie',
  PER:            "Plan d'épargne retraite (PER)",
  SCPI:           'SCPI',
  Capitalisation: 'Contrat de capitalisation',
  PEA:            "Plan d'épargne en actions (PEA)",
  CTO:            'Compte-titres ordinaire',
  Livret:         "Livret d'épargne",
  CompteCourant:  'Compte courant',
  PrivateEquity:  'Private Equity',
  Autre:          'Autre',
}

export const NATURE_IMMOBILIER: Record<string, string> = {
  RP:            'Résidence principale',
  RS:            'Résidence secondaire',
  LocatifNu:     'Locatif nu',
  LocatifMeuble: 'Locatif meublé',
  SCI:           'Parts de SCI',
  Terrain:       'Terrain',
  Autre:         'Autre',
}

export const DETENU_PAR: Record<string, string> = {
  client:   'Client',
  conjoint: 'Conjoint',
  commun:   'Commun',
  SCI:      'Via une SCI',
}

export const MODE_DETENTION: Record<string, string> = {
  pleine_propriete: 'Pleine propriété',
  nue_propriete:    'Nue-propriété',
  usufruit:         'Usufruit',
}

export const NATURE_PASSIF: Record<string, string> = {
  immobilier:    'Crédit immobilier',
  consommation:  'Crédit à la consommation',
  professionnel: 'Crédit professionnel',
  autre:         'Autre',
}

export const NATURE_REVENU: Record<string, string> = {
  salaire:                     'Salaires',
  tns:                         'Revenus TNS',
  bic:                         'Revenus BIC',
  bnc:                         'Revenus BNC',
  ba:                          'Revenus BA',
  retraite:                   'Retraites',
  fonciers:                    'Revenus fonciers',
  capitaux_mobiliers:          'Revenus de capitaux mobiliers',
  dividendes:                  'Dividendes',
  pension_alimentaire_recue:   'Pension alimentaire reçue',
  pension_alimentaire_versee:  'Pension alimentaire versée',
  autre:                       'Autres',
}

export const NATURE_PREVOYANCE: Record<string, string> = {
  deces:      'Décès',
  incapacite: 'Incapacité de travail',
  invalidite: 'Invalidité',
  dependance: 'Dépendance',
  sante:      'Complémentaire santé',
  autre:      'Autre',
}

export const HORIZON_OBJECTIF: Record<string, string> = {
  court_terme: 'Court terme (moins de 3 ans)',
  moyen_terme: 'Moyen terme (3 à 8 ans)',
  long_terme:  'Long terme (plus de 8 ans)',
  retraite:    'Horizon retraite',
}

export const SITUATION_FAMILIALE: Record<string, string> = {
  celibataire: 'Célibataire',
  marie:       'Marié(e)',
  pacse:       'Pacsé(e)',
  concubinage: 'En concubinage',
  divorce:     'Divorcé(e)',
  veuf:        'Veuf/Veuve',
}
