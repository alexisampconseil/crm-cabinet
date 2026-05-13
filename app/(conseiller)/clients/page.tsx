'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import type { Client } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, tableHeaderCell, tableCell,
  statusBadge, buttonPrimary, buttonGhost, inputBase,
  sectionLabel, transitions, radii,
} from '@/lib/design-tokens'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

function formatEuros(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

export default function ClientsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const debugInfo = searchParams.get('debug')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('')
  const [filterKyc, setFilterKyc] = useState<string>('')

  const fetchClients = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('clients')
      .select('*')
      .order('nom', { ascending: true })

    if (filterStatut) query = query.eq('statut', filterStatut)
    if (filterKyc) query = query.eq('kyc_status', filterKyc)

    const { data } = await query
    setClients((data ?? []) as Client[])
    setLoading(false)
  }, [filterStatut, filterKyc])

  useEffect(() => { fetchClients() }, [fetchClients])

  const filtered = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.nom.toLowerCase().includes(q) ||
      c.prenom.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.ville ?? '').toLowerCase().includes(q) ||
      (c.code ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {/* Bandeau debug — visible uniquement si ?debug= présent dans l'URL */}
      {debugInfo && (
        <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '4px', padding: '12px 16px', marginBottom: '16px', fontFamily: 'monospace', fontSize: '13px', color: '#92400e', wordBreak: 'break-all' }}>
          <strong>DEBUG REDIRECT:</strong> {decodeURIComponent(debugInfo)}
        </div>
      )}
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}>
            <div style={s.rule} />
            <span style={s.eyebrowText}>Gestion</span>
          </div>
          <h1 style={s.title}>Clients & Prospects ✓v2</h1>
        </div>
        <Link href="/clients/nouveau" style={{ ...buttonPrimary, padding: `${spacing[3]} ${spacing[6]}` }}>
          + Nouveau client
        </Link>
      </div>

      {/* Filtres */}
      <div style={s.filtersBar}>
        <input
          type="search"
          placeholder="Rechercher par nom, email, ville..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputBase, width: '300px', padding: `${spacing[2]} ${spacing[3]}` }}
        />

        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          style={{ ...s.select }}
        >
          <option value="">Tous les statuts</option>
          <option value="prospect">Prospects</option>
          <option value="client">Clients</option>
          <option value="inactif">Inactifs</option>
          <option value="archive">Archivés</option>
        </select>

        <select
          value={filterKyc}
          onChange={e => setFilterKyc(e.target.value)}
          style={{ ...s.select }}
        >
          <option value="">Tous les KYC</option>
          <option value="non_fait">KYC non fait</option>
          <option value="en_cours">KYC en cours</option>
          <option value="complet">KYC complet</option>
          <option value="a_renouveler">KYC à renouveler</option>
        </select>

        <span style={s.count}>
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Tableau */}
      <div style={{ ...cardBase, boxShadow: shadows.sm, overflow: 'hidden' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={tableHeaderCell}>Client</th>
              <th style={tableHeaderCell}>Code</th>
              <th style={tableHeaderCell}>Ville</th>
              <th style={tableHeaderCell}>Statut</th>
              <th style={tableHeaderCell}>KYC</th>
              <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Encours</th>
              <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Dernier contact</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ ...tableCell, textAlign: 'center', color: colors.textLight, padding: spacing[8] }}>
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tableCell, textAlign: 'center', color: colors.textLight, padding: spacing[8] }}>
                  Aucun client trouvé
                </td>
              </tr>
            )}
            {!loading && filtered.map(c => (
              <tr
                key={c.id}
                style={s.tableRow}
                onClick={() => router.push(`/clients/${c.id}`)}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.bluePale)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={tableCell}>
                  <Link href={`/clients/${c.id}`} style={s.clientCellLink}>
                    <div style={s.avatar}>
                      {(c.prenom[0] + c.nom[0]).toUpperCase()}
                    </div>
                    <div>
                      <div style={s.clientName}>{c.prenom} {c.nom}</div>
                      {c.email && <div style={s.clientEmail}>{c.email}</div>}
                    </div>
                  </Link>
                </td>
                <td style={{ ...tableCell, color: colors.textMid, fontFamily: 'monospace', fontSize: fontSizes.xs }}>
                  {c.code ?? '—'}
                </td>
                <td style={{ ...tableCell, color: colors.textMid }}>{c.ville ?? '—'}</td>
                <td style={tableCell}>
                  <span style={STATUT_STYLE[c.statut] ?? statusBadge.neutral}>
                    {c.statut.charAt(0).toUpperCase() + c.statut.slice(1)}
                  </span>
                </td>
                <td style={tableCell}>
                  <span style={KYC_STYLE[c.kyc_status]}>
                    {KYC_LABELS[c.kyc_status]}
                  </span>
                </td>
                <td style={{ ...tableCell, textAlign: 'right', fontWeight: fontWeights.medium }}>
                  {formatEuros(c.encours ?? 0)}
                </td>
                <td style={{ ...tableCell, textAlign: 'right', color: colors.textMid }}>
                  {formatDate(c.dernier_contact)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
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
  },
  filtersBar: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[5],
    flexWrap: 'wrap' as const,
  },
  select: {
    ...inputBase,
    width: 'auto',
    padding: `${spacing[2]} ${spacing[3]}`,
    cursor: 'pointer',
    backgroundColor: colors.white,
  } as React.CSSProperties,
  count: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    marginLeft: 'auto',
    letterSpacing: letterSpacings.wide,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  tableRow: {
    cursor: 'pointer',
    transition: transitions.fast,
  } as React.CSSProperties,
  clientCellLink: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    textDecoration: 'none',
    color: 'inherit',
  } as React.CSSProperties,
  clientCell: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: colors.bluePale,
    color: colors.blue,
    fontSize: '0.65rem',
    fontWeight: fontWeights.bold,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  clientName: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  clientEmail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textLight,
    marginTop: '2px',
  },
}
