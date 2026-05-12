import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin as admin } from '@/lib/supabaseAdmin'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const DDA_CONTEXT: Record<string, string> = {
  AV: "assurance-vie (fonds euros et unités de compte), enveloppe fiscale de long terme pour l'épargne et la transmission",
  SCPI: "Société Civile de Placement Immobilier, investissement immobilier indirect pierre-papier avec objectif de revenus réguliers",
  PER: "Plan d'Épargne Retraite, produit d'épargne retraite avec avantage fiscal à l'entrée et sortie en rente ou capital",
  Capitalisation: "contrat de capitalisation, enveloppe fiscale de long terme adaptée aux personnes morales et à l'optimisation successorale",
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth conseiller
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'conseiller') return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  // Récupérer le produit
  const { data: produit, error } = await admin.from('produits').select('*').eq('id', id).single()
  if (error || !produit) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Clé API Anthropic manquante' }, { status: 500 })

  const contextDDA = DDA_CONTEXT[produit.categorie] ?? produit.categorie
  const rendements = [
    produit.rendement_n1 ? `rendement N-1 : ${produit.rendement_n1} %` : null,
    produit.rendement_3ans ? `rendement 3 ans annualisé : ${produit.rendement_3ans} %` : null,
    produit.ratio_sharpe_3ans ? `ratio de Sharpe 3 ans : ${produit.ratio_sharpe_3ans}` : null,
  ].filter(Boolean).join(', ')

  const prompt = `Tu es un expert en gestion de patrimoine français (CGP-CIF). Rédige une présentation professionnelle et concise du produit suivant, destinée à un conseiller financier.

Produit : ${produit.nom}
Société de gestion : ${produit.societe_gestion ?? 'Non précisée'}
Catégorie : ${produit.categorie} — ${contextDDA}
SRI (1-7) : ${produit.sri ?? 'Non défini'}
Données de performance : ${rendements || 'Non disponibles'}

Instructions :
- 3 à 4 paragraphes maximum
- Ton factuel, sobre, professionnel — style cabinet de gestion de patrimoine haut de gamme
- Expliquer le mécanisme, les avantages fiscaux si applicable, et le profil investisseur adapté
- Ne pas inventer de chiffres non fournis
- Rédiger en français, sans markdown ni titres
- Conclusion sur l'adéquation au marché cible DDA`

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    return NextResponse.json({ error: `Erreur Anthropic: ${err}` }, { status: 500 })
  }

  const result = await response.json()
  const description = result.content?.[0]?.text ?? ''

  // Générer aussi le commentaire SRI
  const sriPrompt = `En une phrase concise et professionnelle, explique ce que signifie un SRI de ${produit.sri}/7 pour le produit "${produit.nom}" (${produit.categorie}), dans le contexte de la directive MIF2 et des exigences DDA. Langue française, ton sobre.`

  let commentaireSri = ''
  if (produit.sri) {
    const sriRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: sriPrompt }],
      }),
    })
    if (sriRes.ok) {
      const sriResult = await sriRes.json()
      commentaireSri = sriResult.content?.[0]?.text ?? ''
    }
  }

  // Sauvegarder en base
  await admin.from('produits').update({
    description_ia: description,
    ...(commentaireSri ? { commentaire_sri_ia: commentaireSri } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json({ description, commentaire_sri: commentaireSri })
}
