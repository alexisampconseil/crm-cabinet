'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { colors, fonts, fontSizes, fontWeights, spacing, transitions, layout } from '@/lib/design-tokens'
import Image from 'next/image'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NAV = [
  {
    section: 'Principal',
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: IconDashboard },
      { href: '/clients',   label: 'Clients',          icon: IconClients,  badge: true },
    ],
  },
  {
    section: 'Activité',
    items: [
      { href: '/conformite',    label: 'Conformité',    icon: IconShield },
      { href: '/collecte',      label: 'Collecte',      icon: IconCollecte },
      { href: '/produits',      label: 'Produits',      icon: IconProduits },
      { href: '/portefeuilles', label: 'Portefeuilles', icon: IconChart },
      { href: '/agenda',        label: 'Agenda',        icon: IconCalendar },
    ],
  },
  {
    section: 'Gestion',
    items: [
      { href: '/documents', label: 'Documents', icon: IconFolder },
      { href: '/reporting', label: 'Reporting',  icon: IconBar },
      { href: '/parametres/affaires', label: 'Paramètres', icon: IconSettings },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    fetchUnreadCount()

    const channel = supabase
      .channel('sidebar-unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messagerie',
        filter: `expediteur=eq.client`,
      }, payload => {
        if ((payload.new as { lu: boolean }).lu === false) {
          setUnreadMessages(n => n + 1)
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messagerie',
      }, () => {
        fetchUnreadCount()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Rafraîchir le compteur quand l'utilisateur navigue (notamment après avoir lu des messages)
  useEffect(() => {
    fetchUnreadCount()
  }, [pathname])

  async function fetchUnreadCount() {
    const { count } = await supabase
      .from('messagerie')
      .select('*', { count: 'exact', head: true })
      .eq('expediteur', 'client')
      .eq('lu', false)
    setUnreadMessages(count ?? 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    document.cookie = 'amp_role=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <aside style={s.aside}>
      {/* Logo */}
      <div style={s.logoWrap}>
        <Image
          src="/logo.jpg"
          alt="AMP CONSEIL"
          width={180}
          height={90}
          style={{ objectFit: 'contain', width: '100%', height: 'auto', borderRadius: '4px' }}
          priority
          unoptimized
        />
      </div>

      {/* Navigation */}
      <nav style={s.nav}>
        {NAV.map(group => (
          <div key={group.section}>
            <p style={s.section}>{group.section}</p>
            {group.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              const showBadge = item.badge && unreadMessages > 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{ ...s.link, ...(active ? s.linkActive : {}) }}
                >
                  <item.icon active={active} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {showBadge && (
                    <span style={s.badge}>{unreadMessages > 99 ? '99+' : unreadMessages}</span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Déconnexion */}
      <div style={s.footer}>
        <div style={s.divider} />
        <button onClick={handleLogout} style={s.logout}>
          <IconLogout />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Icônes SVG légères
// ---------------------------------------------------------------------------

function Icon({ path, active }: { path: string; active?: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? colors.gold : 'rgba(255,255,255,0.45)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: transitions.fast }}
    >
      <path d={path} />
    </svg>
  )
}

function IconDashboard({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? colors.gold : 'rgba(255,255,255,0.45)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconClients({ active }: { active?: boolean }) {
  return <Icon active={active} path="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8 4v6m3-3h-6" />
}

function IconShield({ active }: { active?: boolean }) {
  return <Icon active={active} path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
}

function IconCollecte({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? colors.gold : 'rgba(255,255,255,0.45)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function IconProduits({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? colors.gold : 'rgba(255,255,255,0.45)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

function IconChart({ active }: { active?: boolean }) {
  return <Icon active={active} path="M18 20V10M12 20V4M6 20v-6" />
}

function IconCalendar({ active }: { active?: boolean }) {
  return <Icon active={active} path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
}

function IconFolder({ active }: { active?: boolean }) {
  return <Icon active={active} path="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
}

function IconBar({ active }: { active?: boolean }) {
  return <Icon active={active} path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm6 0V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v10m8-10a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2V9z" />
}

function IconSettings({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? colors.gold : 'rgba(255,255,255,0.45)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  aside: {
    width: layout.sidebarWidth,
    minHeight: '100vh',
    backgroundColor: colors.blueDeep,
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'fixed' as const,
    top: 0,
    left: 0,
    zIndex: 100,
    borderRight: `1px solid rgba(255,255,255,0.06)`,
  },
  logoWrap: {
    padding: `${spacing[5]} ${spacing[4]}`,
    borderBottom: `1px solid rgba(255,255,255,0.07)`,
  },
  nav: {
    flex: 1,
    padding: `${spacing[4]} 0`,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[2],
  },
  section: {
    fontFamily: fonts.body,
    fontSize: '0.6rem',
    fontWeight: fontWeights.bold,
    letterSpacing: '0.22em',
    textTransform: 'uppercase' as const,
    color: colors.gold,
    padding: `${spacing[4]} ${spacing[5]} ${spacing[2]}`,
    opacity: 0.75,
  },
  link: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    letterSpacing: '0.04em',
    color: 'rgba(255,255,255,0.45)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[3]} ${spacing[5]}`,
    transition: transitions.fast,
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
  } as React.CSSProperties,
  linkActive: {
    color: colors.white,
    backgroundColor: 'rgba(182,153,87,0.12)',
    borderLeftColor: colors.gold,
  } as React.CSSProperties,
  badge: {
    backgroundColor: colors.danger,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: '0.55rem',
    fontWeight: fontWeights.bold,
    borderRadius: '9999px',
    minWidth: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
    lineHeight: 1,
    flexShrink: 0,
  } as React.CSSProperties,
  footer: {
    padding: `0 0 ${spacing[4]}`,
  },
  divider: {
    height: '1px',
    backgroundColor: 'rgba(255,255,255,0.07)',
    margin: `0 ${spacing[5]} ${spacing[3]}`,
  },
  logout: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    letterSpacing: '0.04em',
    color: 'rgba(255,255,255,0.4)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[3]} ${spacing[5]}`,
    width: '100%',
    transition: transitions.fast,
  } as React.CSSProperties,
}
