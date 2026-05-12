import { createServerSupabase } from '@/lib/supabase'
import { logAccess } from '@/lib/supabase'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, tableHeaderCell, tableCell,
  statusBadge, sectionLabel, buttonPrimary,
} from '@/lib/design-tokens'
import RelanceButton from './_components/RelanceButton'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
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

export default async function ConformitePage() {
  const supabase = await createServerSupabase()
  await logAccess('conformite_view')

  const [clientsRes, dossiersRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, nom, prenom, email, statut, kyc_status, kyc_submitted_at, derniere_relance, encours, profil')
      .in('statut', ['prospect', 'client'])
      .order('nom'),
    supabase
      .from('documents_reglementaires')
      .select('client_id, type, date_realisation'),
  ])

  const clients = clientsRes.data ?? []
  const docs = dossiersRes.data ?? []

  // Grouper les docs par client
  const docsByClient: Record<string, string[]> = {}
  docs.forEach(d => {
    if (!docsByClient[d.client_id]) docsByClient[d.client_id] = []
    docsByClient[d.client_id].push(d.type)
  })

  const kycAlertes = clients.filter(c => ['non_fait', 'a_renouveler'].includes(c.kyc_status) && c.statut === 'client')
  const kycEnCours = clients.filter(c => c.kyc_status === 'en_cours')
  const kycComplets = clients.filter(c => c.kyc_status === 'complet')
  const prospects = clients.filter(c => c.statut === 'prospect' && c.kyc_status !== 'complet')

  return (
    <div>
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Réglementation AMF/ACPR</span></div>
          <h1 style={s.title}>Conformité KYC</h1>
        </div>
      </div>

      {/* KPI */}
      <div style={s.kpiGrid}>
        <KpiCard label="Alertes KYC" value={kycAlertes.length} color={kycAlertes.length > 0 ? colors.danger : colors.success} />
        <KpiCard label="En cours" value={kycEnCours.length} color={colors.warning} />
        <KpiCard label="KYC complets" value={kycComplets.length} color={colors.success} />
        <KpiCard label="Prospects sans KYC" value={prospects.length} color={colors.blue} />
      </div>

      {/* Alertes prioritaires */}
      {kycAlertes.length > 0 && (
        <div style={{ ...cardBase, ...s.tableCard, marginBottom: spacing[6] }}>
          <div style={s.tableHeader}>
            <h2 style={s.tableTitle}>🔴 Alertes prioritaires — KYC à traiter</h2>
            <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger }}>
              {kycAlertes.length} client{kycAlertes.length > 1 ? 's' : ''} concerné{kycAlertes.length > 1 ? 's' : ''}
            </span>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={tableHeaderCell}>Client</th>
                <th style={tableHeaderCell}>Email</th>
                <th style={tableHeaderCell}>État KYC</th>
                <th style={tableHeaderCell}>KYC soumis le</th>
                <th style={tableHeaderCell}>Dernière relance</th>
                <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {kycAlertes.map(c => {
                const days = daysSince(c.derniere_relance)
                const urgentRelance = !c.derniere_relance || (days !== null && days > 14)
                return (
                  <tr key={c.id} style={s.tableRow}>
                    <td style={tableCell}>
                      <Link href={`/clients/${c.id}`} style={s.clientLink}>
                        {c.prenom} {c.nom}
                      </Link>
                    </td>
                    <td style={{ ...tableCell, color: colors.textMid }}>{c.email ?? '—'}</td>
                    <td style={tableCell}><span style={KYC_STYLE[c.kyc_status]}>{KYC_LABELS[c.kyc_status]}</span></td>
                    <td style={{ ...tableCell, color: colors.textMid }}>{formatDate(c.kyc_submitted_at)}</td>
                    <td style={tableCell}>
                      <span style={{ color: urgentRelance ? colors.danger : colors.textMid, fontFamily: fonts.body, fontSize: fontSizes.sm }}>
                        {c.derniere_relance ? `Il y a ${days} j` : '—'}
                      </span>
                    </td>
                    <td style={{ ...tableCell, textAlign: 'right' }}>
                      <RelanceButton clientId={c.id} email={c.email} type={c.kyc_status === 'a_renouveler' ? 'kyc_renouvellement' : 'kyc_initial'} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tableau complet */}
      <div style={{ ...cardBase, ...s.tableCard }}>
        <div style={s.tableHeader}>
          <h2 style={s.tableTitle}>Suivi KYC — Tous les clients</h2>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={tableHeaderCell}>Client</th>
              <th style={tableHeaderCell}>Statut</th>
              <th style={tableHeaderCell}>KYC</th>
              <th style={tableHeaderCell}>Soumis le</th>
              <th style={tableHeaderCell}>LM</th>
              <th style={tableHeaderCell}>DER</th>
              <th style={tableHeaderCell}>FICI</th>
              <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Relance</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => {
              const clientDocs = docsByClient[c.id] ?? []
              const hasLM = clientDocs.includes('LM')
              const hasDER = clientDocs.includes('DER')
              const hasFICI = clientDocs.includes('FICI')
              return (
                <tr key={c.id} style={s.tableRow}>
                  <td style={tableCell}>
                    <Link href={`/clients/${c.id}`} style={s.clientLink}>
                      {c.prenom} {c.nom}
                    </Link>
                  </td>
                  <td style={tableCell}>
                    <span style={c.statut === 'client' ? statusBadge.success : statusBadge.info}>
                      {c.statut}
                    </span>
                  </td>
                  <td style={tableCell}><span style={KYC_STYLE[c.kyc_status]}>{KYC_LABELS[c.kyc_status]}</span></td>
                  <td style={{ ...tableCell, color: colors.textMid }}>{formatDate(c.kyc_submitted_at)}</td>
                  <td style={tableCell}><DocBadge ok={hasLM} label="LM" /></td>
                  <td style={tableCell}><DocBadge ok={hasDER} label="DER" /></td>
                  <td style={tableCell}><DocBadge ok={hasFICI} label="FICI" /></td>
                  <td style={{ ...tableCell, textAlign: 'right' }}>
                    {c.email && c.kyc_status !== 'complet' && (
                      <RelanceButton clientId={c.id} email={c.email} type={c.kyc_status === 'a_renouveler' ? 'kyc_renouvellement' : 'kyc_initial'} compact />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...cardBase, ...s.kpiCard }}>
      <div style={{ ...s.kpiAccent, backgroundColor: color }} />
      <p style={s.kpiLabel}>{label}</p>
      <p style={{ ...s.kpiValue, color }}>{value}</p>
    </div>
  )
}

function DocBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      fontFamily: fonts.body,
      fontSize: '0.6rem',
      fontWeight: fontWeights.bold,
      letterSpacing: '0.08em',
      padding: '2px 8px',
      backgroundColor: ok ? colors.successBg : colors.offWhite,
      color: ok ? colors.success : colors.textLight,
      border: `1px solid ${ok ? colors.successBorder : colors.border}`,
    }}>
      {ok ? '✓' : '—'} {label}
    </span>
  )
}

const s = {
  pageHeader: { marginBottom: spacing[8] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading,
    fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: '-0.01em',
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
    boxShadow: shadows.sm,
  } as React.CSSProperties,
  kpiAccent: { position: 'absolute' as const, top: 0, left: 0, right: 0, height: '3px' },
  kpiLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  kpiValue: {
    fontFamily: fonts.heading,
    fontSize: '2rem',
    fontWeight: fontWeights.light,
    lineHeight: 1,
  },
  tableCard: { boxShadow: shadows.sm, overflow: 'hidden' } as React.CSSProperties,
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
  table: { width: '100%', borderCollapse: 'collapse' as const },
  tableRow: { transition: 'background 0.15s' } as React.CSSProperties,
  clientLink: {
    color: colors.text,
    textDecoration: 'none',
    fontWeight: fontWeights.medium,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
  } as React.CSSProperties,
}
