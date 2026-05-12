import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase, logAccess } from '@/lib/supabase'
import type { Produit, ProduitDocument } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, statusBadge,
} from '@/lib/design-tokens'
import { GenerateDescriptionButton } from './_components/GenerateDescriptionButton'

// Grille DDA standard selon catégorie + SRI
function ddaProfile(p: Produit) {
  const sriLevel = p.sri ?? 0
  return {
    clientType: p.categorie === 'PER' ? 'Grand public' : sriLevel <= 3 ? 'Grand public' : sriLevel <= 5 ? 'Investisseur averti' : 'Investisseur professionnel',
    connaissance: sriLevel <= 2 ? 'Basique' : sriLevel <= 4 ? 'Informé' : 'Avancé',
    capacitePerte: sriLevel <= 2 ? 'Aucune perte' : sriLevel <= 4 ? 'Perte partielle acceptable' : 'Perte totale possible',
    objectifs: p.categorie === 'PER' ? 'Retraite / Préparation long terme'
      : p.categorie === 'SCPI' ? 'Revenu régulier / Diversification immobilière'
      : p.categorie === 'AV' ? 'Croissance / Transmission / Épargne'
      : 'Croissance / Optimisation fiscale',
    horizon: p.categorie === 'PER' ? '> 15 ans' : sriLevel <= 3 ? '3 à 8 ans' : sriLevel <= 5 ? '5 à 10 ans' : '> 8 ans',
    sriRange: p.categorie === 'AV' ? '1 à 7 selon UC' : p.categorie === 'SCPI' ? '3 à 5' : p.categorie === 'PER' ? '1 à 7' : '1 à 5',
  }
}

function SriBar({ sri }: { sri: number | null }) {
  if (!sri) return <span style={{ color: colors.textLight, fontSize: fontSizes.sm }}>Non défini</span>
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1,2,3,4,5,6,7].map(n => (
        <div key={n} style={{
          width: '18px', height: '18px',
          backgroundColor: n <= sri
            ? (sri <= 2 ? colors.success : sri <= 4 ? colors.warning : colors.danger)
            : colors.bluePale,
        }} />
      ))}
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, marginLeft: spacing[2] }}>
        SRI {sri}/7
      </span>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...cardBase, padding: spacing[5], boxShadow: shadows.sm }}>
      <p style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
        letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const,
        color: colors.textMid, marginBottom: spacing[2],
      }}>{label}</p>
      <p style={{
        fontFamily: fonts.heading, fontSize: '2rem', fontWeight: fontWeights.light,
        color: colors.blueDeep, lineHeight: 1,
      }}>{value}</p>
      {sub && <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: spacing[1] }}>{sub}</p>}
    </div>
  )
}

function DdaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[4], padding: `${spacing[3]} 0`, borderBottom: `1px solid ${colors.border}` }}>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.wide, textTransform: 'uppercase' as const, color: colors.textMid, flex: '0 0 220px' }}>{label}</p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, flex: 1 }}>{value}</p>
    </div>
  )
}

const DOC_TYPE_LABELS: Record<string, string> = {
  DICI: 'Document d\'information clé',
  Brochure: 'Brochure commerciale',
  Rapport: 'Rapport annuel',
  Autre: 'Document',
}

