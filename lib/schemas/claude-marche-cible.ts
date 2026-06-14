// Schéma Zod pour la réponse attendue de Claude lors de l'analyse marché cible.
//
// Flux prévu (étape 2 — non encore développée) :
//   1. Envoi du texte extrait (documents_extraits.texte_extrait) à Claude
//   2. Claude retourne un JSON structuré
//   3. Ce JSON est validé par ce schéma Zod AVANT tout traitement
//   4. Si invalide → rejeté, statut_analyse = 'erreur', erreur_analyse = message Zod
//   5. Si valide  → stocké dans documents_extraits.analyse_resultat_brut (JSONB)
//   6. Seulement ensuite → mappé vers les colonnes mc_pos_* / mc_neg_* de produits_gouvernance
//
// Règle absolue : jamais mapper vers la DB sans validation Zod préalable.

import { z } from 'zod'

// ── Valeurs autorisées — miroir exact des CHECK constraints SQL ───────────────

const ConnaisanceMC    = z.enum(['basique', 'informe', 'expert'])
const ExperienceMC     = z.enum(['faible', 'moyenne', 'elevee'])
const CapacitePertesMC = z.enum(['aucune_perte', 'pertes_limitees', 'perte_capital', 'pertes_superieures'])
const ToleranceRisqueMC = z.enum(['tres_faible', 'faible', 'moyenne', 'elevee', 'tres_elevee'])
const HorizonMC        = z.enum(['moins_2_ans', 'entre_2_et_5_ans', 'plus_5_ans'])
const SensibiliteESGMC = z.enum(['aucune', 'moderee', 'forte'])

// ── Dimensions d'un profil (positif ou négatif) ───────────────────────────────

const ProfilMarcheCible = z.object({
  connaissance:     ConnaisanceMC.nullable(),
  experience:       ExperienceMC.nullable(),
  capacite_pertes:  CapacitePertesMC.nullable(),
  tolerance_risque: ToleranceRisqueMC.nullable(),
  horizon:          HorizonMC.nullable(),
  sensibilite_esg:  SensibiliteESGMC.nullable(),
})

// ── Justifications narratives par dimension ───────────────────────────────────

const Justifications = z.object({
  connaissance:     z.string().max(500).optional(),
  experience:       z.string().max(500).optional(),
  capacite_pertes:  z.string().max(500).optional(),
  tolerance_risque: z.string().max(500).optional(),
  horizon:          z.string().max(500).optional(),
  sensibilite_esg:  z.string().max(500).optional(),
})

// ── Faits factuels extraits du DICI (v2) ─────────────────────────────────────
// Champs objectifs tirés du document — mis à jour dans `produits` sans validation humaine.

const ProduitFactsDICI = z.object({
  sri:                 z.number().int().min(1).max(7).nullable().optional(),
  frais_gestion:       z.number().min(0).max(100).nullable().optional(),
  frais_entree:        z.number().min(0).max(100).nullable().optional(),
  frais_sortie:        z.number().min(0).max(100).nullable().optional(),
  duree_detention_min: z.number().int().min(0).max(50).nullable().optional(),
  rendement_n1:        z.number().min(-100).max(1000).nullable().optional(),
  rendement_3ans:      z.number().min(-100).max(1000).nullable().optional(),
})

// ── Schéma principal — ce que Claude doit retourner ──────────────────────────

export const ClaudeMarCibleSchema = z.object({
  // Marché cible positif (investisseurs auxquels le produit est DESTINÉ)
  marche_cible_positif: ProfilMarcheCible,

  // Marché cible négatif (investisseurs auxquels le produit est DÉCONSEILLÉ)
  marche_cible_negatif: ProfilMarcheCible,

  // Justifications narratives (une phrase par dimension, optionnel)
  justifications: Justifications,

  // Score de confiance global : 0.000 → 1.000
  // < 0.5 = données insuffisantes, 0.5–0.8 = partiel, > 0.8 = fiable
  score_confiance: z.number().min(0).max(1),

  // Notes libres du modèle (ambiguïtés, hypothèses, avertissements)
  notes: z.string().max(1000).optional(),

  // Faits factuels du document (v2 — absents dans les anciennes réponses v1)
  produit_facts: ProduitFactsDICI.optional(),
})

export type ClaudeMarCibleResponse = z.infer<typeof ClaudeMarCibleSchema>
export type ProduitFacts = z.infer<typeof ProduitFactsDICI>

// ── Mappage vers les colonnes produits_gouvernance ────────────────────────────
// À utiliser APRÈS validation Zod pour peupler les champs mc_pos_* / mc_neg_*

export function mapperVersGouvernance(r: ClaudeMarCibleResponse) {
  return {
    mc_pos_connaissance:     r.marche_cible_positif.connaissance,
    mc_pos_experience:       r.marche_cible_positif.experience,
    mc_pos_capacite_pertes:  r.marche_cible_positif.capacite_pertes,
    mc_pos_tolerance_risque: r.marche_cible_positif.tolerance_risque,
    mc_pos_horizon:          r.marche_cible_positif.horizon,
    mc_pos_sensibilite_esg:  r.marche_cible_positif.sensibilite_esg,

    mc_neg_connaissance:     r.marche_cible_negatif.connaissance,
    mc_neg_experience:       r.marche_cible_negatif.experience,
    mc_neg_capacite_pertes:  r.marche_cible_negatif.capacite_pertes,
    mc_neg_tolerance_risque: r.marche_cible_negatif.tolerance_risque,
    mc_neg_horizon:          r.marche_cible_negatif.horizon,
    mc_neg_sensibilite_esg:  r.marche_cible_negatif.sensibilite_esg,

    justifications_ia:  r.justifications,
    score_confiance_ia: r.score_confiance,
    source_marche_cible: 'deduit_ia' as const,
  }
}

// ── Mappage vers les colonnes produits ────────────────────────────────────────
// Retourne null si aucun champ n'a pu être extrait.
// Les champs retournés sont des valeurs numériques factuelles — pas de validation humaine requise.

export function mapperVersProduit(r: ClaudeMarCibleResponse): Record<string, number> | null {
  const f = r.produit_facts
  if (!f) return null
  const update: Record<string, number> = {}
  if (f.sri                 != null) update.sri                 = f.sri
  if (f.frais_gestion       != null) update.frais_gestion       = f.frais_gestion
  if (f.frais_entree        != null) update.frais_entree        = f.frais_entree
  if (f.frais_sortie        != null) update.frais_sortie        = f.frais_sortie
  if (f.duree_detention_min != null) update.duree_detention_min = f.duree_detention_min
  if (f.rendement_n1        != null) update.rendement_n1        = f.rendement_n1
  if (f.rendement_3ans      != null) update.rendement_3ans      = f.rendement_3ans
  return Object.keys(update).length > 0 ? update : null
}
