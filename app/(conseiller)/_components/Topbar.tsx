'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  colors, fonts, fontSizes, fontWeights, spacing,
  layout, shadows, transitions, letterSpacings,
} from '@/lib/design-tokens'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface TopbarProps {
  userEmail: string
}

export default function Topbar({ userEmail }: TopbarProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const initiales = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : 'AC'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    document.cookie = 'amp_role=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <header style={s.header}>
      {/* Titre de la page — injecté via CSS ou titre dynamique */}
      <div style={s.left} />

      {/* Actions droite */}
      <div style={s.right}>
        {/* Avatar + menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={s.avatar}
            title={userEmail}
          >
            {initiales}
          </button>

          {menuOpen && (
            <>
              {/* Fond invisible pour fermer */}
              <div
                style={s.overlay}
                onClick={() => setMenuOpen(false)}
              />
              <div style={s.menu}>
                <div style={s.menuEmail}>{userEmail}</div>
                <div style={s.menuDivider} />
                <button
                  onClick={handleLogout}
                  style={s.menuItem}
                >
                  Déconnexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

const s = {
  header: {
    height: layout.topbarHeight,
    backgroundColor: colors.white,
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${spacing[8]}`,
    boxShadow: shadows.sm,
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
  },
  left: {
    flex: 1,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[4],
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: colors.blueDeep,
    color: colors.white,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
    fontWeight: fontWeights.semibold,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: letterSpacings.wide,
    transition: transitions.fast,
  } as React.CSSProperties,
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 200,
  },
  menu: {
    position: 'absolute' as const,
    top: '44px',
    right: 0,
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.md,
    minWidth: '200px',
    zIndex: 201,
    padding: `${spacing[2]} 0`,
  },
  menuEmail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textLight,
    padding: `${spacing[2]} ${spacing[4]}`,
    letterSpacing: letterSpacings.wide,
  },
  menuDivider: {
    height: '1px',
    backgroundColor: colors.border,
    margin: `${spacing[2]} 0`,
  },
  menuItem: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.text,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    padding: `${spacing[2]} ${spacing[4]}`,
    transition: transitions.fast,
  } as React.CSSProperties,
}
