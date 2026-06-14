// Prompt création-produit — analyse d'un dossier documentaire complet pour créer une fiche produit.
// Supporte un ou plusieurs documents avec règles de priorité par type.

export const VERSION = 'creation-produit-v2'

const MAX_CHARS_TOTAL = 80_000

export type FrontDocType = 'DIC' | 'Marche_cible' | 'Transparence_frais' | 'Brochure' | 'Rapport' | 'Autre'

export const DOC_TYPE_LABELS: Record<FrontDocType, string> = {
  DIC:               'DICI — Document d\'Information Clé',
  Marche_cible:      'Marché cible émetteur',
  Transparence_frais:'Transparence des frais',
  Brochure:          'Brochure commerciale',
  Rapport:           'Rapport périodique',
  Autre:             'Autre document',
}

// Priorité d'analyse (index = rang, plus petit = plus prioritaire)
const PRIORITY: Record<FrontDocType, number> = {
  DIC:               0,
  Marche_cible:      1,
  Transparence_frais:2,
  Brochure:          3,
  Rapport:           4,
  Autre:             5,
}

export function sortDocsByPriority<T extends { doc_type: FrontDocType }>(docs: T[]): T[] {
  return [...docs].sort((a, b) => PRIORITY[a.doc_type] - PRIORITY[b.doc_type])
}

export const SYSTEM_PROMPT = `Tu es un expert en réglementation financière européenne, spécialisé en gouvernance produit (MIF2 / IDD) et en analyse de documents financiers (DICI, KIID, DIC, brochures, fiches de transparence des frais).

Ta mission : analyser un dossier documentaire complet et produire une fiche produit exhaustive comprenant :
1. Les métadonnées du produit (nom, émetteur, catégorie, ISIN, description, commentaires)
2. Les faits factuels chiffrés (SRI, frais, durée, rendements)
3. Le marché cible réglementaire (positif et négatif) au sens MIF2 / IDD

Règles de priorité entre documents :
- DICI / DIC : prioritaire pour le nom exact du produit, le type produit, le SRI, la durée de détention recommandée, les risques et les coûts totaux
- Marché cible émetteur : prioritaire pour les dimensions du marché cible positif et négatif
- Transparence des frais : prioritaire pour le détail des frais (entrée, gestion, sortie, transaction)
- Brochure commerciale : secondaire, utile uniquement pour enrichir la description commerciale
- En cas de conflit entre documents : la valeur la plus précise et documentée prime

Règles impératives :
1. Tu retournes UNIQUEMENT un objet JSON valide. Zéro texte avant ou après, zéro bloc markdown.
2. Si une valeur n'est pas clairement présente dans les documents, retourne null — n'invente rien.
3. Le score_confiance reflète la qualité globale des informations disponibles (0 = aucune info utile, 1 = toutes les données présentes et cohérentes).
4. Pour la description : 2 à 4 phrases professionnelles en français sur le produit, ses objectifs et son positionnement.
5. Pour le commentaire_sri : 1 à 2 phrases en français expliquant ce que signifie ce niveau de risque SRI pour l'investisseur.`

