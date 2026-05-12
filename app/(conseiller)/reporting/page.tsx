import { createServerSupabase, logAccess } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, statusBadge,
} from '@/lib/design-tokens'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function pct(n: number, total: number) {
  if (!total) return '0 %'
  return `${Math.round((n / total) * 100)} %`
}

interface ClientRow { id: string; statut: string; kyc_status: string; profil: string | null; encours: number; created_at: string }
interface AccessLogRow { action: string; created_at: string }

export default async function ReportingPage() {
  const supabase = await createServerSupabase()
  await logAccess('reporting_view')

  const [clientsRes, docsRes, relancesRes, logsRes, actifsRes] = await Promise.all([
    supabase.from('clients').select('id, statut, kyc_status, profil, encours, created_at').order('created_at'),
    supabase.from('documents_reglementaires').select('type, created_at').order('created_at'),
    supabase.from('relances').select('statut, type, created_at').order('created_at'),
    supabase.from('access_logs').select('action, created_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('actifs_financiers').select('nature, montant'),
  ])

  const clients = (clientsRes.data ?? []) as ClientRow[]
  const docs = docsRes.data ?? []
  const relances = relancesRes.data ?? []
  const logs = (logsRes.data ?? []) as AccessLogRow[]
  const actifs = actifsRes.data ?? []

  // KPI globaux
  const totalClients = clients.length
  const clientsActifs = clients.filter(c => c.statut === 'client').length
  const prospects = clients.filter(c => c.statut === 'prospect').length
  const totalEncours = clients.reduce((s, c) => s + (c.encours ?? 0), 0)
  const encoursParClient = clientsActifs > 0 ? totalEncours / clientsActifs : 0

  // KYC
  const kycComplets = clients.filter(c => c.kyc_status === 'complet').length
  const kycEnCours = clients.filter(c => c.kyc_status === 'en_cours').length
  const kycAlertes = clients.filter(c => ['non_fait', 'a_renouveler'].includes(c.kyc_status)).length

  // Profils
  const profilCounts: Record<string, number> = { prudent: 0, equilibre: 0, dynamique: 0, agressif: 0 }
  clients.filter(c => c.profil).forEach(c => { if (c.profil) profilCounts[c.profil] = (profilCounts[c.profil] ?? 0) + 1 })

  // Documents
  const docsByType: Record<string, number> = {}
  docs.forEach(d => { docsByType[d.type] = (docsByType[d.type] ?? 0) + 1 })

  // Actifs par nature
  const actifsByNature: Record<string, number> = {}
  actifs.forEach(a => { actifsByNature[a.nature] = (actifsByNature[a.nature] ?? 0) + (a.montant ?? 0) })
  const totalActifs = Object.values(actifsByNature).reduce((s, v) => s + v, 0)

  // Activité récente (30 derniers jours)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentLogs = logs.filter(l => new Date(l.created_at) > thirtyDaysAgo)
  const actionCounts: Record<string, number> = {}
  recentLogs.forEach(l => { actionCounts[l.action] = (actionCounts[l.action] ?? 0) + 1 })
  const topActions = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)

  // Relances
  const relancesEnvoyees = relances.filter(r => r.statut === 'effectuee').length
  const relancesEnAttente = relances.filter(r => r.statut === 'en_attente').length

  const PROFIL_COLORS: Record<string, string> = {
    prudent: colors.success, equilibre: colors.warning,
    dynamique: '#c47a1f', agressif: colors.danger,
  }

  return (
    <div>
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Tableau de bord analytique</span></div>
          <h1 style={s.title}>Reporting cabinet</h1>
        </div>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>
          Au {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date())}
        </p>
      </div>

      {/* KPI ligne 1 */}
      <div style={s.kpiGrid}>
        <KpiCard label="Clients actifs" value={String(clientsActifs)} sub={`${prospects} prospect${prospects > 1 ? 's' : ''}`} color={colors.blue} />
        <KpiCard label="Encours total" value={fmt(totalEncours)} sub="Cumul déclaré" color={colors.gold} />
        <KpiCard label="Encours moyen" value={fmt(encoursParClient)} sub="Par client actif" color={colors.blueDeep} />
        <KpiCard label="KYC complets" value={`${kycComplets}/${clientsActifs}`} sub={`${kycAlertes} alerte${kycAlertes > 1 ? 's' : ''}`} color={kycAlertes > 0 ? colors.warning : colors.success} />
        <KpiCard label="Documents réglementaires" value={String(docs.length)} sub={`${Object.keys(docsByType).length} types`} color={colors.textMid} />
        <KpiCard label="Relances effectuées" value={String(relancesEnvoyees)} sub={`${relancesEnAttente} en attente`} color={colors.blue} />
      </div>

      <div style={s.layout}>
        {/* Colonne gauche */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: spacing[5] }}>

          {/* Répartition des actifs */}
          <div style={{ ...cardBase, ...s.card }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[5] }}>Actifs financiers par classe</h2>
            {Object.keys(actifsByNature).length === 0 ? (
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>Aucun actif saisi dans les fiches clients.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: spacing[3] }}>
                {Object.entries(actifsByNature).sort((a, b) => b[1] - a[1]).map(([nature, total]) => (
                  <BarRow key={nature} label={nature} value={fmt(total)} pct={(totalActifs > 0 ? Math.round((total / totalActifs) * 100) : 0)} color={colors.blue} />
                ))}
                <div style={{ paddingTop: spacing[3], borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.blueDeep }}>Total actifs saisis</p>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.blueDeep }}>{fmt(totalActifs)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Documents réglementaires */}
          <div style={{ ...cardBase, ...s.card }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[5] }}>Documents par type</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[3] }}>
              {['LM', 'DER', 'FICI', 'CRS', 'LAB', 'DICI', 'autre'].map(type => (
                <div key={type} style={{ padding: spacing[4], backgroundColor: colors.bluePale, textAlign: 'center' as const }}>
                  <p style={{ fontFamily: fonts.heading, fontSize: '1.6rem', fontWeight: fontWeights.light, color: colors.blueDeep }}>{docsByType[type] ?? 0}</p>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.wide, color: colors.textMid, textTransform: 'uppercase' as const }}>{type}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Activité récente */}
          <div style={{ ...cardBase, ...s.card }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Activité récente (30 jours)</h2>
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginBottom: spacing[4] }}>{recentLogs.length} actions enregistrées dans les logs d'accès RGPD.</p>
            {topActions.length === 0 ? (
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>Aucune activité récente.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: spacing[2] }}>
                {topActions.map(([action, count]) => (
                  <BarRow key={action} label={action} value={String(count)} pct={Math.round((count / recentLogs.length) * 100)} color={colors.gold} compact />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: spacing[5] }}>

          {/* Répartition KYC */}
          <div style={{ ...cardBase, ...s.card }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Statut KYC</h2>
            {[
              { key: 'complet', label: 'Complets', count: kycComplets, badge: statusBadge.success },
              { key: 'en_cours', label: 'En cours', count: kycEnCours, badge: statusBadge.warning },
              { key: 'alerte', label: 'Alertes', count: kycAlertes, badge: statusBadge.danger },
            ].map(({ key, label, count, badge }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing[3]} 0`, borderBottom: `1px solid ${colors.border}` }}>
                <span style={badge}>{label}</span>
                <div style={{ textAlign: 'right' as const }}>
                  <p style={{ fontFamily: fonts.heading, fontSize: '1.4rem', fontWeight: fontWeights.light, color: colors.blueDeep }}>{count}</p>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight }}>{pct(count, totalClients)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Profils investisseurs */}
          <div style={{ ...cardBase, ...s.card }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Profils investisseurs</h2>
            {Object.entries(profilCounts).map(([profil, count]) => (
              <div key={profil} style={{ display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: PROFIL_COLORS[profil], flexShrink: 0 }} />
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text, flex: 1, textTransform: 'capitalize' as const }}>{profil}</p>
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.blueDeep }}>{count}</p>
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, width: '36px', textAlign: 'right' as const }}>{pct(count, clientsActifs)}</p>
              </div>
            ))}
            {Object.values(profilCounts).every(v => v === 0) && (
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>Aucun profil renseigné.</p>
            )}
          </div>

          {/* Statuts clients */}
          <div style={{ ...cardBase, ...s.card }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Statuts clients</h2>
            {(['prospect', 'client', 'inactif', 'archive'] as const).map(statut => {
              const count = clients.filter(c => c.statut === statut).length
              const badges: Record<string, React.CSSProperties> = { prospect: statusBadge.info, client: statusBadge.success, inactif: statusBadge.neutral, archive: statusBadge.neutral }
              return (
                <div key={statut} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}` }}>
                  <span style={badges[statut]}>{statut}</span>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.blueDeep }}>{count}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ ...cardBase, padding: spacing[5], boxShadow: shadows.sm, borderTop: `2px solid ${color}` }}>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.label, textTransform: 'uppercase' as const, color: colors.textMid, marginBottom: spacing[2] }}>{label}</p>
      <p style={{ fontFamily: fonts.heading, fontSize: '1.6rem', fontWeight: fontWeights.light, color: colors.blueDeep, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: spacing[1] }}>{sub}</p>
    </div>
  )
}

function BarRow({ label, value, pct, color, compact }: { label: string; value: string; pct: number; color: string; compact?: boolean }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <p style={{ fontFamily: fonts.body, fontSize: compact ? fontSizes.xs : fontSizes.sm, color: colors.text, fontWeight: compact ? fontWeights.regular : fontWeights.medium }}>{label}</p>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>{value}</p>
      </div>
      <div style={{ height: compact ? '3px' : '6px', backgroundColor: colors.bluePale }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

const s = {
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing[8] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: { fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)', fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: spacing[4], marginBottom: spacing[6] },
  layout: { display: 'flex', gap: spacing[6], alignItems: 'flex-start' },
  card: { padding: spacing[6], boxShadow: shadows.sm } as React.CSSProperties,
  cardTitle: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep, letterSpacing: letterSpacings.wide },
}
