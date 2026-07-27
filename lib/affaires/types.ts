import type { SupabaseClient } from '@supabase/supabase-js'

// Client Supabase passé aux repositories/services (SSR authentifié).
export type Supa = SupabaseClient

// ── Statuts ──────────────────────────────────────────────────────────────────
export type AffaireStatut = 'en_cours' | 'terminee' | 'archivee'
export type EtapeStatut = 'a_faire' | 'en_cours' | 'terminee' | 'ignoree'
export type TacheStatut = 'a_faire' | 'en_cours' | 'terminee' | 'ignoree'
export type DocumentStatut = 'attendu' | 'depose' | 'valide' | 'refuse' | 'non_requis'
export type ControleStatut = 'a_controler' | 'conforme' | 'non_conforme' | 'deroge'
export type PropositionOperation = 'creation' | 'mise_a_jour'
export type PropositionCible =
  | 'actif_financier'
  | 'patrimoine_immobilier'
  | 'passif'
  | 'contrat_prevoyance'
export type PropositionStatut = 'en_attente' | 'appliquee' | 'rejetee' | 'annulee'

// ── Entités ──────────────────────────────────────────────────────────────────
export interface Affaire {
  id: string
  client_id: string
  famille_id: string
  type_id: string
  frise_version_id: string
  produit_id: string | null
  partenaire_id: string | null
  libelle: string
  montant: number | null
  frais: number | null
  revenu_previsionnel: number | null
  revenu_realise: number | null
  statut: AffaireStatut
  motif_archivage_id: string | null
  commentaire_archivage: string | null
  date_ouverture: string
  date_cloture: string | null
  date_archivage: string | null
  version_row: number
  created_at: string
  updated_at: string
}

export interface AffaireEtape {
  id: string
  affaire_id: string
  code: string
  libelle: string
  ordre: number
  statut: EtapeStatut
  validation_manuelle: boolean
  date_debut: string | null
  date_fin: string | null
}

export interface AffaireTache {
  id: string
  affaire_id: string
  etape_id: string
  code: string
  libelle: string
  obligatoire: boolean
  ordre: number
  statut: TacheStatut
}

export interface AffaireDocument {
  id: string
  affaire_id: string
  etape_id: string
  code: string
  libelle: string
  obligatoire: boolean
  ordre: number
  statut: DocumentStatut
}

export interface AffaireControle {
  id: string
  affaire_id: string
  etape_id: string
  code: string
  libelle: string
  obligatoire: boolean
  ordre: number
  statut: ControleStatut
}

export interface AffaireBlocage {
  id: string
  affaire_id: string
  etape_id: string | null
  code: string
  libelle: string
  actif: boolean
  deroge: boolean
  motif_derogation: string | null
}

export interface AffaireChampValeur {
  id: string
  affaire_id: string
  champ_def_id: string
  valeur: unknown | null
}

export interface AffaireEvenement {
  id: string
  affaire_id: string
  type_evenement: string
  motif: string | null
  details: Record<string, unknown>
  auteur_id: string | null
  created_at: string
}

export interface AffaireProposition {
  id: string
  affaire_id: string
  client_id: string
  operation: PropositionOperation
  cible_type: PropositionCible
  donnees_proposees: Record<string, unknown>
  statut: PropositionStatut
  actif_financier_id: string | null
  patrimoine_immobilier_id: string | null
  passif_id: string | null
  contrat_prevoyance_id: string | null
  cree_actif_financier_id: string | null
  cree_patrimoine_immobilier_id: string | null
  cree_passif_id: string | null
  cree_contrat_prevoyance_id: string | null
  decided_by: string | null
  decided_at: string | null
  motif_decision: string | null
  created_at: string
}

// ── Référentiels ─────────────────────────────────────────────────────────────
export interface AffaireFamille { id: string; code: string; libelle: string; ordre: number; actif: boolean }
export interface AffaireType {
  id: string
  famille_id: string
  code: string
  libelle: string
  ordre: number
  actif: boolean
  categorie_patrimoniale: string | null
  categorie_produit: string | null
}
export interface Partenaire { id: string; nom: string; type_partenaire: string; actif: boolean }
export interface FriseVersion {
  id: string
  famille_id: string
  version: string
  statut: 'brouillon' | 'publie' | 'archive'
  actif: boolean
}

// ── Détail agrégé d'une affaire ──────────────────────────────────────────────
export interface AffaireDetail {
  affaire: Affaire
  etapes: AffaireEtape[]
  taches: AffaireTache[]
  documents: AffaireDocument[]
  controles: AffaireControle[]
  blocages: AffaireBlocage[]
  champs: AffaireChampValeur[]
}

// ── Réponses des RPC ─────────────────────────────────────────────────────────
export interface RpcAffaireResult { affaire_id: string; version_row: number }
export interface RpcPropositionResult { proposition_id: string; version_row: number }
