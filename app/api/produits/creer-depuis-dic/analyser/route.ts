import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'
import { CreationProduitSchema, type CreationProduit } from '@/lib/schemas/creation-produit'
import { VERSION, SYSTEM_PROMPT, buildUserMessage, type FrontDocType } from '@/lib/prompts/creation-produit'

export const runtime = 'nodejs'

const BUCKET = 'produits-documents'
const MODEL  = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6'
const VALID_TYPES: FrontDocType[] = ['DIC', 'Marche_cible', 'Transparence_frais', 'Brochure', 'Rapport', 'Autre']

function extractJson(text: string): unknown {
  const t = text.trim()
  try { return JSON.parse(t) } catch {}
  const block = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (block) { try { return JSON.parse(block[1].trim()) } catch {} }
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  if (s !== -1 && e > s) { try { return JSON.parse(t.slice(s, e + 1)) } catch {} }
  throw new Error('Réponse Claude sans JSON valide')
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY absente' }, { status: 500 })
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

  // ── Parse FormData multi-doc ───────────────────────────────────────────────
  let formData: FormData
  try { formData = await request.formData() } catch {
    return NextResponse.json({ error: 'Multipart invalide' }, { status: 400 })
  }

  const countStr = formData.get('count') as string | null
  const count    = countStr ? parseInt(countStr, 10) : 0
  if (!count || count < 1 || count > 10) {
    return NextResponse.json({ error: 'Nombre de fichiers invalide (1–10 attendu)' }, { status: 400 })
  }

  type DocInput = { file: File; doc_type: FrontDocType }
  const docInputs: DocInput[] = []

  for (let i = 0; i < count; i++) {
    const file    = formData.get(`file_${i}`) as File | null
    const docType = formData.get(`type_${i}`) as string | null

    if (!file) {
      return NextResponse.json({ error: `Fichier ${i + 1} manquant` }, { status: 400 })
    }
    if (!docType || !VALID_TYPES.includes(docType as FrontDocType)) {
      return NextResponse.json({ error: `Type invalide pour le fichier ${i + 1}` }, { status: 400 })
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: `Fichier ${i + 1} : seuls les PDF sont acceptés` }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: `Fichier ${i + 1} trop volumineux (20 Mo max)` }, { status: 413 })
    }
    docInputs.push({ file, doc_type: docType as FrontDocType })
  }

  // ── Upload + extraction PDF pour chaque document ──────────────────────────
  const service = createServiceSupabase()
  const uploadedPaths: string[] = []

  type DocExtracted = {
    storage_path: string
    nom_fichier:  string
    nb_pages:     number
    texte_extrait: string
    doc_type:     FrontDocType
  }

  const extracted: DocExtracted[] = []

  for (let i = 0; i < docInputs.length; i++) {
    const { file, doc_type } = docInputs[i]
    const buffer    = Buffer.from(await file.arrayBuffer())
    const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `temp/${user.id}/${randomUUID()}_${safeName}`

    const { error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      if (uploadedPaths.length > 0) await service.storage.from(BUCKET).remove(uploadedPaths)
      return NextResponse.json({ error: `Erreur Storage (doc ${i + 1}) : ${uploadError.message}` }, { status: 500 })
    }
    uploadedPaths.push(storagePath)

    let texteExtrait: string
    let nbPages: number

    try {
      type PdfFn = (buf: Buffer) => Promise<{ text: string; numpages: number }>
      const mod      = await import('pdf-parse/lib/pdf-parse.js')
      const pdfParse: PdfFn = (mod as { default?: PdfFn }).default ?? (mod as unknown as PdfFn)
      const parsed   = await pdfParse(buffer)
      texteExtrait   = parsed.text
      nbPages        = parsed.numpages
    } catch (e) {
      await service.storage.from(BUCKET).remove(uploadedPaths)
      return NextResponse.json({ error: `Extraction PDF échouée (doc ${i + 1}) : ${e instanceof Error ? e.message : String(e)}` }, { status: 422 })
    }

    if (!texteExtrait.trim()) {
      await service.storage.from(BUCKET).remove(uploadedPaths)
      return NextResponse.json({ error: `Le fichier ${i + 1} ne contient pas de texte extractible` }, { status: 422 })
    }

    extracted.push({ storage_path: storagePath, nom_fichier: safeName, nb_pages: nbPages, texte_extrait: texteExtrait, doc_type })
  }

  // ── Appel Claude (unique, tous documents combinés) ────────────────────────
  let rawText:   string
  let tokensIn:  number | undefined
  let tokensOut: number | undefined

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response  = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 3000,
      system:     SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildUserMessage({
          documents: extracted.map(d => ({ doc_type: d.doc_type, texte: d.texte_extrait })),
        }),
      }],
    })
    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Réponse Claude non textuelle')
    rawText   = block.text
    tokensIn  = response.usage.input_tokens
    tokensOut = response.usage.output_tokens
  } catch (e) {
    await service.storage.from(BUCKET).remove(uploadedPaths)
    return NextResponse.json({ error: `Erreur Claude : ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
  }

  // ── Validation Zod ────────────────────────────────────────────────────────
  let parsed: unknown
  try { parsed = extractJson(rawText) } catch {
    await service.storage.from(BUCKET).remove(uploadedPaths)
    return NextResponse.json({ error: 'Claude n\'a pas retourné de JSON valide' }, { status: 422 })
  }

  const validation = CreationProduitSchema.safeParse(parsed)
  if (!validation.success) {
    await service.storage.from(BUCKET).remove(uploadedPaths)
    const msg = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: `Validation échouée : ${msg}` }, { status: 422 })
  }

  const preview: CreationProduit = validation.data

  return NextResponse.json({
    preview,
    documents:      extracted,
    modele:         MODEL,
    version_prompt: VERSION,
    tokens_entree:  tokensIn  ?? null,
    tokens_sortie:  tokensOut ?? null,
    analyse_brut:   parsed,
  })
}