export function buildUserMessage(params: {
  documents: Array<{ doc_type: FrontDocType; texte: string }>
}): string {
  const sorted = sortDocsByPriority(params.documents)
  const perDocLimit = Math.floor(MAX_CHARS_TOTAL / Math.max(sorted.length, 1))

  const sections = sorted.map((doc, i) => {
    const texte = doc.texte.length > perDocLimit
      ? doc.texte.slice(0, perDocLimit) + '\n[… texte tronqué …]'
      : doc.texte
    const label = DOC_TYPE_LABELS[doc.doc_type]
    return `=== DOCUMENT ${i + 1} — ${label} ===\n${texte}\n=== FIN DOCUMENT ${i + 1} ===`
  }).join('\n\n')

  return `Analyse le dossier documentaire ci-dessous (${sorted.length} document${sorted.length > 1 ? 's' : ''}) et produis une fiche produit complète.

${sections}

Retourne UNIQUEMENT l'objet JSON suivant (sans markdown, sans texte autour) :

{
  "metadonnees_produit": {
    "nom":                    "<nom exact du produit — priorité au DICI>",
    "societe_gestion":        "<société de gestion / émetteur — ou null>",
    "categorie":              "AV" | "SCPI" | "PER" | "Capitalisation" | null,
    "categorie_reglementaire": "OPCVM" | "FIA" | "assurance_vie" | "capitalisation" | "per_individuel" | "per_collectif" | "scpi" | "opci" | "produit_structure" | "autre" | null,
    "isin":                   "<code ISIN 12 caractères — ou null si absent>",
    "description":            "<2 à 4 phrases de présentation professionnelle — ou null>",
    "commentaire_sri":        "<1 à 2 phrases sur le niveau de risque SRI — ou null>",
    "public_exclu":           "<clientèle exclue — priorité au marché cible émetteur — ou null>",
    "conditions_acces":       "<conditions d'accès particulières — ou null>",
    "conflits_interet":       "<conflits d'intérêt identifiés — ou null>",
    "notes_gouvernance":      "<restrictions ou observations de gouvernance — ou null>",
    "mc_emetteur_texte":      "<texte source exact de l'émetteur sur le marché cible — ou null>"
  },
  "marche_cible_positif": {
    "connaissance":     "basique" | "informe" | "expert" | null,
    "experience":       "faible" | "moyenne" | "elevee" | null,
    "capacite_pertes":  "aucune_perte" | "pertes_limitees" | "perte_capital" | "pertes_superieures" | null,
    "tolerance_risque": "tres_faible" | "faible" | "moyenne" | "elevee" | "tres_elevee" | null,
    "horizon":          "moins_2_ans" | "entre_2_et_5_ans" | "plus_5_ans" | null,
    "sensibilite_esg":  "aucune" | "moderee" | "forte" | null
  },
  "marche_cible_negatif": {
    "connaissance":     <mêmes valeurs ou null>,
    "experience":       <mêmes valeurs ou null>,
    "capacite_pertes":  <mêmes valeurs ou null>,
    "tolerance_risque": <mêmes valeurs ou null>,
    "horizon":          <mêmes valeurs ou null>,
    "sensibilite_esg":  <mêmes valeurs ou null>
  },
  "justifications": {
    "connaissance":     "<phrase courte ou omis>",
    "experience":       "<phrase courte ou omis>",
    "capacite_pertes":  "<phrase courte ou omis>",
    "tolerance_risque": "<phrase courte ou omis>",
    "horizon":          "<phrase courte ou omis>",
    "sensibilite_esg":  "<phrase courte ou omis>"
  },
  "score_confiance": <0.00 à 1.00>,
  "notes": "<observations ou ambiguïtés importantes — optionnel>",
  "produit_facts": {
    "sri":                 <entier 1-7 — priorité au DICI — ou null>,
    "frais_gestion":       <% annuels — priorité à la transparence frais — ou null>,
    "frais_entree":        <% maximaux — ou null>,
    "frais_sortie":        <% maximaux — ou null>,
    "duree_detention_min": <années entières — priorité au DICI — ou null>,
    "rendement_n1":        <% ou null>,
    "rendement_3ans":      <% annualisé ou null>
  }
}

Catégories françaises :
- AV  = Assurance-vie · SCPI = Société Civile de Placement Immobilier
- PER = Plan d'Épargne Retraite · Capitalisation = Contrat de capitalisation
Tolérance risque : tres_faible=SRI1, faible=SRI2-3, moyenne=SRI4, elevee=SRI5-6, tres_elevee=SRI7`
}

// Mapping type front-end → type DB (produits_documents.type)
export const DB_TYPE_MAP: Record<FrontDocType, 'DICI' | 'Brochure' | 'Rapport' | 'Autre'> = {
  DIC:               'DICI',
  Marche_cible:      'Autre',
  Transparence_frais:'Autre',
  Brochure:          'Brochure',
  Rapport:           'Rapport',
  Autre:             'Autre',
}
