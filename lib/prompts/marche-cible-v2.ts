// Prompt v2 — analyse marché cible MIF2/IDD + extraction des faits factuels du DICI.
// Étend marche-cible-v1 en ajoutant la section produit_facts.

export const VERSION = 'marche-cible-v2'

const MAX_TEXT_CHARS = 80_000

export const SYSTEM_PROMPT = `Tu es un expert en réglementation financière européenne, spécialisé dans la gouvernance produit au sens de la directive MIF2 (2014/65/UE) et de la directive IDD (2016/97/UE).

Ta mission : analyser le texte extrait d'un document financier (DICI, KIID, brochure, note d'information) et :
1. Déduire le marché cible réglementaire (marché cible positif et négatif).
2. Extraire les faits factuels clés du produit (SRI, frais, durée, rendements) tels qu'ils apparaissent explicitement dans le document.

Règles impératives :
1. Tu retournes UNIQUEMENT un objet JSON valide. Zéro texte avant ou après, zéro bloc markdown, zéro \`\`\`json.
2. Si tu ne peux pas déterminer une valeur avec certitude à partir du document, retourne null — n'invente rien.
3. Le score_confiance reflète honnêtement la qualité et la complétude des informations disponibles (0 = aucune information utile, 1 = toutes les dimensions clairement documentées).
4. Les justifications sont facultatives mais utiles : une phrase courte suffit.
5. Pour produit_facts : n'extrais que les valeurs explicitement présentes dans le texte. Si une valeur est absente ou ambiguë, retourne null.`

export function buildUserMessage(params: {
  nomProduit:             string
  categorieReglementaire: string | null
  texteExtrait:           string
}): string {
  const { nomProduit, categorieReglementaire, texteExtrait } = params
  const texte = texteExtrait.length > MAX_TEXT_CHARS
    ? texteExtrait.slice(0, MAX_TEXT_CHARS) + '\n[… texte tronqué …]'
    : texteExtrait

  return `Analyse le document ci-dessous, déduis le marché cible réglementaire MIF2/IDD et extrais les faits factuels du produit.

PRODUIT : ${nomProduit}${categorieReglementaire ? ` — catégorie réglementaire : ${categorieReglementaire}` : ''}

TEXTE EXTRAIT :
---
${texte}
---

Retourne UNIQUEMENT l'objet JSON suivant (sans markdown, sans texte autour) :

{
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
  "score_confiance": <nombre entre 0.00 et 1.00>,
  "notes": "<observations importantes, ambiguïtés, avertissements — optionnel>",
  "produit_facts": {
    "sri":                 <indicateur de risque entier 1-7, ou null si absent>,
    "frais_gestion":       <frais courants annuels en %, ex. 1.5 — ou null>,
    "frais_entree":        <frais d'entrée maximaux en % — ou null>,
    "frais_sortie":        <frais de sortie maximaux en % — ou null>,
    "duree_detention_min": <durée minimale de détention recommandée en années entières — ou null>,
    "rendement_n1":        <rendement de la dernière année civile en % — ou null>,
    "rendement_3ans":      <rendement annualisé sur 3 ans en % — ou null>
  }
}

Définitions marché cible :
- connaissance    : niveau minimal requis pour comprendre le produit et ses risques
- experience      : expérience d'investissement minimale recommandée
- capacite_pertes : capacité max de l'investisseur cible à absorber des pertes (positif) ; inversement pour le négatif
- tolerance_risque: correspond au SRI — tres_faible=SRI1, faible=SRI2-3, moyenne=SRI4, elevee=SRI5-6, tres_elevee=SRI7
- horizon         : horizon d'investissement recommandé par l'émetteur
- sensibilite_esg : exigences en matière de durabilité/ESG du produit`
}
