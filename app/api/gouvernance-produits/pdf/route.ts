import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'
import { GouvernanceProduitsDocument } from '@/lib/pdf/gouvernance-produits-doc'
import type {
  GouvernanceProduitsData, CatSectionData, ProduitCatPdf,
  GouvernanceLiteGPdf, DocumentGPdf,
} from '@/lib/pdf/gouvernance-produits-doc'

export const runtime = 'nodejs'

// ── Groupes de catégories ─────────────────────────────────────────────────────

interface GroupDef {
  key:         string
  label:       string
  catKeys:     string[]
  includeNull: boolean
}

const GROUPS: GroupDef[] = [
  { key: 'assurance_vie',    label: 'Assurance-vie',               catKeys: ['assurance_vie'],                   includeNull: false },
  { key: 'scpi',             label: 'SCPI / OPCI',                 catKeys: ['scpi', 'opci'],                    includeNull: false },
  { key: 'per',              label: 'PER — Plan Épargne Retraite', catKeys: ['per_individuel', 'per_collectif'], includeNull: false },
  { key: 'capitalisation',   label: 'Capitalisation',              catKeys: ['capitalisation'],                  includeNull: false },
  { key: 'opcvm_fia',        label: 'OPCVM / FIA',                 catKeys: ['OPCVM', 'FIA'],                    includeNull: false },
  { key: 'produit_structure',label: 'Produits structurés',         catKeys: ['produit_structure'],               includeNull: false },
  { key: 'autre',            label: 'Autre',                       catKeys: ['autre'],                           includeNull: true  },
]

// ── Objectifs par catégorie (statiques — édition hors scope) ──────────────────

const OBJECTIVES: Record<string, { compatible: string[]; incompatible: string[] }> = {
  assurance_vie: {
    compatible: [
      'Épargne à long terme (horizon > 8 ans)',
      'Transmission patrimoniale et optimisation successorale',
      "Constitution d'un complément de revenus retraite",
      'Diversification patrimoniale avec souplesse de gestion',
      'Optimisation fiscale (abattements après 8 ans, succession)',
    ],
    incompatible: [
      'Besoin de liquidité à court terme (< 4 ans)',
      "Financement d'un projet immédiat",
      'Couverture décès pure (produit inadapté)',
      'Profil sans tolérance aux risques de marché (UC)',
    ],
  },
  scpi: {
    compatible: [
      'Revenus fonciers complémentaires réguliers',
      'Diversification immobilière sans gestion directe',
      'Constitution de patrimoine immobilier (horizon > 8 ans)',
      'Préparation retraite par les revenus locatifs',
      'Optimisation fiscale (SCPI Pinel, Malraux, déficit foncier)',
    ],
    incompatible: [
      'Besoin de liquidité rapide (délai de cession variable)',
      'Horizon court terme (< 8 ans)',
      'Aversion totale au risque de perte en capital',
      'Recherche de rendement garanti',
    ],
  },
  per: {
    compatible: [
      "Préparation retraite — horizon très long terme (> 10 ans)",
      'Déduction fiscale des versements sur revenus imposables',
      "Constitution d'un capital ou d'une rente à la retraite",
      'Épargne systématique disciplinée',
    ],
    incompatible: [
      'Besoin de disponibilité des fonds avant la retraite (sauf cas dérogatoires légaux)',
      'Profil faiblement imposable (déduction peu avantageuse)',
      'Horizon inférieur à 10 ans',
    ],
  },
  capitalisation: {
    compatible: [
      'Trésorerie long terme de personne morale (entreprise, association)',
      "Optimisation de l'IS sur les produits financiers",
      "Valorisation de l'épargne excédentaire de la structure",
      "Transmission intergénérationnelle au sein d'une structure",
    ],
    incompatible: [
      'Personnes physiques souhaitant une fiscalité avantageuse (AV préférable)',
      'Besoin de trésorerie court terme',
      'Objectif de revenus réguliers immédiats',
    ],
  },
  opcvm_fia: {
    compatible: [
      'Diversification des actifs financiers (actions, obligations, alternatifs)',
      'Gestion déléguée par des professionnels',
      'Profils patrimoniaux, équilibrés ou dynamiques',
      'Liquidité quotidienne (OPCVM)',
      'Accès à des stratégies spécialisées (FIA)',
    ],
    incompatible: [
      'Aversion totale à la volatilité ou aux pertes en capital',
      "Horizon très court terme (< 2 ans pour fonds actions)",
      "Recherche d'une garantie en capital (hors fonds à formule)",
    ],
  },
  produit_structure: {
    compatible: [
      "Protection partielle du capital à l'échéance selon barrière",
      'Rendement conditionnel indexé sur un sous-jacent défini',
      'Diversification avec visibilité sur le mécanisme de remboursement',
      'Profils souhaitant un filet de protection partielle sur actions',
    ],
    incompatible: [
      'Besoin de liquidité (faible liquidité secondaire)',
      'Incompréhension du mécanisme conditionnel de remboursement',
      'Horizon ne correspondant pas à la durée structurelle du produit',
      'Aversion aux risques de contrepartie émetteur',
    ],
  },
  autre: {
    compatible: [
      'Objectifs spécifiques selon la nature et la documentation du produit',
      'À préciser dans le dossier de gouvernance produit individuel',
    ],
    incompatible: [
      'À définir selon le dossier de gouvernance du produit concerné',
    ],
  },
}

