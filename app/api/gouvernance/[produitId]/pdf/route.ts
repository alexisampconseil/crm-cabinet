import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'
import { GouvernanceDocument } from '@/lib/pdf/gouvernance-doc'
import type { PdfData, ProduitPdf, GouvernancePdf, DocumentPdf, ExtraitPdf } from '@/lib/pdf/gouvernance-doc'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ produitId: string }> },
) {
  const { produitId } = await params

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const service = createServiceSupabase()

  // ── Chargement produit ──────────────────────────────────────────────────────
  const { data: produitRaw } = await service
    .from('produits')
    .select(
      'nom, isin, societe_gestion, categorie, categorie_reglementaire, ' +
      'sri, frais_entree, frais_gestion, frais_sortie, duree_detention_min',
    )
    .eq('id', produitId)
    .single()

  const produit = produitRaw as unknown as ProduitPdf | null
  if (!produit) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
  }

  // ── Chargement gouvernance ──────────────────────────────────────────────────
  const { data: gouvernanceRaw } = await service
    .from('produits_gouvernance')
    .select('*')
    .eq('produit_id', produitId)
    .single()

  const gouvernance = gouvernanceRaw as unknown as GouvernancePdf | null
  if (!gouvernance) {
    return NextResponse.json(
      { error: 'Aucune fiche de gouvernance pour ce produit' },
      { status: 404 },
    )
  }

  // ── Documents et extrait IA (en parallèle) ──────────────────────────────────
  const [{ data: documentsRaw }, { data: extraitRaw }] = await Promise.all([
    service
      .from('produits_documents')
      .select('id, type, date_document, statut')
      .eq('produit_id', produitId)
      .order('date_document', { ascending: false }),
    service
      .from('documents_extraits')
      .select('version_prompt, modele_ia, date_analyse_ia, tokens_entree, tokens_sortie')
      .eq('gouvernance_id', gouvernance.id)
      .order('date_analyse_ia', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const documents = (documentsRaw ?? []) as unknown as DocumentPdf[]
  const extrait   = extraitRaw as unknown as ExtraitPdf | null

  const sourceDoc = gouvernance.source_document_id
    ? documents.find((d) => d.id === gouvernance.source_document_id) ?? null
    : null

  // ── Génération PDF ──────────────────────────────────────────────────────────
  const pdfData: PdfData = {
    produit,
    gouvernance,
    documents,
    sourceDoc,
    extrait,
    generatedAt: new Date().toISOString(),
  }

  try {
    const element = React.createElement(GouvernanceDocument, { data: pdfData })
    const buffer  = await renderToBuffer(
      element as React.ReactElement<DocumentProps>,
    )

    const slug = produit.nom
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50)
      .replace(/^-+|-+$/g, '')
    const date = new Date().toISOString().slice(0, 10)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="gouvernance-${slug}-${date}.pdf"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (e) {
    console.error('[pdf/gouvernance]', e)
    return NextResponse.json(
      { error: `Erreur génération PDF : ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