export default async function CatalogueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  await logAccess('catalogue_produit_view', `produit:${id}`)

  const [produitRes, docsRes] = await Promise.all([
    supabase.from('produits').select('*').eq('id', id).single(),
    supabase.from('produits_documents').select('*').eq('produit_id', id).order('date_document', { ascending: false }),
  ])

  if (produitRes.error || !produitRes.data) notFound()
  const produit = produitRes.data as Produit
  const docs = (docsRes.data ?? []) as ProduitDocument[]
  const dda = ddaProfile(produit)

  return (
    <div>
      {/* Fil d'Ariane */}
      <div style={s.breadcrumb}>
        <Link href="/catalogue" style={s.breadLink}>← Catalogue</Link>
        <span style={s.breadSep}>/</span>
        <span style={s.breadCurrent}>{produit.nom}</span>
      </div>

      {/* En-tête */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>{produit.categorie}</span></div>
          <h1 style={s.title}>{produit.nom}</h1>
          {produit.societe_gestion && (
            <p style={s.societe}>{produit.societe_gestion}</p>
          )}
          <div style={{ marginTop: spacing[4] }}>
            <SriBar sri={produit.sri} />
          </div>
        </div>
        <div style={s.headerRight}>
          <span style={statusBadge.info}>{produit.categorie}</span>
          {produit.dici_url && (
            <a href={produit.dici_url} target="_blank" rel="noopener noreferrer" style={s.diciLink}>
              DICI ↗
            </a>
          )}
        </div>
      </div>

      {/* Performance */}
      <div style={s.statsGrid}>
        <StatCard
          label="Rendement N-1"
          value={produit.rendement_n1 !== null ? `${produit.rendement_n1} %` : '—'}
          sub="Performance année précédente"
        />
        <StatCard
          label="Rendement 3 ans annualisé"
          value={produit.rendement_3ans !== null ? `${produit.rendement_3ans} %` : '—'}
          sub="Moyenne annuelle sur 3 ans"
        />
        <StatCard
          label="Ratio de Sharpe 3 ans"
          value={produit.ratio_sharpe_3ans !== null ? produit.ratio_sharpe_3ans.toFixed(2) : '—'}
          sub="Rendement ajusté du risque"
        />
      </div>

      <div style={s.twoCol}>
        {/* Colonne gauche */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: spacing[5] }}>

          {/* Présentation IA */}
          <div style={{ ...cardBase, ...s.card }}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>Présentation</h2>
              <GenerateDescriptionButton produitId={produit.id} hasDescription={!!produit.description_ia} />
            </div>
            {produit.description_ia ? (
              <div style={s.descriptionText}>
                {produit.description_ia.split('\n\n').map((para, i) => (
                  <p key={i} style={{ marginBottom: i < produit.description_ia!.split('\n\n').length - 1 ? spacing[4] : 0 }}>
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <div style={s.emptyDesc}>
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textLight, fontStyle: 'italic' }}>
                  Aucune description générée. Cliquez sur « Générer la fiche IA » pour créer automatiquement une présentation de ce produit.
                </p>
              </div>
            )}
          </div>

          {/* Commentaire SRI */}
          {produit.commentaire_sri_ia && (
            <div style={{ ...cardBase, ...s.card, borderLeft: `3px solid ${colors.gold}` }}>
              <h2 style={{ ...s.cardTitle, marginBottom: spacing[3] }}>Commentaire SRI</h2>
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, lineHeight: 1.7 }}>
                {produit.commentaire_sri_ia}
              </p>
            </div>
          )}

          {/* Documents */}
          <div style={{ ...cardBase, ...s.card }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Documents</h2>
            {docs.length === 0 ? (
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>
                Aucun document référencé.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: spacing[3] }}>
                {docs.map(doc => (
                  <div key={doc.id} style={s.docRow}>
                    <div style={s.docInfo}>
                      <p style={s.docType}>{DOC_TYPE_LABELS[doc.type] ?? doc.type}</p>
                      {doc.date_document && (
                        <p style={s.docDate}>{new Intl.DateTimeFormat('fr-FR').format(new Date(doc.date_document))}</p>
                      )}
                    </div>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" style={s.docLink}>
                      Ouvrir ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite — DDA */}
        <div style={{ width: '360px', flexShrink: 0 }}>
          <div style={{ ...cardBase, ...s.card }}>
            <div style={s.ddaHeader}>
              <h2 style={s.cardTitle}>Marché cible DDA</h2>
              <span style={{ ...statusBadge.neutral, fontSize: fontSizes.xs }}>MIF2 / IDD</span>
            </div>
            <p style={s.ddaNote}>
              Profil indicatif basé sur la catégorie et le SRI. À compléter selon la fiche DDA de la société de gestion.
            </p>
            <div style={{ marginTop: spacing[3] }}>
              <DdaRow label="Type de client" value={dda.clientType} />
              <DdaRow label="Connaissances" value={dda.connaissance} />
              <DdaRow label="Capacité à supporter des pertes" value={dda.capacitePerte} />
              <DdaRow label="Objectifs & besoins" value={dda.objectifs} />
              <DdaRow label="Horizon recommandé" value={dda.horizon} />
              <DdaRow label="Plage SRI indicative" value={dda.sriRange} />
            </div>
          </div>

          {/* Infos administratives */}
          <div style={{ ...cardBase, ...s.card, marginTop: spacing[5] }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Informations</h2>
            <InfoLine label="Référencé le" value={new Intl.DateTimeFormat('fr-FR').format(new Date(produit.created_at))} />
            <InfoLine label="Mis à jour le" value={new Intl.DateTimeFormat('fr-FR').format(new Date(produit.updated_at))} />
            <InfoLine label="Statut" value={produit.actif ? 'Actif au catalogue' : 'Inactif'} />
            {produit.dici_url && (
              <div style={{ marginTop: spacing[4] }}>
                <a href={produit.dici_url} target="_blank" rel="noopener noreferrer" style={s.diciFullLink}>
                  Accéder au DICI officiel ↗
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}` }}>
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.wide, textTransform: 'uppercase' as const }}>{label}</span>
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text }}>{value}</span>
    </div>
  )
}

const s = {
  breadcrumb: { display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[6] },
  breadLink: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue, textDecoration: 'none' },
  breadSep: { color: colors.textLight, fontSize: fontSizes.sm },
  breadCurrent: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacing[8], gap: spacing[6],
  },
  headerLeft: { flex: 1 },
  headerRight: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: spacing[3] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.8rem)',
    fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em',
    marginBottom: spacing[2],
  },
  societe: {
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid, fontWeight: fontWeights.light,
  },
  diciLink: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue,
    textDecoration: 'none', fontWeight: fontWeights.medium,
    border: `1px solid ${colors.infoBorder}`, padding: `${spacing[2]} ${spacing[4]}`,
  },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[5],
    marginBottom: spacing[6],
  },
  twoCol: { display: 'flex', gap: spacing[5], alignItems: 'flex-start' },
  card: { padding: spacing[6], boxShadow: shadows.sm, marginBottom: 0 } as React.CSSProperties,
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[5] },
  cardTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep, letterSpacing: letterSpacings.wide,
  },
  descriptionText: {
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, lineHeight: 1.8,
  },
  emptyDesc: {
    padding: spacing[6],
    backgroundColor: colors.offWhite,
    border: `1px dashed ${colors.border}`,
    textAlign: 'center' as const,
  },
  docRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `${spacing[3]} 0`, borderBottom: `1px solid ${colors.border}`,
  },
  docInfo: {},
  docType: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.text },
  docDate: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px' },
  docLink: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue,
    textDecoration: 'none', fontWeight: fontWeights.medium,
  },
  ddaHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  ddaNote: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight,
    lineHeight: 1.6, fontStyle: 'italic',
  },
  diciFullLink: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue,
    textDecoration: 'none', fontWeight: fontWeights.medium, display: 'block',
    textAlign: 'center' as const, padding: `${spacing[3]} 0`,
    border: `1px solid ${colors.infoBorder}`,
  },
}
