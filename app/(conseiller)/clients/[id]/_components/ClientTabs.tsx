'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useClient } from '@/lib/ClientContext'
import {
  colors, fonts, fontSizes, fontWeights, spacing,
  shadows, transitions, letterSpacings, buttonGold,
} from '@/lib/design-tokens'

const TABS = [
  { label: 'Synthèse',    segment: '' },
  { label: 'Famille',     segment: 'famille' },
  { label: 'Objectifs',   segment: 'objectifs' },
  { label: 'Patrimoine',  segment: 'patrimoine' },
  { label: 'Fiscalité',   segment: 'fiscalite' },
  { label: 'Prévoyance',  segment: 'prevoyance' },
  { label: 'Affaires',    segment: 'affaires' },
  { label: 'Messagerie',  segment: 'messagerie' },
]

interface ClientTabsProps {
  clientId: string
}

export default function ClientTabs({ clientId }: ClientTabsProps) {
  const pathname = usePathname()
  const { dirty, saving, saveErrors, saveAll, clearErrors } = useClient()
  const [saved, setSaved] = useState(false)

  const base = `/clients/${clientId}`

  const isActive = (segment: string) => {
    if (segment === '') return pathname === base
    return pathname.startsWith(`${base}/${segment}`)
  }

  const handleSave = async () => {
    const { errors } = await saveAll()
    if (errors.length === 0) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div style={s.wrapper}>
      {/* Onglets */}
      <div style={s.tabs}>
        {TABS.map(tab => {
          const href = tab.segment ? `${base}/${tab.segment}` : base
          const active = isActive(tab.segment)
          return (
            <Link key={tab.segment} href={href} style={{ ...s.tab, ...(active ? s.tabActive : {}) }}>
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Barre de sauvegarde */}
      <div style={s.actions}>
        {saveErrors.length > 0 && (
          <div style={s.errorPill} onClick={clearErrors}>
            ⚠ {saveErrors.length} erreur{saveErrors.length > 1 ? 's' : ''} — cliquer pour fermer
          </div>
        )}
        {dirty.size > 0 && (
          <span style={s.dirtyHint}>
            {dirty.size} section{dirty.size > 1 ? 's' : ''} modifiée{dirty.size > 1 ? 's' : ''}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={dirty.size === 0 || saving}
          style={{
            ...buttonGold,
            fontSize: fontSizes.xs,
            padding: `8px 20px`,
            opacity: (dirty.size === 0 || saving) ? 0.5 : 1,
            cursor: dirty.size === 0 ? 'default' : 'pointer',
            backgroundColor: saved ? colors.success : colors.gold,
            transition: 'background-color 0.3s',
          }}
        >
          {saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

const s = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.white,
    marginBottom: spacing[6],
    gap: spacing[4],
  },
  tabs: {
    display: 'flex',
    gap: 0,
  },
  tab: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide,
    color: colors.textMid,
    textDecoration: 'none',
    padding: `${spacing[4]} ${spacing[5]}`,
    borderBottom: '2px solid transparent',
    transition: transitions.fast,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  tabActive: {
    color: colors.blueDeep,
    borderBottom: `2px solid ${colors.gold}`,
    fontWeight: fontWeights.semibold,
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    flexShrink: 0,
    padding: `0 ${spacing[1]}`,
  },
  dirtyHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.warning,
    letterSpacing: letterSpacings.wide,
  },
  errorPill: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    padding: `4px 10px`,
    cursor: 'pointer',
    letterSpacing: letterSpacings.wide,
  } as React.CSSProperties,
}
