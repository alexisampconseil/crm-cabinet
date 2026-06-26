// =============================================================================
// Dictionnaire métier unique — toutes les listes de choix (value/label).
//
// Règle : aucune liste de choix ne doit être dupliquée en dur ailleurs dans le
// code. Le CRM conseiller importe directement ces constantes pour ses <select>.
// Les scripts de génération de seed questionnaire (scripts/build-v1.X.js,
// non versionnés dans le dépôt) doivent importer les mêmes constantes au
// moment de PUBLIER une nouvelle version — une version déjà publiée reste
// figée dans questionnaire_versions.structure (principe déjà acté), mais
// chaque nouvelle version est garantie identique au CRM à l'instant de sa
// publication.
//
// Les contraintes CHECK en base (migrations SQL) ne peuvent pas importer ce
// module — leurs valeurs doivent être tenues manuellement en correspondance
// avec les listes ci-dessous au moment de la rédaction d'une migration.
// =============================================================================

export interface Option {
  value: string
  label: string
}

// ── Identité ──────────────────────────────────────────────────────────────
// CRM uniquement pour l'instant (KYC : reporté, décision produit du 2026-06-26).
export const CIVILITE: Option[] = [
  { value: 'M.',  label: 'M.' },
  { value: 'Mme', label: 'Mme' },
  { value: 'Dr',  label: 'Dr' },
  { value: 'Pr',  label: 'Pr' },
]

// ── Situation familiale ──────────────────────────────────────────────────────
export const SITUATION_FAMILIALE: Option[] = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie',       label: 'Marié(e)' },
  { value: 'pacse',       label: 'Pacsé(e)' },
  { value: 'concubinage', label: 'Concubinage' },
  { value: 'divorce',     label: 'Divorcé(e)' },
  { value: 'veuf',        label: 'Veuf / Veuve' },
]

export const REGIME_MATRIMONIAL: Option[] = [
  { value: 'communaute_reduite',     label: 'Communauté réduite aux acquêts' },
  { value: 'separation_biens',       label: 'Séparation de biens' },
  { value: 'participation_acquets',  label: 'Participation aux acquêts' },
  { value: 'communaute_universelle', label: 'Communauté universelle' },
  { value: 'autre',                  label: 'Autre' },
]

export const REGIME_PACS: Option[] = [
  { value: 'separation_biens', label: 'Séparation de biens (régime légal)' },
  { value: 'indivision',       label: 'Indivision' },
]

export const FILIATION: Option[] = [
  { value: 'commun',   label: 'Enfant commun' },
  { value: 'client',   label: 'Enfant du client' },
  { value: 'conjoint', label: 'Enfant du conjoint' },
  { value: 'adoption', label: 'Enfant adopté' },
]

// ── Situation professionnelle ────────────────────────────────────────────────
export const CATEGORIE_PROFESSIONNELLE: Option[] = [
  { value: 'salarie_prive',  label: 'Salarié secteur privé' },
  { value: 'salarie_public', label: 'Salarié secteur public' },
  { value: 'fonctionnaire',  label: 'Fonctionnaire' },
  { value: 'independant',   label: 'Indépendant' },
  { value: 'tns',            label: 'Travailleur non salarié (TNS)' },
  { value: 'dirigeant',      label: "Dirigeant d'entreprise" },
  { value: 'retraite',       label: 'Retraité' },
  { value: 'sans_activite',  label: 'Sans activité' },
  { value: 'autre',          label: 'Autre' },
]

// ── Actifs financiers ─────────────────────────────────────────────────────────
export const AF_NATURE: Option[] = [
  { value: 'AV',             label: 'Assurance-vie' },
  { value: 'PER',            label: "Plan d'épargne retraite (PER)" },
  { value: 'SCPI',           label: 'SCPI' },
  { value: 'Capitalisation', label: 'Contrat de capitalisation' },
  { value: 'PEA',            label: "Plan d'épargne en actions (PEA)" },
  { value: 'CTO',            label: 'Compte-titres ordinaire' },
  { value: 'Livret',         label: "Livret d'épargne (Livret A, LDDS, LEP, CEL, PEL...)" },
  { value: 'CompteCourant',  label: 'Compte courant' },
  { value: 'PrivateEquity',  label: 'Private Equity' },
  { value: 'Autre',          label: 'Autre' },
]

export const SOUSCRIT_PAR: Option[] = [
  { value: 'client',   label: 'Client' },
  { value: 'conjoint', label: 'Conjoint' },
  { value: 'commun',   label: 'Commun' },
]

export const DETENU_PAR: Option[] = [
  { value: 'client',   label: 'Client' },
  { value: 'conjoint', label: 'Conjoint' },
  { value: 'commun',   label: 'Commun' },
  { value: 'SCI',      label: 'Via une SCI' },
]

// Mode de détention / démembrement — partagé actifs financiers ET immobilier.
export const MODE_DETENTION: Option[] = [
  { value: 'pleine_propriete', label: 'Pleine propriété' },
  { value: 'nue_propriete',    label: 'Nue-propriété' },
  { value: 'usufruit',         label: 'Usufruit' },
]

export const TYPE_DEMEMBREMENT: Option[] = [
  { value: 'viager',     label: 'Viager' },
  { value: 'temporaire', label: 'Temporaire' },
]

