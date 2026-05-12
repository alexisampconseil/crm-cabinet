'use client'

import { useClient } from '@/lib/ClientContext'
import {
  colors, fonts, fontSizes, fontWeights, spacing,
  letterSpacings, statusBadge, transitions,
} from '@/lib/design-tokens'

const KYC_LABELS: Record<string, string> = {
  non_fait: 'KYC non fait',
  en_cours: 'KYC en cours',
  complet: 'KYC complet',
  a_renouveler: 'KYC à renouveler',
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

export default function ClientHeader({ clientId: _ }: { clientId: string }) {
  const { data: { client } } = useClient()

  const initiales = (client.prenom[0] + client.nom[0]).toUpperCase()

  return (
    <div style={s.header}>
      {/* Avatar */}
      <div style={s.avatar}>{initiales}</div>

      {/* Infos principales */}
      <div style={s.info}>
        <h1 style={s.name}>{client.prenom} {client.nom}</h1>
        <div style={s.meta}>
          {client.code && <span style={s.code}>{client.code}</span>}
          {client.ville && <span style={s.metaItem}>📍 {client.ville}</span>}
          {client.email && <span style={s.metaItem}>{client.email}</span>}
          {client.telephone && <span style={s.metaItem}>{client.telephone}</span>}
        </div>
      </div>

      {/* Badges */}
      <div style={s.badges}>
        <span style={STATUT_STYLE[client.statut] ?? statusBadge.neutral}>
          {client.statut.charAt(0).toUpperCase() + client.statut.slice(1)}
        </span>
        <span style={KYC_STYLE[client.kyc_status]}>
          {KYC_LABELS[client.kyc_status]}
        </span>
        {client.profil && (
          <span style={statusBadge.info}>
            Profil {client.profil}
          </span>
        )}
      </div>

      {/* Encours */}
      <div style={s.encours}>
        <p style={s.encoursLabel}>Encours total</p>
        <p style={s.encoursValue}>{formatEuros(client.encours ?? 0)}</p>
      </div>
    </div>
  )
}

const s = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[5],
    padding: `${spacing[5]} ${spacing[6]}`,
    backgroundColor: colors.white,
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: spacing[1],
  },
  avatar: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    backgroundColor: colors.blueDeep,
    color: colors.white,
    fontSize: '1.1rem',
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.body,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  info: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: '1.5rem',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: '-0.01em',
    marginBottom: spacing[1],
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[4],
    flexWrap: 'wrap' as const,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: fontSizes.xs,
    color: colors.textLight,
    backgroundColor: colors.bluePale,
    padding: '2px 8px',
    letterSpacing: letterSpacings.wider,
  } as React.CSSProperties,
  metaItem: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    fontWeight: fontWeights.light,
  },
  badges: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  encours: {
    textAlign: 'right' as const,
    flexShrink: 0,
    paddingLeft: spacing[5],
    borderLeft: `1px solid ${colors.border}`,
  },
  encoursLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    marginBottom: spacing[1],
  },
  encoursValue: {
    fontFamily: fonts.heading,
    fontSize: '1.6rem',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: '-0.01em',
  },
}
