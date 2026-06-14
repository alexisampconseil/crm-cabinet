// Prompt v1 — analyse marché cible MIF2/IDD à partir d'un texte de document produit.
// Versionné pour traçabilité : chaque extrait enregistre le version_prompt utilisé.

export const VERSION = 'marche-cible-v1'

// Limite de texte envoyé à Claude (caractères). Les DICI font rarement plus de 20 000
// caractères ; on préserve de la marge pour les rapports annuels plus longs.
const MAX_TEXT_CHARS = 80_000

export const SYSTEM_PROMPT = `Tu es un expert en réglementation financière européenne, spécialisé dans la gouvernance produit au sens de la directive MIF2 (2014/65/UE) et de la directive IDD (2016/97/UE).

Ta mission : analyser le texte extrait d'un document financier (DICI, KIID, brochure, note d'information) et en déduire le marché cible réglementaire, c'est-à-dire la catégorie d'investisseurs à laquelle le produit est destiné (marché cible positif) et celle à laquelle il est déconseillé (marché cible négatif).

Règles impératives :
1. Tu retournes UNIQUEMENT un objet JSON valide. Zéro texte avant ou après, zéro bloc markdown, zéro \`\`\`json.
2. Si tu ne peux pas déterminer une dimension avec certitude à partir du document, retourne null pour cette dimension — n'invente rien.
3. Le score_confiance reflète honnêtement la qualité et la complétude des informations disponibles dans le texte (0 = aucune information utile, 1 = toutes les dimensions clairement documentées).
4. Les justifications sont facultatives mais utiles : une phrase courte suffit.`

export function buildUserMessage(params: {
  nomProduit: string
  categorieReglementaire: string | null
  texteExtrait: string
}): string {
  const { nomProduit, categorieReglementaire, texteExtrait } = params
  const texte = texteExtrait.length > MAX_TEXT_CHARS
    ? texteExtrait.slice(0, MAX_TEXT_CHARS) + '\n[… texte tronqué …]'
    : texteExtrait

  return `Analyse le document ci-dessous et déduis le marché cible réglementaire MIF2/IDD.

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
  "notes": "<observations importantes, ambiguïtés, avertissements — optionnel>"
}

Définitions :
- connaissance    : niveau minimal requis pour comprendre le produit et ses risques
- experience      : expérience d'investissement minimale recommandée
- capacite_pertes : capacité max de l'investisseur cible à absorber des pertes (positif) ; inversement pour le négatif
- tolerance_risque: correspond au SRI — très_faible=SRI1, faible=SRI2-3, moyenne=SRI4, élevée=SRI5-6, très_élevée=SRI7
- horizon         : horizon d'investissement recommandé par l'émetteur
- sensibilite_esg : exigences en matière de durabilité/ESG du produit`
}