// ── Patrimoine immobilier ─────────────────────────────────────────────────────
export const IMMO_NATURE: Option[] = [
  { value: 'RP',            label: 'Résidence principale' },
  { value: 'RS',            label: 'Résidence secondaire' },
  { value: 'LocatifNu',     label: 'Locatif nu' },
  { value: 'LocatifMeuble', label: 'Locatif meublé' },
  { value: 'SCI',           label: 'Parts de SCI' },
  { value: 'Terrain',       label: 'Terrain' },
  { value: 'Autre',         label: 'Autre' },
]

export const TYPE_BIEN: Option[] = [
  { value: 'appartement',      label: 'Appartement' },
  { value: 'maison',           label: 'Maison' },
  { value: 'terrain',          label: 'Terrain' },
  { value: 'local_commercial', label: 'Local commercial' },
  { value: 'parking',          label: 'Parking / Garage' },
  { value: 'parts_sci',        label: 'Parts de SCI' },
  { value: 'autre',            label: 'Autre' },
]

export const REGIME_FISCAL_FONCIER: Option[] = [
  { value: 'micro_foncier', label: 'Micro-foncier' },
  { value: 'reel',          label: 'Réel' },
]

export const REGIME_FISCAL_MEUBLE: Option[] = [
  { value: 'micro_bic', label: 'Micro-BIC' },
  { value: 'reel',      label: 'Réel' },
]

// ── Passifs / crédits ─────────────────────────────────────────────────────────
export const PASSIF_NATURE: Option[] = [
  { value: 'immobilier',    label: 'Crédit immobilier' },
  { value: 'consommation',  label: 'Crédit à la consommation' },
  { value: 'professionnel', label: 'Crédit professionnel' },
  { value: 'autre',         label: 'Autre' },
]

// ── Revenus ───────────────────────────────────────────────────────────────────
export const REV_NATURE: Option[] = [
  { value: 'salaire',                     label: 'Salaires' },
  { value: 'tns',                         label: 'Revenus TNS' },
  { value: 'bic',                         label: 'Revenus BIC' },
  { value: 'bnc',                         label: 'Revenus BNC' },
  { value: 'ba',                          label: 'Revenus BA' },
  { value: 'retraite',                    label: 'Retraites' },
  { value: 'fonciers',                    label: 'Revenus fonciers' },
  { value: 'capitaux_mobiliers',          label: 'Revenus de capitaux mobiliers' },
  { value: 'dividendes',                  label: 'Dividendes' },
  { value: 'pension_alimentaire_recue',   label: 'Pension alimentaire reçue' },
  { value: 'pension_alimentaire_versee',  label: 'Pension alimentaire versée' },
  { value: 'autre',                       label: 'Autres' },
]

export const REV_REGIME_FISCAL: Option[] = [
  { value: 'micro', label: 'Micro' },
  { value: 'reel',  label: 'Réel' },
]

// ── Fiscalité ─────────────────────────────────────────────────────────────────
export const TRANCHE_IR: Option[] = [
  { value: '0',  label: '0 % — Non imposable' },
  { value: '11', label: '11 %' },
  { value: '30', label: '30 %' },
  { value: '41', label: '41 %' },
  { value: '45', label: '45 %' },
]

export const DISPOSITIFS_FISCAUX: string[] = [
  'Pinel', 'Pinel+', 'Malraux', 'Monuments Historiques',
  'Girardin', 'Denormandie', 'Déficit foncier', 'LMP',
  'LMNP', 'Madelin', 'PER (déductible)', 'IR-PME', 'Dutreil',
  'SOFICA', 'CEL / PEL', 'Démembrement', 'GFI',
]

// Tri-état : 'true'/'false' coercés en booléen, '' (Je ne sais pas) en NULL —
// cf. lib/collecte/services/application.ts::coerceValeur.
export const OPTION_BAREME: Option[] = [
  { value: 'true',  label: 'Oui' },
  { value: 'false', label: 'Non' },
  { value: '',      label: 'Je ne sais pas' },
]

// ── Prévoyance ────────────────────────────────────────────────────────────────
export const PREV_CONTRAT_NATURE: Option[] = [
  { value: 'deces',      label: 'Décès' },
  { value: 'incapacite', label: 'Incapacité de travail' },
  { value: 'invalidite', label: 'Invalidité' },
  { value: 'dependance', label: 'Dépendance' },
  { value: 'sante',      label: 'Complémentaire santé' },
  { value: 'autre',      label: 'Autre' },
]

// ── Objectifs ─────────────────────────────────────────────────────────────────
export const OBJ_HORIZON: Option[] = [
  { value: 'court_terme', label: 'Court terme (moins de 3 ans)' },
  { value: 'moyen_terme', label: 'Moyen terme (3 à 8 ans)' },
  { value: 'long_terme',  label: 'Long terme (plus de 8 ans)' },
  { value: 'retraite',    label: 'Horizon retraite' },
]

// CRM uniquement pour l'instant (hors périmètre KYC, cf. audit du 2026-06-26).
export const PROFIL_RISQUE: Option[] = [
  { value: 'prudent',   label: 'Prudent' },
  { value: 'equilibre', label: 'Équilibré' },
  { value: 'dynamique', label: 'Dynamique' },
  { value: 'agressif',  label: 'Agressif' },
]

export const BESOIN_LIQUIDITES: Option[] = [
  { value: 'faible',    label: 'Faible' },
  { value: 'moyen',     label: 'Moyen' },
  { value: 'fort',      label: 'Fort' },
  { value: 'tres_fort', label: 'Très fort' },
]
