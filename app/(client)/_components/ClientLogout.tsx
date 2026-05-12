'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { colors, fonts, fontSizes, spacing, transitions } from '@/lib/design-tokens'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ClientLogout() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    document.cookie = 'amp_role=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <button onClick={handleLogout} style={s.btn}>
      <span style={{ fontSize: '0.9rem' }}>↩</span>
      Déconnexion
    </button>
  )
}

const s = {
  btn: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
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
