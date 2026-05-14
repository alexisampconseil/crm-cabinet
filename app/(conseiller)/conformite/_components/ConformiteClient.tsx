'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, tableHeaderCell, tableCell, statusBadge,
} from '@/lib/design-tokens'
import RelanceModal from './RelanceModal'

export interface ClientRow {
  id: string
  nom: string
  prenom: string
  email: string | null
  statut: string
  kyc_status: string
  kyc_submitted_at: string | null
  derniere_relance: string | null
  encours: number | null
  profil: string | null
}

export interface DocRow {
  client_id: string
  type: string
  date_realisation: string | null
}

interface Props {
  initialClients: ClientRow[]
  docs: DocRow[]
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

function KycStatusBadge({ clientId, status }: { clientId: string; status: string }) {
  if (status === 'complet') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <span style={statusBadge.success}>Reçu ✓</span>
        <Link
          href={`/clients/${clientId}`}
          style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.blue, textDecoration: 'none', fontWeight: fontWeights.medium }}
        >
          Voir →
        </Link>
      </div>
    )
  }
  if (status === 'en_cours') return <span style={statusBadge.warning}>Envoyé ⏳</span>
  if (status === 'a_renouveler') return <span style={statusBadge.danger}>À renouveler</span>
  return <span style={statusBadge.neutral}>Non envoyé</span>
}

function DocBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      fontFamily: fonts.body, fontSize: '0.6rem', fontWeight: fontWeights.bold,
      letterSpacing: '0.08em', padding: '2px 8px',
      backgroundColor: ok ? colors.successBg : colors.offWhite,
      color: ok ? colors.success : colors.textLight,
      border: `1px solid ${ok ? colors.successBorder : colors.border}`,
    }}>
      {ok ? '✓' : '—'} {label}
    </span>
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

export default function ConformiteClient({ initialClients, docs }: Props) {
  const [clients, setClients] = useState<ClientRow[]>(initialClients)
  const [modalClient, setModalClient] = useState<ClientRow | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const docsByClient = useMemo(() => {
    const map: Record<string, string[]> = {}
    docs.forEach(d => {
      if (!map[d.client_id]) map[d.client_id] = []
      map[d.client_id].push(d.type)
    })
    return map
  }, [docs])

  const kycAlertes = clients.filter(c => ['non_fait', 'a_renouveler'].includes(c.kyc_status) && c.statut === 'client')
  const kycEnCours = clients.filter(c => c.kyc_status === 'en_cours')
  const kycComplets = clients.filter(c => c.kyc_status === 'complet')
  const prospects = clients.filter(c => c.statut === 'prospect' && c.kyc_status !== 'complet')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const handleSendSuccess = (clientId: string) => {
    setClients(prev => prev.map(c =>
      c.id === clientId
        ? { ...c, kyc_status: 'en_cours', derniere_relance: new Date().toISOString() }
        : c
    ))
    setModalClient(null)
    showToast('✅ Lien KYC envoyé avec succès')
  }

  return (
    <>
      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}

      {/* Modal */}
      {modalClient && (
        <RelanceModal
          client={modalClient}
          onClose={() => setModalClient(null)}
          onSuccess={handleSendSuccess}
        />
      )}

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
                <th style={tableHeaderCell}>Statut KYC</th>
                <th style={tableHeaderCell}>KYC soumis le</th>
                <th style={tableHeaderCell}>Dernière relance</th>
                <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {kycAlertes.map(c => {
                const days = daysSince(c.derniere_relance)
                const urgent = !c.derniere_relance || (days !== null && days > 14)
                return (
                  <tr key={c.id} style={s.tableRow}>
                    <td style={tableCell}>
                      <Link href={`/clients/${c.id}`} style={s.clientLink}>{c.prenom} {c.nom}</Link>
                    </td>
                    <td style={{ ...tableCell, color: colors.textMid }}>{c.email ?? '—'}</td>
                    <td style={tableCell}><KycStatusBadge clientId={c.id} status={c.kyc_status} /></td>
                    <td style={{ ...tableCell, color: colors.textMid }}>{formatDate(c.kyc_submitted_at)}</td>
                    <td style={tableCell}>
                      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: urgent ? colors.danger : colors.textMid }}>
                        {c.derniere_relance ? `Il y a ${days} j` : '—'}
                      </span>
                    </td>
                    <td style={{ ...tableCell, textAlign: 'right' }}>
                      {c.email && (
                        <button onClick={() => setModalClient(c)} style={s.sendBtn}>
                          → ENVOYER
                        </button>
                      )}
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
              <th style={tableHeaderCell}>Statut KYC</th>
              <th style={tableHeaderCell}>Soumis le</th>
              <th style={tableHeaderCell}>LM</th>
              <th style={tableHeaderCell}>DER</th>
              <th style={tableHeaderCell}>FICI</th>
              <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => {
              const clientDocs = docsByClient[c.id] ?? []
              return (
                <tr key={c.id} style={s.tableRow}>
                  <td style={tableCell}>
                    <Link href={`/clients/${c.id}`} style={s.clientLink}>{c.prenom} {c.nom}</Link>
                  </td>
                  <td style={tableCell}>
                    <span style={c.statut === 'client' ? statusBadge.success : statusBadge.info}>
                      {c.statut}
                    </span>
                  </td>
                  <td style={tableCell}><KycStatusBadge clientId={c.id} status={c.kyc_status} /></td>
                  <td style={{ ...tableCell, color: colors.textMid }}>{formatDate(c.kyc_submitted_at)}</td>
                  <td style={tableCell}><DocBadge ok={clientDocs.includes('LM')} label="LM" /></td>
                  <td style={tableCell}><DocBadge ok={clientDocs.includes('DER')} label="DER" /></td>
                  <td style={tableCell}><DocBadge ok={clientDocs.includes('FICI')} label="FICI" /></td>
                  <td style={{ ...tableCell, textAlign: 'right' }}>
                    {c.email && c.kyc_status !== 'complet' && (
                      <button onClick={() => setModalClient(c)} style={s.sendBtnCompact}>
                        → Envoyer
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

const s = {
  toast: {
    position: 'fixed' as const,
    bottom: '24px',
    right: '24px',
    backgroundColor: colors.blueDeep,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    padding: `${spacing[3]} ${spacing[5]}`,
    zIndex: 1000,
    boxShadow: shadows.md,
    borderLeft: `3px solid ${colors.success}`,
    letterSpacing: letterSpacings.wide,
  } as React.CSSProperties,
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
    margin: 0,
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
  sendBtn: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: colors.blueDeep,
    color: colors.white,
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
  sendBtnCompact: {
    fontFamily: fonts.body,
    fontSize: '0.62rem',
    fontWeight: fontWeights.medium,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: colors.blue,
    border: `1px solid ${colors.blueLight}`,
    cursor: 'pointer',
  } as React.CSSProperties,
}
