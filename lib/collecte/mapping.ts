// =============================================================================
// Mapping question_code × portee → cible dans le référentiel patrimonial
// Couvre les 56 questions du questionnaire v1.0 (scripts/seed-questionnaire-v1.sql).
//
// Clé : `${question_code}|${portee}`
// Valeur :
//   entite_cible   — table DB cible (ex : 'famille', 'actifs_financiers')
//   colonne_cible  — colonne DB cible (ex : 'nom', 'montant')
//   niveau_impact  — impact par défaut pour la classification des écarts
//
// Pour les tables simples (une ligne par client : famille, fiscalite, prevoyance),
// entite_id sera null dans session_ecarts ; la route d'application retrouve la ligne
// via client_id.
// Pour les tables répétables (enfants, actifs_financiers, etc.), entite_id = groupe_instance_id.
//
// Ce mapping doit rester synchronisé avec scripts/seed-questionnaire-v1.sql.
// À terme : migrer vers entite_cible/colonne_cible dans la structure JSONB du questionnaire.
// =============================================================================

import type { SessionEcartNiveauImpact } from './types'

export type ColonneType = 'text' | 'number' | 'boolean' | 'array'

export interface MappingEntry {
  entite_cible:  string
  colonne_cible: string
  niveau_impact: SessionEcartNiveauImpact
  colonne_type:  ColonneType
}

// Sentinel colonne_cible pour les marqueurs de suppression d'instance —
// jamais un nom de colonne réel. Reconnu spécifiquement par detection.ts
// (génère un écart type_ecart='suppression' au lieu d'une comparaison de
// valeur classique) et application.ts (exécute un DELETE sur toute la ligne
// au lieu d'un UPDATE/INSERT de colonne).
export const COLONNE_SUPPRESSION = '__suppression__'

