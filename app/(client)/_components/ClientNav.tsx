'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { colors, fonts, fontSizes, fontWeights, spacing, transitions } from '@/lib/design-tokens'

const NAV_ITEMS = [
  { href: '/tableau-de-bord', label: 'Tableau de bord',    icon: '📊' },
  { href: '/mon-kyc',         label: 'Mon questionnaire',  icon: '📋' },
  { href: '/mes-documents',   label: 'Mes documents',      icon: '📁' },
  { href: '/messagerie',      label: 'Messagerie',         icon: '💬' },
]

export default function ClientNav() {
  const pathname = usePathname()

  return (
    <nav style={s.nav}>
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link key={item.href} href={item.href} style={{ ...s.link, ...(active ? s.active : {}) }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

const s = {
  nav: {
    flex: 1,
    padding: `${spacing[4]} 0`,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[1],
  },
  link: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: 'rgba(255,255,255,0.55)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[3]} ${spacing[5]}`,
    transition: transitions.fast,
    borderLeft: '3px solid transparent',
  } as React.CSSProperties,
  active: {
    color: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(182,153,87,0.1)',
    borderLeft: `3px solid ${colors.gold}`,
  } as React.CSSProperties,
}
