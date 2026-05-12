import { createServerSupabase, logAccess } from '@/lib/supabase'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, statusBadge,
} from '@/lib/design-tokens'

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

interface ActifRow {
  nature: string
  montant: number | null
  client_id: string
}

interface ClientRow {
  id: string
  nom: string
  prenom: string
  encours: number
  profil: string | null
}

interface AggregatedActif {
  nature: string
  total: number
  count: number
}

export default async function PortefeuillesPage() {
  const supabase = await createServerSupabase()
  await logAccess('portefeuilles_view')

  const [clientsRes, actifsRes] = await Promise.all([
    supabase.from('clients').select('id, nom, prenom, encours, profil').eq('statut', 'client').order('encours', { ascending: false }),
    supabase.from('actifs_financiers').select('nature, montant, client_id'),
  ])

  const clients = (clientsRes.data ?? []) as ClientRow[]
  const actifs = (actifsRes.data ?? []) as ActifRow[]

  // Agrégation par nature
  const byNature: Record<string, AggregatedActif> = {}
  actifs.forEach(a => {
    if (!byNature[a.nature]) byNature[a.nature] = { nature: a.nature, total: 0, count: 0 }
    byNature[a.nature].total += a.montant ?? 0
    byNature[a.nature].count += 1
  })
  const natures = Object.values(byNature).sort((a, b) => b.total - a.total)

  const totalEncours = clients.reduce((s, c) => s + (c.encours ?? 0), 0)
  const totalActifsAll = actifs.reduce((s, a) => s + (a.montant ?? 0), 0)

  // Encours par client (depuis actifs_financiers)
  const encoursByClient: Record<string, number> = {}
  actifs.forEach(a => {
    encoursByClient[a.client_id] = (encoursByClient[a.client_id] ?? 0) + (a.montant ?? 0)
  })

  const PROFIL_COLORS: Record<string, string> = {
    prudent: colors.success, equilibre: colors.warning,
    dynamique: '#c47a1f', agressif: colors.danger,
  }
  const PROFIL_BADGE: Record<string, React.CSSProperties> = {
    prudent: statusBadge.success, equilibre: statusBadge.warning,
    dynamique: { ...statusBadge.warning, color: '#c47a1f' }, agressif: statusBadge.danger,
  }

  return (
    <div>
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Vue consolidée</span></div>
          <h1 style={s.title}>Portefeuilles clients</h1>
        </div>
        <div style={{ display: 'flex', gap: spacing[4] }}>
          <KpiChip label="Clients gérés" value={String(clients.length)} />
          <KpiChip label="Encours total" value={fmt(totalEncours)} highlight />
        </div>
      </div>

      <div style={s.layout}>
        {/* Colonne gauche — tableau clients */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...cardBase, boxShadow: shadows.sm, overflow: 'hidden' } as React.CSSProperties}>
            <div style={s.tableHead}>
              <h2 style={s.cardTitle}>Répartition par client</h2>
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  <TH>Client</TH>
                  <TH>Profil</TH>
                  <TH right>Encours déclaré</TH>
                  <TH right>Actifs saisis</TH>
                  <TH />
                </tr>
              </thead>
              <tbody>
                {clients.map(c => {
                  const pct = totalEncours > 0 ? ((c.encours / totalEncours) * 100).toFixed(1) : '0'
                  const actifsSaisis = encoursByClient[c.id] ?? 0
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }}>
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
                          <div style={s.avatar}>{c.prenom[0]}{c.nom[0]}</div>
                          <div>
                            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.text }}>{c.prenom} {c.nom}</p>
                            <div style={s.progressMini}>
                              <div style={{ ...s.progressFill, width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        {c.profil
                          ? <span style={PROFIL_BADGE[c.profil] ?? statusBadge.neutral}>{c.profil}</span>
                          : <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>—</span>}
                      </TD>
                      <TD right>
                        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.blueDeep }}>{fmt(c.encours)}</p>
                        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight }}>{pct} %</p>
                      </TD>
                      <TD right>
                        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: actifsSaisis > 0 ? colors.text : colors.textLight }}>
                          {actifsSaisis > 0 ? fmt(actifsSaisis) : '—'}
                        </p>
                      </TD>
                      <TD>
                        <Link href={`/clients/${c.id}/patrimoine`} style={s.viewLink}>Voir →</Link>
                      </TD>
                    </tr>
                  )
                })}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: spacing[8], textAlign: 'center', fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>
                      Aucun client actif dans la base.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Colonne droite — répartition par nature */}
        <div style={{ width: '320px', flexShrink: 0 }}>
          <div style={{ ...cardBase, ...s.sideCard }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[5] }}>Répartition par classe</h2>
            {natures.length === 0 ? (
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>Aucun actif saisi.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: spacing[3] }}>
                {natures.map(n => {
                  const pct = totalActifsAll > 0 ? Math.round((n.total / totalActifsAll) * 100) : 0
                  return (
                    <div key={n.nature}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[1] }}>
                        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.text }}>{n.nature}</p>
                        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>{pct} %</p>
                      </div>
                      <div style={{ height: '6px', backgroundColor: colors.bluePale }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: colors.blue, transition: 'width 0.4s ease' }} />
                      </div>
                      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: '2px' }}>
                        {fmt(n.total)} — {n.count} contrat{n.count > 1 ? 's' : ''}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ marginTop: spacing[6], paddingTop: spacing[4], borderTop: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.blueDeep }}>Total actifs saisis</p>
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.blueDeep }}>{fmt(totalActifsAll)}</p>
              </div>
            </div>
          </div>

          {/* Répartition par profil */}
          <div style={{ ...cardBase, ...s.sideCard, marginTop: spacing[5] }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Répartition par profil</h2>
            {(['prudent', 'equilibre', 'dynamique', 'agressif'] as const).map(profil => {
              const count = clients.filter(c => c.profil === profil).length
              const pct = clients.length > 0 ? Math.round((count / clients.length) * 100) : 0
              return (
                <div key={profil} style={{ display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: PROFIL_COLORS[profil], flexShrink: 0 }} />
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text, flex: 1, textTransform: 'capitalize' as const }}>{profil}</p>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>{count} client{count > 1 ? 's' : ''}</p>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, width: '36px', textAlign: 'right' as const }}>{pct} %</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'right' as const }}>
      <p style={{ fontFamily: fonts.heading, fontSize: '1.8rem', fontWeight: fontWeights.light, color: highlight ? colors.gold : colors.blueDeep, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, letterSpacing: letterSpacings.wide, textTransform: 'uppercase' as const, marginTop: '2px' }}>{label}</p>
    </div>
  )
}

