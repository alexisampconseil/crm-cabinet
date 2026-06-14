import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'
import { ClaudeMarCibleSchema, mapperVersGouvernance, mapperVersProduit } from '@/lib/schemas/claude-marche-cible'
import { VERSION, SYSTEM_PROMPT, buildUserMessage } from '@/lib/prompts/marche-cible-v2'

export const runtime = 'nodejs'

// Sonnet par défaut (rapport qualité/coût optimal pour l'analyse documentaire).
// Pour forcer Opus : CLAUDE_MODEL=claude-opus-4-8 dans .env.local
const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6'

// ── Extraction JSON robuste ───────────────────────────────────────────────────
// Claude peut parfois encapsuler le JSON dans un bloc markdown malgré l'instruction.
function extractJson(text: string): unknown {
  const trimmed = text.trim()

  // Tentative directe
  try { return JSON.parse(trimmed) } catch {}

  // Extraction depuis un bloc ```json … ``` ou ``` … ```
  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()) } catch {}
  }

  // Extraction du premier { … } du texte
  const start = trimmed.indexOf('{')
  const end   = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)) } catch {}
  }

  throw new Error('La réponse de Claude ne contient pas de JSON valide')
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Vérification clé API ──────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY absente — ajoutez-la dans .env.local' },
      { status: 500 }
    )
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Parsing body ──────────────────────────────────────────────────────────
  let body: { extrait_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const { extrait_id } = body
  if (!extrait_id) {
    return NextResponse.json({ error: 'extrait_id requis' }, { status: 400 })
  }

  const service = createServiceSupabase()

  // ── Chargement de l'extrait ───────────────────────────────────────────────
  const { data: extrait, error: extraitError } = await service
    .from('documents_extraits')
    .select('id, document_id, texte_extrait, statut_analyse')
    .eq('id', extrait_id)
    .single()

  if (extraitError || !extrait) {
    return NextResponse.json({ error: 'Extrait introuvable' }, { status: 404 })
  }
  if (extrait.statut_analyse === 'en_cours') {
    return NextResponse.json({ error: 'Une analyse est déjà en cours' }, { status: 409 })
  }
  if (!extrait.texte_extrait?.trim()) {
    return NextResponse.json({ error: 'Aucun texte extrait disponible' }, { status: 422 })
  }

  // ── Chargement du produit ─────────────────────────────────────────────────
  const { data: doc } = await service
    .from('produits_documents')
    .select('produit_id')
    .eq('id', extrait.document_id)
    .single()

  if (!doc) {
    return NextResponse.json({ error: 'Document source introuvable' }, { status: 404 })
  }

  const { data: produit } = await service
    .from('produits')
    .select('id, nom, categorie_reglementaire')
    .eq('id', doc.produit_id)
    .single()

  if (!produit) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
  }

  // ── Statut → en_cours ─────────────────────────────────────────────────────
  await service
    .from('documents_extraits')
    .update({ statut_analyse: 'en_cours' })
    .eq('id', extrait_id)

  // ── Appel Claude ──────────────────────────────────────────────────────────
  let rawText: string
  let tokensIn:  number | undefined
  let tokensOut: number | undefined

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response  = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      messages: [{
        role:    'user',
        content: buildUserMessage({
          nomProduit:             produit.nom,
          categorieReglementaire: produit.categorie_reglementaire as string | null,
          texteExtrait:           extrait.texte_extrait,
        }),
      }],
    })

    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Réponse Claude non textuelle')
    rawText   = block.text
    tokensIn  = response.usage.input_tokens
    tokensOut = response.usage.output_tokens

  } catch (e) {
    // Distingue les erreurs retryables (529 overload, timeout réseau) des erreurs fatales
    const isOverload = e instanceof Anthropic.APIError && e.status === 529
    const isTimeout  = e instanceof Anthropic.APIConnectionTimeoutError

    let msg: string
    let error_code: 'OVERLOAD' | 'TIMEOUT' | 'API_ERROR'
    let httpStatus: number

    if (isOverload) {
      msg        = 'Serveur Claude surchargé (capacité maximale atteinte) — réessayez dans quelques secondes'
      error_code = 'OVERLOAD'
      httpStatus = 503
    } else if (isTimeout) {
      msg        = 'Délai d\'attente Claude dépassé — réessayez dans quelques secondes'
      error_code = 'TIMEOUT'
      httpStatus = 504
    } else {
      msg        = `Erreur API Claude : ${e instanceof Error ? e.message : String(e)}`
      error_code = 'API_ERROR'
      httpStatus = 502
    }

    await service
      .from('documents_extraits')
      .update({ statut_analyse: 'erreur', erreur_analyse: msg })
      .eq('id', extrait_id)
    return NextResponse.json({ error: msg, error_code }, { status: httpStatus })
  }

  // ── Parse JSON ────────────────────────────────────────────────────────────
  let parsed: unknown
  try {
    parsed = extractJson(rawText)
  } catch {
    const msg = 'Impossible de parser la réponse JSON de Claude'
    await service
      .from('documents_extraits')
      .update({ statut_analyse: 'erreur', erreur_analyse: msg })
      .eq('id', extrait_id)
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  // ── Validation Zod stricte ────────────────────────────────────────────────
  const validation = ClaudeMarCibleSchema.safeParse(parsed)
  if (!validation.success) {
    const msg = 'Validation Zod : ' + validation.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    await service
      .from('documents_extraits')
      .update({ statut_analyse: 'erreur', erreur_analyse: msg })
      .eq('id', extrait_id)
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  const resultat = validation.data

  // ── Mise à jour produits_gouvernance ──────────────────────────────────────
  // On sépare INSERT vs UPDATE pour ne pas écraser statut_conformite existant.
  const champsMC = mapperVersGouvernance(resultat)
  const now      = new Date().toISOString()

  const { data: existingGouv } = await service
    .from('produits_gouvernance')
    .select('id')
    .eq('produit_id', doc.produit_id)
    .maybeSingle()

  let gouvernanceId: string

  if (existingGouv) {
    const { data: updated, error: updateError } = await service
      .from('produits_gouvernance')
      .update({
        ...champsMC,
        statut_validation:  'a_valider',
        source_document_id: extrait.document_id,
        modele_ia:          MODEL,
        date_analyse_ia:    now,
      })
      .eq('produit_id', doc.produit_id)
      .select('id')
      .single()

    if (updateError || !updated) {
      const msg = `Erreur mise à jour gouvernance : ${updateError?.message}`
      await service
        .from('documents_extraits')
        .update({ statut_analyse: 'erreur', erreur_analyse: msg })
        .eq('id', extrait_id)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    gouvernanceId = updated.id

  } else {
    const { data: inserted, error: insertError } = await service
      .from('produits_gouvernance')
      .insert({
        produit_id:         doc.produit_id,
        ...champsMC,
        statut_validation:  'a_valider',
        statut_conformite:  'conforme',
        source_document_id: extrait.document_id,
        modele_ia:          MODEL,
        date_analyse_ia:    now,
        alerte_revue:       false,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      const msg = `Erreur création gouvernance : ${insertError?.message}`
      await service
        .from('documents_extraits')
        .update({ statut_analyse: 'erreur', erreur_analyse: msg })
        .eq('id', extrait_id)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    gouvernanceId = inserted.id
  }

  // ── Mise à jour champs factuels produit (non-bloquant) ───────────────────
  // Les faits extraits du DICI (SRI, frais, durée, rendements) sont écrits directement
  // dans `produits` sans validation humaine — ce sont des données objectives du document.
  const champsProduit = mapperVersProduit(resultat)
  if (champsProduit) {
    try {
      await service.from('produits').update(champsProduit).eq('id', doc.produit_id)
    } catch (e) {
      console.error('[analyze] Mise à jour produit non-bloquante échouée:', e)
    }
  }

  // ── Marquage extrait terminé ──────────────────────────────────────────────
  await service
    .from('documents_extraits')
    .update({
      statut_analyse:        'analyse_terminee',
      gouvernance_id:        gouvernanceId,
      modele_ia:             MODEL,
      version_prompt:        VERSION,
      date_analyse_ia:       now,
      tokens_entree:         tokensIn  ?? null,
      tokens_sortie:         tokensOut ?? null,
      analyse_resultat_brut: parsed as Record<string, unknown>,
    })
    .eq('id', extrait_id)

  return NextResponse.json({
    gouvernance_id:    gouvernanceId,
    score_confiance:   resultat.score_confiance,
    modele:            MODEL,
    date_analyse:      now,
    statut_validation: 'a_valider',
  })
}
