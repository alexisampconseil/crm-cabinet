// Schéma Zod pour la création d'un produit depuis un DICI.
// Claude est invité à extraire les métadonnées produit ET les données de gouvernance
// en une seule analyse. Tout reste en statut a_valider — jamais validé automatiquement.

import { z } from 'zod'

// ── Énumérations — miroir exact des CHECK constraints SQL ─────────────────────

const ConnaisanceMC    = z.enum(['basique', 'informe', 'expert'])
const ExperienceMC     = z.enum(['faible', 'moyenne', 'elevee'])
const CapacitePertesMC = z.enum(['aucune_perte', 'pertes_limitees', 'perte_capital', 'pertes_superieures'])
const ToleranceRisqueMC = z.enum(['tres_faible', 'faible', 'moyenne', 'elevee', 'tres_elevee'])
const HorizonMC        = z.enum(['moins_2_ans', 'entre_2_et_5_ans', 'plus_5_ans'])
const SensibiliteESGMC = z.enum(['aucune', 'moderee', 'forte'])

const ProfilMarcheCible = z.object({
  connaissance:     ConnaisanceMC.nullable(),
  experience:       ExperienceMC.nullable(),
  capacite_pertes:  CapacitePertesMC.nullable(),
  tolerance_risque: ToleranceRisqueMC.nullable(),
  horizon:          HorizonMC.nullable(),
  sensibilite_esg:  SensibiliteESGMC.nullable(),
})

// ── Métadonnées produit ───────────────────────────────────────────────────────

const CategorieProduit   = z.enum(['AV', 'SCPI', 'PER', 'Capitalisation'])
const CategorieReglementaire = z.enum([
  'OPCVM', 'FIA', 'assurance_vie', 'capitalisation',
  'per_individuel', 'per_collectif', 'scpi', 'opci', 'produit_structure', 'autre',
])

export const MetadonneesProduitSchema = z.object({
  nom:                    z.string().min(1).max(200),
  societe_gestion:        z.string().max(200).nullable().optional(),
  categorie:              CategorieProduit.nullable().optional(),
  categorie_reglementaire: CategorieReglementaire.nullable().optional(),
  isin:                   z.string().max(20).nullable().optional(),
  description:            z.string().max(5000).nullable().optional(),
  commentaire_sri:        z.string().max(2000).nullable().optional(),
  // Champs narratifs de gouvernance
  public_exclu:           z.string().max(1000).nullable().optional(),
  conditions_acces:       z.string().max(1000).nullable().optional(),
  conflits_interet:       z.string().max(1000).nullable().optional(),
  notes_gouvernance:      z.string().max(1000).nullable().optional(),
  mc_emetteur_texte:      z.string().max(2000).nullable().optional(),
})

// ── Faits factuels du DICI ────────────────────────────────────────────────────

const ProduitFactsDICI = z.object({
  sri:                 z.number().int().min(1).max(7).nullable().optional(),
  frais_gestion:       z.number().min(0).max(100).nullable().optional(),
  frais_entree:        z.number().min(0).max(100).nullable().optional(),
  frais_sortie:        z.number().min(0).max(100).nullable().optional(),
  duree_detention_min: z.number().int().min(0).max(50).nullable().optional(),
  rendement_n1:        z.number().min(-100).max(1000).nullable().optional(),
  rendement_3ans:      z.number().min(-100).max(1000).nullable().optional(),
})

// ── Schéma principal ──────────────────────────────────────────────────────────

export const CreationProduitSchema = z.object({
  metadonnees_produit:  MetadonneesProduitSchema,
  marche_cible_positif: ProfilMarcheCible,
  marche_cible_negatif: ProfilMarcheCible,
  justifications: z.object({
    connaissance:     z.string().max(500).optional(),
    experience:       z.string().max(500).optional(),
    capacite_pertes:  z.string().max(500).optional(),
    tolerance_risque: z.string().max(500).optional(),
    horizon:          z.string().max(500).optional(),
    sensibilite_esg:  z.string().max(500).optional(),
  }),
  score_confiance: z.number().min(0).max(1),
  notes:           z.string().max(1000).optional(),
  produit_facts:   ProduitFactsDICI.optional(),
})

export type CreationProduit      = z.infer<typeof CreationProduitSchema>
export type MetadonneesProduit   = z.infer<typeof MetadonneesProduitSchema>
export type ProduitFactsCreation = z.infer<typeof ProduitFactsDICI>