const TH = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const, color: colors.blueDeep, backgroundColor: colors.bluePale, padding: `${spacing[2]} ${spacing[4]}`, textAlign: right ? 'right' : 'left', borderBottom: `2px solid ${colors.blueLight}`, whiteSpace: 'nowrap' as const }}>{children}</th>
)

const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td style={{ padding: `${spacing[3]} ${spacing[4]}`, borderBottom: `1px solid ${colors.border}`, textAlign: right ? 'right' : 'left', verticalAlign: 'middle' }}>{children}</td>
)

const s = {
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing[8] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: { fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)', fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em' },
  layout: { display: 'flex', gap: spacing[6], alignItems: 'flex-start' },
  tableHead: { padding: `${spacing[4]} ${spacing[5]}`, borderBottom: `1px solid ${colors.border}` },
  cardTitle: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep, letterSpacing: letterSpacings.wide },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  avatar: {
    width: '34px', height: '34px', borderRadius: '50%',
    backgroundColor: colors.blueDeep, color: colors.white,
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  progressMini: { height: '3px', width: '80px', backgroundColor: colors.bluePale, marginTop: '4px' },
  progressFill: { height: '100%', backgroundColor: colors.blue },
  viewLink: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue, textDecoration: 'none', fontWeight: fontWeights.medium },
  sideCard: { padding: spacing[5], boxShadow: shadows.sm } as React.CSSProperties,
}