// ── Types internes PostgREST ──────────────────────────────────────────────────

type RowRaw = {
  id:                      string
  nom:                     string
  societe_gestion:         string | null
  categorie_reglementaire: string | null
  sri:                     number | null
  produits_gouvernance:    GouvernanceLiteGPdf | null
}

type DocRow     = { produit_id: string; type: string; date_document: string | null }
type ExtraitRow = { gouvernance_id: string; version_prompt: string | null }

// ID fictif utilisé comme guard quand la liste d'IDs est vide
const FAKE_ID = '00000000-0000-0000-0000-000000000000'
const safe    = (ids: string[]) => (ids.length > 0 ? ids : [FAKE_ID])

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  // Auth
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const service = createServiceSupabase()

  // ── 1. Produits actifs + gouvernance ──────────────────────────────────────
  const { data: rows, error } = await service
    .from('produits')
    .select(`
      id, nom, societe_gestion, categorie_reglementaire, sri,
      produits_gouvernance(
        id, statut_conformite, statut_validation,
        source_marche_cible, modele_ia, date_analyse_ia, score_confiance_ia,
        mc_pos_connaissance, mc_pos_experience, mc_pos_capacite_pertes,
        mc_pos_tolerance_risque, mc_pos_horizon, mc_pos_sensibilite_esg,
        mc_neg_connaissance, mc_neg_experience, mc_neg_capacite_pertes,
        mc_neg_tolerance_risque, mc_neg_horizon, mc_neg_sensibilite_esg,
        date_derniere_revue, date_prochaine_revue, alerte_revue
      )
    `)
    .eq('actif', true)
    .order('nom')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Intermédaire avant enrichissement documents
  type ProduitBase = Omit<ProduitCatPdf, 'documents' | 'version_prompt'>
  const produitsBase: ProduitBase[] = ((rows ?? []) as unknown as RowRaw[]).map(r => ({
    id:                      r.id,
    nom:                     r.nom,
    societe_gestion:         r.societe_gestion,
    categorie_reglementaire: r.categorie_reglementaire,
    sri:                     r.sri,
    gouvernance:             r.produits_gouvernance ?? null,
  }))

  const produitIds     = produitsBase.map(p => p.id)
  const gouvernanceIds = produitsBase
    .map(p => p.gouvernance?.id)
    .filter((id): id is string => !!id)

  // ── 2. Documents et extraits en parallèle ─────────────────────────────────
  const [docResult, extraitResult] = await Promise.all([
    service
      .from('produits_documents')
      .select('produit_id, type, date_document')
      .in('produit_id', safe(produitIds))
      .order('date_document', { ascending: false }),
    service
      .from('documents_extraits')
      .select('gouvernance_id, version_prompt')
      .in('gouvernance_id', safe(gouvernanceIds))
      .order('date_analyse_ia', { ascending: false }),
  ])

  const docRows:     DocRow[]     = ((docResult.data    ?? []) as unknown as DocRow[])
  const extraitRows: ExtraitRow[] = ((extraitResult.data ?? []) as unknown as ExtraitRow[])

  // ── 3. Maps d'enrichissement ──────────────────────────────────────────────

  // produit_id → DocumentGPdf[]
  const docsMap = new Map<string, DocumentGPdf[]>()
  for (const d of docRows) {
    const arr = docsMap.get(d.produit_id) ?? []
    arr.push({ type: d.type, date_document: d.date_document })
    docsMap.set(d.produit_id, arr)
  }

  // gouvernance_id → version_prompt (première entrée = plus récente)
  const vpMap = new Map<string, string | null>()
  for (const e of extraitRows) {
    if (!vpMap.has(e.gouvernance_id)) {
      vpMap.set(e.gouvernance_id, e.version_prompt)
    }
  }

  // ── 4. Produits enrichis ──────────────────────────────────────────────────
  const produits: ProduitCatPdf[] = produitsBase.map(p => ({
    ...p,
    documents:      docsMap.get(p.id) ?? [],
    version_prompt: p.gouvernance?.id ? (vpMap.get(p.gouvernance.id) ?? null) : null,
  }))

  // ── 5. Groupement par catégorie ───────────────────────────────────────────
  const categories: CatSectionData[] = []

  for (const group of GROUPS) {
    const groupProduits = produits.filter(p => {
      if (p.categorie_reglementaire === null) return group.includeNull
      return group.catKeys.includes(p.categorie_reglementaire)
    })
    if (groupProduits.length === 0) continue

    const obj = OBJECTIVES[group.key]
    categories.push({
      label:                  group.label,
      objectifsCompatibles:   obj.compatible,
      objectifsIncompatibles: obj.incompatible,
      produits:               groupProduits,
    })
  }

  if (categories.length === 0) {
    return NextResponse.json(
      { error: 'Aucun produit actif référencé dans le catalogue.' },
      { status: 404 },
    )
  }

  const pdfData: GouvernanceProduitsData = {
    categories,
    generatedAt: new Date().toISOString(),
  }

  try {
    const element = React.createElement(GouvernanceProduitsDocument, { data: pdfData })
    const buffer  = await renderToBuffer(element as React.ReactElement<DocumentProps>)
    const date    = new Date().toISOString().slice(0, 10)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="gouvernance-produits-${date}.pdf"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (e) {
    console.error('[pdf/gouvernance-produits]', e)
    return NextResponse.json(
      { error: `Erreur génération PDF : ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
