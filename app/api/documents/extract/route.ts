import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

const BUCKET = 'produits-documents'

export async function POST(request: NextRequest) {
  try {
    return await handleExtract(request)
  } catch (e) {
    console.error('[/api/documents/extract] Erreur non capturée:', e)
    return NextResponse.json(
      { error: `Erreur interne : ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    )
  }
}

async function handleExtract(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Paramètres ────────────────────────────────────────────────────────────
  let body: { document_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const { document_id } = body
  if (!document_id) {
    return NextResponse.json({ error: 'document_id requis' }, { status: 400 })
  }

  const service = createServiceSupabase()

  // ── Charger le document ────────────────────────────────────────────────────
  const { data: doc, error: docError } = await service
    .from('produits_documents')
    .select('id, storage_path, type')
    .eq('id', document_id)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  }
  if (!doc.storage_path) {
    return NextResponse.json(
      { error: 'Document externe — extraction uniquement sur les fichiers uploadés' },
      { status: 400 }
    )
  }

  // ── Téléchargement depuis Storage ─────────────────────────────────────────
  const { data: fileBlob, error: dlError } = await service.storage
    .from(BUCKET)
    .download(doc.storage_path)

  if (dlError || !fileBlob) {
    return NextResponse.json(
      { error: `Téléchargement Storage : ${dlError?.message ?? 'fichier introuvable'}` },
      { status: 500 }
    )
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer())

  // ── SHA-256 — déduplication ───────────────────────────────────────────────
  const hash = createHash('sha256').update(buffer).digest('hex')

  const { data: existant } = await service
    .from('documents_extraits')
    .select('id, nb_pages, hash_fichier')
    .eq('document_id', document_id)
    .eq('hash_fichier', hash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existant) {
    return NextResponse.json({
      extrait_id:   existant.id,
      nb_pages:     existant.nb_pages,
      hash_fichier: hash,
      deduplique:   true,
    })
  }

  // ── Extraction texte PDF ───────────────────────────────────────────────────
  // Import dynamique de lib/pdf-parse.js pour bypasser index.js (piège module.parent dans Node 14+)
  let texte: string
  let nb_pages: number
  try {
    type PdfFn = (buf: Buffer) => Promise<{ text: string; numpages: number }>
    const mod = await import('pdf-parse/lib/pdf-parse.js')
    const pdfParse: PdfFn = (mod as { default?: PdfFn }).default ?? (mod as unknown as PdfFn)
    const parsed = await pdfParse(buffer)
    texte    = parsed.text.trim()
    nb_pages = parsed.numpages
  } catch (e) {
    console.error('[/api/documents/extract] Erreur extraction PDF:', e)
    return NextResponse.json(
      { error: `Extraction PDF échouée : ${e instanceof Error ? e.message : String(e)}` },
      { status: 422 }
    )
  }

  if (!texte) {
    return NextResponse.json(
      { error: 'PDF vide ou non extractible (PDF scanné sans OCR ?)' },
      { status: 422 }
    )
  }

  // ── Insertion documents_extraits ──────────────────────────────────────────
  const { data: extrait, error: insertError } = await service
    .from('documents_extraits')
    .insert({
      document_id,
      texte_extrait:      texte,
      nb_pages,
      hash_fichier:       hash,
      extraction_methode: 'pdf_parse',
      statut_analyse:     'en_attente',
    })
    .select('id')
    .single()

  if (insertError || !extrait) {
    return NextResponse.json(
      { error: `Erreur DB extraction : ${insertError?.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    extrait_id:   extrait.id,
    nb_pages,
    hash_fichier: hash,
    deduplique:   false,
  })
}
