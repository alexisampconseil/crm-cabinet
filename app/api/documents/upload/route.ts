import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const BUCKET = 'produits-documents'

export async function POST(request: NextRequest) {
  // ── Auth : vérifier que c'est un conseiller ────────────────────────────────
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

  // ── Parsing multipart ──────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide (multipart attendu)' }, { status: 400 })
  }

  const file          = formData.get('file')          as File | null
  const produit_id    = formData.get('produit_id')    as string | null
  const type          = formData.get('type')          as string | null
  const date_document = formData.get('date_document') as string | null

  if (!file || !produit_id || !type) {
    return NextResponse.json(
      { error: 'Champs requis manquants : file, produit_id, type' },
      { status: 400 }
    )
  }

  const TYPES_VALIDES = ['DICI', 'Brochure', 'Rapport', 'Autre']
  if (!TYPES_VALIDES.includes(type)) {
    return NextResponse.json({ error: `Type invalide. Valeurs acceptées : ${TYPES_VALIDES.join(', ')}` }, { status: 400 })
  }

  // ── Upload Supabase Storage (service role — bucket privé) ──────────────────
  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${produit_id}/${randomUUID()}_${safeName}`
  const buffer      = Buffer.from(await file.arrayBuffer())

  const service = createServiceSupabase()

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/pdf',
      upsert:      false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `Erreur Storage : ${uploadError.message}` },
      { status: 500 }
    )
  }

  // ── Insertion produits_documents (url = NULL, signed URLs générées à la demande) ──
  const { data: doc, error: docError } = await service
    .from('produits_documents')
    .insert({
      produit_id,
      type,
      url:           null,
      storage_path:  storagePath,
      date_document: date_document || null,
      statut:        'actif',
    })
    .select('id, storage_path')
    .single()

  if (docError) {
    await service.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: `Erreur DB : ${docError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    document_id:  doc.id,
    storage_path: doc.storage_path,
  })
}