export const ECART_MAPPING: Record<string, MappingEntry> = {

  // ── Identité — table : famille ─────────────────────────────────────────────
  'id_nom|client':              { entite_cible: 'famille', colonne_cible: 'nom',                          niveau_impact: 'faible', colonne_type: 'text' },
  'id_nom|conjoint':            { entite_cible: 'famille', colonne_cible: 'conjoint_nom',                 niveau_impact: 'faible', colonne_type: 'text' },
  'id_prenom|client':           { entite_cible: 'famille', colonne_cible: 'prenom',                       niveau_impact: 'faible', colonne_type: 'text' },
  'id_prenom|conjoint':         { entite_cible: 'famille', colonne_cible: 'conjoint_prenom',              niveau_impact: 'faible', colonne_type: 'text' },
  'id_date_naissance|client':   { entite_cible: 'famille', colonne_cible: 'date_naissance',               niveau_impact: 'faible', colonne_type: 'text' },
  'id_nationalite|client':      { entite_cible: 'famille', colonne_cible: 'nationalite',                  niveau_impact: 'faible', colonne_type: 'text' },
  'id_pays_naissance|client':   { entite_cible: 'famille', colonne_cible: 'pays_naissance',               niveau_impact: 'faible', colonne_type: 'text' },
  'id_pays_naissance|conjoint': { entite_cible: 'famille', colonne_cible: 'conjoint_pays_naissance',      niveau_impact: 'faible', colonne_type: 'text' },
  'id_adresse|client':          { entite_cible: 'famille', colonne_cible: 'adresse',                      niveau_impact: 'faible', colonne_type: 'text' },
  'id_code_postal|client':      { entite_cible: 'famille', colonne_cible: 'code_postal',                  niveau_impact: 'faible', colonne_type: 'text' },
  'id_ville|client':            { entite_cible: 'famille', colonne_cible: 'ville',                        niveau_impact: 'faible', colonne_type: 'text' },

  // ── Foyer — table : famille (non-répétable) + enfants (répétable) ──────────
  'foy_situation|client':            { entite_cible: 'famille', colonne_cible: 'situation',          niveau_impact: 'moyen',  colonne_type: 'text'    },
  'foy_regime_matrimonial|foyer':    { entite_cible: 'famille', colonne_cible: 'regime_matrimonial', niveau_impact: 'moyen',  colonne_type: 'text'    },
  'foy_enfant_prenom|foyer':         { entite_cible: 'enfants', colonne_cible: 'prenom',             niveau_impact: 'faible', colonne_type: 'text'    },
  'foy_enfant_nom|foyer':            { entite_cible: 'enfants', colonne_cible: 'nom',                niveau_impact: 'faible', colonne_type: 'text'    },
  'foy_enfant_date_naissance|foyer': { entite_cible: 'enfants', colonne_cible: 'date_naissance',     niveau_impact: 'faible', colonne_type: 'text'    },
  'foy_enfant_a_charge|foyer':       { entite_cible: 'enfants', colonne_cible: 'a_charge',           niveau_impact: 'moyen',  colonne_type: 'boolean' },
  'foy_enfant_filiation|foyer':      { entite_cible: 'enfants', colonne_cible: 'filiation',          niveau_impact: 'faible', colonne_type: 'text'    },

  // ── Situation professionnelle — table : famille ────────────────────────────
  'pro_categorie|client':    { entite_cible: 'famille', colonne_cible: 'categorie_professionnelle',          niveau_impact: 'faible', colonne_type: 'text' },
  'pro_profession|client':   { entite_cible: 'famille', colonne_cible: 'profession',                         niveau_impact: 'faible', colonne_type: 'text' },
  'pro_employeur|client':    { entite_cible: 'famille', colonne_cible: 'employeur',                          niveau_impact: 'faible', colonne_type: 'text' },
  'pro_categorie|conjoint':  { entite_cible: 'famille', colonne_cible: 'conjoint_categorie_professionnelle', niveau_impact: 'faible', colonne_type: 'text' },
  'pro_profession|conjoint': { entite_cible: 'famille', colonne_cible: 'conjoint_profession',                niveau_impact: 'faible', colonne_type: 'text' },
  'pro_employeur|conjoint':  { entite_cible: 'famille', colonne_cible: 'conjoint_employeur',                 niveau_impact: 'faible', colonne_type: 'text' },

  // ── Revenus — table : budget_postes (répétable) ───────────────────────────
  'rev_libelle|foyer':        { entite_cible: 'budget_postes', colonne_cible: 'libelle',        niveau_impact: 'faible', colonne_type: 'text'   },
  'rev_montant_annuel|foyer': { entite_cible: 'budget_postes', colonne_cible: 'montant_annuel', niveau_impact: 'fort',   colonne_type: 'number' },

  // ── Charges — table : budget_postes (répétable) ───────────────────────────
  'chg_libelle|foyer':        { entite_cible: 'budget_postes', colonne_cible: 'libelle',        niveau_impact: 'faible', colonne_type: 'text'   },
  'chg_montant_annuel|foyer': { entite_cible: 'budget_postes', colonne_cible: 'montant_annuel', niveau_impact: 'moyen',  colonne_type: 'number' },

  // ── Actifs financiers — table : actifs_financiers (répétable) ────────────
  'af_nature|client':            { entite_cible: 'actifs_financiers', colonne_cible: 'nature',            niveau_impact: 'moyen',  colonne_type: 'text'   },
  'af_libelle|client':           { entite_cible: 'actifs_financiers', colonne_cible: 'libelle',           niveau_impact: 'faible', colonne_type: 'text'   },
  'af_montant|client':           { entite_cible: 'actifs_financiers', colonne_cible: 'montant',           niveau_impact: 'fort',   colonne_type: 'number' },
  'af_souscrit_par|client':      { entite_cible: 'actifs_financiers', colonne_cible: 'souscrit_par',      niveau_impact: 'faible', colonne_type: 'text'   },
  'af_date_souscription|client': { entite_cible: 'actifs_financiers', colonne_cible: 'date_souscription', niveau_impact: 'faible', colonne_type: 'text'   },

  // ── Immobilier — table : patrimoine_immobilier (répétable) ────────────────
  'immo_nature|client':          { entite_cible: 'patrimoine_immobilier', colonne_cible: 'nature',          niveau_impact: 'moyen', colonne_type: 'text'   },
  'immo_valeur|client':          { entite_cible: 'patrimoine_immobilier', colonne_cible: 'valeur',          niveau_impact: 'fort',  colonne_type: 'number' },
  'immo_detenu_par|client':      { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detenu_par',      niveau_impact: 'moyen', colonne_type: 'text'   },
  'immo_revenus_annuels|client': { entite_cible: 'patrimoine_immobilier', colonne_cible: 'revenus_annuels', niveau_impact: 'fort',  colonne_type: 'number' },

  // ── Passifs — table : passifs (répétable) ─────────────────────────────────
  'passif_nature|foyer':     { entite_cible: 'passifs', colonne_cible: 'nature',     niveau_impact: 'faible', colonne_type: 'text'   },
  'passif_banque|foyer':     { entite_cible: 'passifs', colonne_cible: 'banque',     niveau_impact: 'faible', colonne_type: 'text'   },
  'passif_montant|foyer':    { entite_cible: 'passifs', colonne_cible: 'montant',    niveau_impact: 'fort',   colonne_type: 'number' },
  'passif_mensualite|foyer': { entite_cible: 'passifs', colonne_cible: 'mensualite', niveau_impact: 'moyen',  colonne_type: 'number' },
  'passif_taux|foyer':       { entite_cible: 'passifs', colonne_cible: 'taux',       niveau_impact: 'moyen',  colonne_type: 'number' },

  // ── Fiscalité — table : fiscalite ─────────────────────────────────────────
  'fisc_tranche_ir|foyer':    { entite_cible: 'fiscalite', colonne_cible: 'tranche_ir',    niveau_impact: 'fort',     colonne_type: 'text'    },
  'fisc_revenu_fiscal|foyer': { entite_cible: 'fiscalite', colonne_cible: 'revenu_fiscal', niveau_impact: 'fort',     colonne_type: 'number'  },
  'fisc_nombre_parts|foyer':  { entite_cible: 'fiscalite', colonne_cible: 'nombre_parts',  niveau_impact: 'fort',     colonne_type: 'number'  },
  'fisc_ifi|foyer':           { entite_cible: 'fiscalite', colonne_cible: 'ifi',           niveau_impact: 'critique', colonne_type: 'number'  },
  'fisc_option_bareme|foyer': { entite_cible: 'fiscalite', colonne_cible: 'option_bareme', niveau_impact: 'moyen',    colonne_type: 'boolean' },
  'fisc_dispositifs|foyer':   { entite_cible: 'fiscalite', colonne_cible: 'dispositifs',   niveau_impact: 'moyen',    colonne_type: 'array'   },

  // ── Prévoyance — table : prevoyance (non-répétable) + contrats_prevoyance (répétable)
  'prev_testament|client':         { entite_cible: 'prevoyance',          colonne_cible: 'testament',               niveau_impact: 'moyen',  colonne_type: 'boolean' },
  'prev_droits_retraite|client':   { entite_cible: 'prevoyance',          colonne_cible: 'droits_retraite_estimes', niveau_impact: 'moyen',  colonne_type: 'number'  },
  'prev_contrat_nature|client':    { entite_cible: 'contrats_prevoyance', colonne_cible: 'nature',                  niveau_impact: 'moyen',  colonne_type: 'text'    },
  'prev_contrat_compagnie|client': { entite_cible: 'contrats_prevoyance', colonne_cible: 'compagnie',               niveau_impact: 'faible', colonne_type: 'text'    },
  'prev_contrat_montant|client':   { entite_cible: 'contrats_prevoyance', colonne_cible: 'montant',                 niveau_impact: 'moyen',  colonne_type: 'number'  },

  // ── Objectifs — table : objectifs (répétable) ─────────────────────────────
  'obj_libelle|client':       { entite_cible: 'objectifs', colonne_cible: 'libelle',       niveau_impact: 'faible', colonne_type: 'text'   },
  'obj_horizon|client':       { entite_cible: 'objectifs', colonne_cible: 'horizon',       niveau_impact: 'faible', colonne_type: 'text'   },
  'obj_montant_cible|client': { entite_cible: 'objectifs', colonne_cible: 'montant_cible', niveau_impact: 'moyen',  colonne_type: 'number' },

  // ── Questionnaire v1.2 ────────────────────────────────────────────────────

  // Identité — coordonnées + lieu de naissance — table : famille ───────────
  'id_email|client':          { entite_cible: 'famille', colonne_cible: 'email',          niveau_impact: 'faible', colonne_type: 'text' },
  'id_telephone|client':      { entite_cible: 'famille', colonne_cible: 'telephone',      niveau_impact: 'faible', colonne_type: 'text' },
  'id_lieu_naissance|client': { entite_cible: 'famille', colonne_cible: 'lieu_naissance', niveau_impact: 'faible', colonne_type: 'text' },

  // Foyer — coordonnées conjoint + lieu de naissance — table : famille ──────
  'foy_lieu_naissance|conjoint':    { entite_cible: 'famille', colonne_cible: 'conjoint_lieu_naissance', niveau_impact: 'faible', colonne_type: 'text' },
  'foy_conjoint_email|conjoint':    { entite_cible: 'famille', colonne_cible: 'conjoint_email',          niveau_impact: 'faible', colonne_type: 'text' },
  'foy_conjoint_telephone|conjoint':{ entite_cible: 'famille', colonne_cible: 'conjoint_telephone',      niveau_impact: 'faible', colonne_type: 'text' },

  // Foyer — situation familiale étendue (mariage, PACS, donation) — table : famille
  'foy_date_mariage|foyer':            { entite_cible: 'famille', colonne_cible: 'date_mariage',            niveau_impact: 'faible', colonne_type: 'text'    },
  'foy_contrat_mariage|foyer':         { entite_cible: 'famille', colonne_cible: 'contrat_mariage',         niveau_impact: 'faible', colonne_type: 'boolean' },
  'foy_date_contrat_mariage|foyer':    { entite_cible: 'famille', colonne_cible: 'date_contrat_mariage',    niveau_impact: 'faible', colonne_type: 'text'    },
  'foy_donation_dernier_vivant|foyer': { entite_cible: 'famille', colonne_cible: 'donation_dernier_vivant', niveau_impact: 'moyen',  colonne_type: 'boolean' },
  'foy_regime_pacs|foyer':             { entite_cible: 'famille', colonne_cible: 'regime_pacs',             niveau_impact: 'moyen',  colonne_type: 'text'    },
  'foy_date_pacs|foyer':               { entite_cible: 'famille', colonne_cible: 'date_pacs',               niveau_impact: 'faible', colonne_type: 'text'    },

  // Revenus — nature + détail conditionnel — table : budget_postes (répétable)
  // colonne_cible pointée (detail.xxx) : fusion JSONB gérée par application.ts,
  // jamais un UPDATE de colonne plate. Voir services/application.ts.
  'rev_nature|foyer':                 { entite_cible: 'budget_postes', colonne_cible: 'nature',                       niveau_impact: 'moyen',  colonne_type: 'text' },
  'rev_nature_activite|foyer':        { entite_cible: 'budget_postes', colonne_cible: 'detail.nature_activite',       niveau_impact: 'faible', colonne_type: 'text' },
  'rev_regime_fiscal|foyer':          { entite_cible: 'budget_postes', colonne_cible: 'detail.regime_fiscal',         niveau_impact: 'faible', colonne_type: 'text' },
  'rev_societe_distributrice|foyer':  { entite_cible: 'budget_postes', colonne_cible: 'detail.societe',               niveau_impact: 'faible', colonne_type: 'text' },
  'rev_nature_produit|foyer':         { entite_cible: 'budget_postes', colonne_cible: 'detail.nature_produit',        niveau_impact: 'faible', colonne_type: 'text' },
  'rev_beneficiaire_debiteur|foyer':  { entite_cible: 'budget_postes', colonne_cible: 'detail.beneficiaire_debiteur', niveau_impact: 'faible', colonne_type: 'text' },
  'rev_organisme_payeur|foyer':       { entite_cible: 'budget_postes', colonne_cible: 'detail.organisme_payeur',      niveau_impact: 'faible', colonne_type: 'text' },
  'rev_precision_autre|foyer':        { entite_cible: 'budget_postes', colonne_cible: 'detail.precision',             niveau_impact: 'faible', colonne_type: 'text' },

  // Actifs financiers — démembrement — table : actifs_financiers (répétable)
  'af_mode_detention|client':     { entite_cible: 'actifs_financiers', colonne_cible: 'detail.mode_detention',     niveau_impact: 'fort',   colonne_type: 'text'   },
  'af_age_usufruitier|client':    { entite_cible: 'actifs_financiers', colonne_cible: 'detail.age_usufruitier',    niveau_impact: 'moyen',  colonne_type: 'number' },
  'af_date_demembrement|client':  { entite_cible: 'actifs_financiers', colonne_cible: 'detail.date_demembrement',  niveau_impact: 'moyen',  colonne_type: 'text'   },
  'af_type_demembrement|client':  { entite_cible: 'actifs_financiers', colonne_cible: 'detail.type_demembrement',  niveau_impact: 'moyen',  colonne_type: 'text'   },
  'af_lien_usufruitier|client':   { entite_cible: 'actifs_financiers', colonne_cible: 'detail.lien_usufruitier',   niveau_impact: 'faible', colonne_type: 'text'   },

  // Immobilier — démembrement, typologie, quote-part, acquisition — table : patrimoine_immobilier (répétable)
  'immo_mode_detention|client':    { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detail.mode_detention',    niveau_impact: 'fort',   colonne_type: 'text'   },
  'immo_age_usufruitier|client':   { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detail.age_usufruitier',   niveau_impact: 'moyen',  colonne_type: 'number' },
  'immo_date_demembrement|client': { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detail.date_demembrement', niveau_impact: 'moyen',  colonne_type: 'text'   },
  'immo_type_demembrement|client': { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detail.type_demembrement', niveau_impact: 'moyen',  colonne_type: 'text'   },
  'immo_lien_usufruitier|client':  { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detail.lien_usufruitier',  niveau_impact: 'faible', colonne_type: 'text'   },
  'immo_type_bien|client':         { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detail.type_bien',         niveau_impact: 'moyen',  colonne_type: 'text'   },
  'immo_quote_part|client':        { entite_cible: 'patrimoine_immobilier', colonne_cible: 'quote_part_detenue',       niveau_impact: 'moyen',  colonne_type: 'number' },
  'immo_date_acquisition|client':  { entite_cible: 'patrimoine_immobilier', colonne_cible: 'date_acquisition',         niveau_impact: 'faible', colonne_type: 'text'   },

  // Passifs — capital restant dû + quotité — table : passifs (répétable)
  'passif_capital_restant_du|foyer': { entite_cible: 'passifs', colonne_cible: 'capital_restant_du', niveau_impact: 'fort',  colonne_type: 'number' },
  'passif_quotite|foyer':            { entite_cible: 'passifs', colonne_cible: 'detail.quotite',     niveau_impact: 'moyen', colonne_type: 'number' },

  // ── Questionnaire v1.3 ────────────────────────────────────────────────────

  // Immobilier — régime fiscal (bien locatif uniquement) — table : patrimoine_immobilier
  // Remplacé en v1.4 par deux questions distinctes (foncier vs meublé/BIC,
  // fiscalité réellement différente) — voir section "Questionnaire v1.4" plus bas.

  // Marqueurs de suppression d'instance — colonne_cible = COLONNE_SUPPRESSION
  // (sentinel reconnu par detection.ts/application.ts, jamais un nom de colonne
  // réel). Une seule réponse à 'true' déclenche un écart type_ecart='suppression'
  // sur toute l'entité (la ligne entière), pas un champ. Questions "systeme"
  // dans le questionnaire — jamais affichées (BlocCard les filtre du rendu).
  'af_supprime|client':     { entite_cible: 'actifs_financiers',     colonne_cible: COLONNE_SUPPRESSION, niveau_impact: 'fort', colonne_type: 'boolean' },
  'immo_supprime|client':   { entite_cible: 'patrimoine_immobilier', colonne_cible: COLONNE_SUPPRESSION, niveau_impact: 'fort', colonne_type: 'boolean' },
  'passif_supprime|foyer':  { entite_cible: 'passifs',               colonne_cible: COLONNE_SUPPRESSION, niveau_impact: 'fort', colonne_type: 'boolean' },
  'rev_supprime|foyer':     { entite_cible: 'budget_postes',         colonne_cible: COLONNE_SUPPRESSION, niveau_impact: 'fort', colonne_type: 'boolean' },
  'chg_supprime|foyer':     { entite_cible: 'budget_postes',         colonne_cible: COLONNE_SUPPRESSION, niveau_impact: 'fort', colonne_type: 'boolean' },
  'obj_supprime|client':    { entite_cible: 'objectifs',             colonne_cible: COLONNE_SUPPRESSION, niveau_impact: 'fort', colonne_type: 'boolean' },

  // ── Questionnaire v1.4 ────────────────────────────────────────────────────
  // Logique conditionnelle pilotée par type de produit (af_nature / immo_nature) —
  // voir QUESTIONS_PAR_NATURE_AF / QUESTIONS_PAR_NATURE_IMMO dans le script de
  // génération du seed. Régime fiscal scindé : la fiscalité d'un bien loué nu
  // (revenus fonciers) diffère réellement de celle d'un bien loué meublé (BIC).
  'immo_regime_fiscal_foncier|client': { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detail.regime_fiscal', niveau_impact: 'moyen', colonne_type: 'text' },
  'immo_regime_fiscal_meuble|client':  { entite_cible: 'patrimoine_immobilier', colonne_cible: 'detail.regime_fiscal', niveau_impact: 'moyen', colonne_type: 'text' },
}

// =============================================================================
// Constantes — écarts type_ecart='ajout' (nouvelle instance dans un bloc répétable)
// Périmètre : revenus, charges, actifs_financiers, immobilier, passifs, objectifs.
// =============================================================================

// Niveau d'impact fixe par bloc pour un ajout complet — un ajout n'a pas de
// colonne_cible unique (plusieurs champs), contrairement à une modification.
export const NIVEAU_IMPACT_AJOUT: Record<string, SessionEcartNiveauImpact> = {
  objectifs:         'faible',
  revenus:           'moyen',
  charges:           'moyen',
  actifs_financiers: 'fort',
  immobilier:        'fort',
  passifs:           'fort',
}

// Colonnes (colonne_cible du mapping) dont au moins une doit être renseignée
// pour qu'une nouvelle instance soit considérée comme une intention réelle
// d'ajout. Évite les écarts fantômes sur une instance créée puis abandonnée vide.
export const CHAMPS_REQUIS_AJOUT: Record<string, string[]> = {
  objectifs:         ['libelle'],
  revenus:           ['libelle'],
  charges:           ['libelle'],
  actifs_financiers: ['nature', 'libelle'],
  immobilier:        ['nature'],
  passifs:           ['nature'],
}

// Colonnes NOT NULL en base pour chaque table cible d'un INSERT (ajout).
// budget_postes.type n'est jamais saisi par le client — dérivé du bloc
// ('revenus' → 'revenu', 'charges' → 'charge') dans application.ts.
export const COLONNES_OBLIGATOIRES_INSERT: Record<string, string[]> = {
  budget_postes:         ['type', 'libelle'],
  actifs_financiers:     ['nature', 'libelle'],
  patrimoine_immobilier: ['nature'],
  passifs:               ['nature'],
  objectifs:             ['libelle'],
}
