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
}
