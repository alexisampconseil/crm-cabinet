import { createServerSupabase } from '@/lib/supabase'
import { logAccess } from '@/lib/supabase'
import Link from 'next/link'
import type { Produit } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, statusBadge,
} from '@/lib/design-tokens'

const CATEGORIES: { key: Produit['categorie']; label: string; desc: string }[] = [
  { key: 'AV', label: 'Assurance-vie', desc: 'Fonds euros & unités de compte' },
  { key: 'SCPI', label: 'SCPI', desc: 'Immobilier pierre-papier' },
  { key: 'PER', label: 'PER', desc: 'Plan Épargne Retraite' },
  { key: 'Capitalisation', label: 'Capitalisation', desc: 'Contrats de capitalisation' },
]

function SriBar({ sri }: { sri: number | null }) {
  if (!sri) return <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>—</span>
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[1,2,3,4,5,6,7].map(n => (
        <div key={n} style={{
          width: '14px', height: '14px',
          backgroundColor: n <= sri
            ? (sri <= 2 ? colors.success : sri <= 4 ? colors.warning : colors.danger)
            : colors.bluePale,
          transition: 'background 0.2s',
        }} />
      ))}
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginLeft: '6px' }}>SRI {sri}/7</span>
    </div>
  )
}

export default async function CataloguePage() {
  const supabase = await createServerSupabase()
  await logAccess('catalogue_view')

  const { data: produits } = await supabase
    .from('produits')
    .select('*')
    .eq('actif', true)
    .order('nom')

  const all = (produits ?? []) as Produit[]

  const byCategorie: Record<string, Produit[]> = {}
  CATEGORIES.forEach(c => { byCategorie[c.key] = all.filter(p => p.categorie === c.key) })

  return (
    <div>
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Architecture ouverte</span></div>
          <h1 style={s.title}>Catalogue produits</h1>
        </div>
        <div style={s.totalBadge}>
          <span style={s.totalNum}>{all.length}</span>
          <span style={s.totalLabel}>produits référencés</span>
        </div>
      </div>

      {CATEGORIES.map(cat => {
        const prods = byCategorie[cat.key]
        return (
          <div key={cat.key} style={s.section}>
            <div style={s.sectionHeader}>
              <div>
                <p style={s.catLabel}>{cat.label}</p>
                <p style={s.catDesc}>{cat.desc}</p>
              </div>
              <span style={{ ...statusBadge.info, padding: '3px 12px' }}>{prods.length} produit{prods.length !== 1 ? 's' : ''}</span>
            </div>

            {prods.length === 0 ? (
              <p style={s.empty}>Aucun produit référencé dans cette catégorie.</p>
            ) : (
              <div style={s.grid}>
                {prods.map(p => (
                  <Link key={p.id} href={`/catalogue/${p.id}`} style={{ ...cardBase, ...s.card }}>
                    <div style={s.cardTop}>
                      <div>
                        <p style={s.prodNom}>{p.nom}</p>
                        {p.societe_gestion && <p style={s.prodSociete}>{p.societe_gestion}</p>}
                      </div>
                      <span style={{ ...statusBadge.info }}>{p.categorie}</span>
                    </div>
                    <div style={s.cardMid}>
                      <SriBar sri={p.sri} />
                    </div>
                    <div style={s.cardStats}>
                      <Stat label="Rend. N-1" value={p.rendement_n1 ? `${p.rendement_n1} %` : '—'} highlight={p.rendement_n1 !== null && p.rendement_n1 > 0} />
                      <Stat label="Rend. 3 ans" value={p.rendement_3ans ? `${p.rendement_3ans} %` : '—'} />
                      <Stat label="Sharpe 3 ans" value={p.ratio_sharpe_3ans?.toFixed(2) ?? '—'} />
                    </div>
                    <div style={s.cardFooter}>
                      <span style={s.viewLink}>Voir la fiche →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={s.stat}>
      <p style={s.statLabel}>{label}</p>
      <p style={{ ...s.statValue, color: highlight ? colors.success : colors.blueDeep }}>{value}</p>
    </div>
  )
}

const s = {
  pageHeader: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    marginBottom: spacing[8],
  },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em',
  },
  totalBadge: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end',
  },
  totalNum: {
    fontFamily: fonts.heading, fontSize: '2.4rem', fontWeight: fontWeights.light,
    color: colors.blueDeep, lineHeight: 1,
  },
  totalLabel: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid,
    letterSpacing: letterSpacings.wide, textTransform: 'uppercase' as const,
  },
  section: { marginBottom: spacing[8] },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[4],
    paddingBottom: spacing[4],
    borderBottom: `2px solid ${colors.border}`,
  },
  catLabel: {
    fontFamily: fonts.heading, fontSize: '1.4rem', fontWeight: fontWeights.light,
    color: colors.blueDeep, marginBottom: spacing[1],
  },
  catDesc: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, fontWeight: fontWeights.light,
  },
  empty: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic',
    padding: `${spacing[4]} 0`,
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[5],
  },
  card: {
    display: 'flex', flexDirection: 'column' as const, gap: spacing[3],
    padding: spacing[5], boxShadow: shadows.sm,
    textDecoration: 'none', color: 'inherit',
    transition: 'transform 0.2s, box-shadow 0.2s',
  } as React.CSSProperties,
  cardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3],
  },
  prodNom: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep, letterSpacing: letterSpacings.wide,
  },
  prodSociete: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px',
  },
  cardMid: { padding: `${spacing[2]} 0`, borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` },
  cardStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[2] },
  stat: {},
  statLabel: {
    fontFamily: fonts.body, fontSize: '0.6rem', fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const, color: colors.textMid, marginBottom: '2px',
  },
  statValue: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
  },
  cardFooter: { marginTop: 'auto' as const },
  viewLink: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.blue,
    fontWeight: fontWeights.medium, letterSpacing: letterSpacings.wide,
  },
}
