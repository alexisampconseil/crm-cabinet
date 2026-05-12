import { createServerSupabase } from '@/lib/supabase'
import { logAccess } from '@/lib/supabase'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, tableHeaderCell, tableCell,
  statusBadge, sectionLabel, transitions,
} from '@/lib/design-tokens'

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

function formatEuros(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

const KYC_LABELS: Record<string, string> = {
  non_fait: 'Non fait',
  en_cours: 'En cours',
  complet: 'Complet',
  a_renouveler: 'À renouveler',
}

const KYC_STYLE: Record<string, React.CSSProperties> = {
  non_fait: statusBadge.neutral,
  en_cours: statusBadge.warning,
  complet: statusBadge.success,
  a_renouveler: statusBadge.danger,
}

const STATUT_STYLE: Record<string, React.CSSProperties> = {
  prospect: statusBadge.info,
  client: statusBadge.success,
  inactif: statusBadge.neutral,
  archive: statusBadge.neutral,
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  await logAccess('dashboard_view')

  // Requêtes en parallèle
  const [clientsRes, dossiersRes, recentRes, alertesRes] = await Promise.all([
    supabase.from('clients').select('id, statut, encours, kyc_status'),
    supabase.from('dossiers').select('id, statut'),
    supabase
      .from('clients')
      .select('id, nom, prenom, statut, kyc_status, encours, created_at, ville')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('clients')
      .select('id, nom, prenom, kyc_status, derniere_relance, email')
      .in('kyc_status', ['a_renouveler', 'non_fait'])
      .eq('statut', 'client')
      .order('derniere_relance', { ascending: true })
      .limit(8),
  ])

  const clients = clientsRes.data ?? []
  const dossiers = dossiersRes.data ?? []
  const recentClients = recentRes.data ?? []
  const alertesKyc = alertesRes.data ?? []

  const totalClients = clients.filter(c => c.statut === 'client').length
  const totalProspects = clients.filter(c => c.statut === 'prospect').length
  const totalEncours = clients.reduce((acc, c) => acc + (c.encours ?? 0), 0)
  const kycAlertes = clients.filter(c => ['a_renouveler', 'non_fait'].includes(c.kyc_status) && c.statut === 'client').length
  const dossiersEnCours = dossiers.filter(d => d.statut === 'en_cours').length

  return (
    <div>
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div style={s.eyebrow}>
          <div style={s.rule} />
          <span style={s.eyebrowText}>Vue d'ensemble</span>
        </div>
        <h1 style={s.title}>Tableau de bord</h1>
      </div>

      {/* KPI Cards */}
      <div style={s.kpiGrid}>
        <KpiCard label="Clients actifs" value={totalClients.toString()} sub={`${totalProspects} prospect${totalProspects > 1 ? 's' : ''}`} accent={colors.blue} />
        <KpiCard label="Encours total" value={formatEuros(totalEncours)} sub="Actifs sous gestion" accent={colors.gold} />
        <KpiCard label="KYC à traiter" value={kycAlertes.toString()} sub="Renouvellements + manquants" accent={kycAlertes > 0 ? colors.danger : colors.success} />
        <KpiCard label="Dossiers en cours" value={dossiersEnCours.toString()} sub="Opérations actives" accent={colors.blueDeep} />
      </div>

      {/* Tableaux */}
      <div style={s.tablesRow}>
        {/* Derniers clients */}
        <div style={s.tableCard}>
          <div style={s.tableHeader}>
            <h2 style={s.tableTitle}>Derniers clients ajoutés</h2>
            <Link href="/clients" style={s.voirTout}>Voir tous →</Link>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={tableHeaderCell}>Nom</th>
                <th style={tableHeaderCell}>Ville</th>
                <th style={tableHeaderCell}>Statut</th>
                <th style={tableHeaderCell}>KYC</th>
                <th style={tableHeaderCell}>Encours</th>
                <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Depuis</th>
              </tr>
            </thead>
            <tbody>
              {recentClients.map(c => (
                <tr key={c.id} style={s.tableRow}>
                  <td style={tableCell}>
                    <Link href={`/clients/${c.id}`} style={s.clientLink}>
                      <span style={s.avatar}>{(c.prenom[0] + c.nom[0]).toUpperCase()}</span>
                      {c.prenom} {c.nom}
                    </Link>
                  </td>
                  <td style={{ ...tableCell, color: colors.textMid }}>{c.ville ?? '—'}</td>
                  <td style={tableCell}><span style={STATUT_STYLE[c.statut] ?? statusBadge.neutral}>{c.statut}</span></td>
                  <td style={tableCell}><span style={KYC_STYLE[c.kyc_status]}>{KYC_LABELS[c.kyc_status]}</span></td>
                  <td style={tableCell}>{formatEuros(c.encours ?? 0)}</td>
                  <td style={{ ...tableCell, textAlign: 'right', color: colors.textMid }}>{formatDate(c.created_at)}</td>
                </tr>
              ))}
              {recentClients.length === 0 && (
                <tr><td colSpan={6} style={{ ...tableCell, textAlign: 'center', color: colors.textLight }}>Aucun client pour l'instant</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Alertes KYC */}
        <div style={{ ...s.tableCard, flex: '0 0 380px' }}>
          <div style={s.tableHeader}>
            <h2 style={s.tableTitle}>Alertes KYC</h2>
            <Link href="/conformite" style={s.voirTout}>Conformité →</Link>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={tableHeaderCell}>Client</th>
                <th style={tableHeaderCell}>État</th>
                <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Dernière relance</th>
              </tr>
            </thead>
            <tbody>
              {alertesKyc.map(c => (
                <tr key={c.id} style={s.tableRow}>
                  <td style={tableCell}>
                    <Link href={`/clients/${c.id}`} style={s.clientLink}>
                      {c.prenom} {c.nom}
                    </Link>
                  </td>
                  <td style={tableCell}><span style={KYC_STYLE[c.kyc_status]}>{KYC_LABELS[c.kyc_status]}</span></td>
                  <td style={{ ...tableCell, textAlign: 'right', color: colors.textMid }}>{formatDate(c.derniere_relance)}</td>
                </tr>
              ))}
              {alertesKyc.length === 0 && (
                <tr><td colSpan={3} style={{ ...tableCell, textAlign: 'center', color: colors.success }}>✓ Aucune alerte KYC</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ ...cardBase, ...s.kpiCard }}>
      <div style={{ ...s.kpiAccent, backgroundColor: accent }} />
      <p style={s.kpiLabel}>{label}</p>
      <p style={s.kpiValue}>{value}</p>
      <p style={s.kpiSub}>{sub}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  pageHeader: {
    marginBottom: spacing[8],
  },
  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  rule: {
    width: '32px',
    height: '2px',
    backgroundColor: colors.gold,
  },
  eyebrowText: {
    ...sectionLabel,
  } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading,
    fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: spacing[5],
    marginBottom: spacing[8],
  },
  kpiCard: {
    padding: `${spacing[5]} ${spacing[6]}`,
    position: 'relative' as const,
    overflow: 'hidden',
    borderTop: 'none',
    boxShadow: shadows.sm,
  },
  kpiAccent: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
  },
  kpiLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    marginBottom: spacing[2],
    marginTop: spacing[3],
  },
  kpiValue: {
    fontFamily: fonts.heading,
    fontSize: '2rem',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    lineHeight: 1,
    marginBottom: spacing[1],
  },
  kpiSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textLight,
    fontWeight: fontWeights.light,
  },
  tablesRow: {
    display: 'flex',
    gap: spacing[5],
    alignItems: 'flex-start',
  },
  tableCard: {
    ...cardBase,
    flex: 1,
    boxShadow: shadows.sm,
    overflow: 'hidden',
  } as React.CSSProperties,
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[4]} ${spacing[5]}`,
    borderBottom: `1px solid ${colors.border}`,
  },
  tableTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.blueDeep,
    letterSpacing: letterSpacings.wide,
  },
  voirTout: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.blue,
    textDecoration: 'none',
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  tableRow: {
    transition: transitions.fast,
  },
  clientLink: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    color: colors.text,
    textDecoration: 'none',
    fontWeight: fontWeights.medium,
  } as React.CSSProperties,
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: colors.bluePale,
    color: colors.blue,
    fontSize: '0.62rem',
    fontWeight: fontWeights.bold,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
}
