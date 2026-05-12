import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'
import { colors, fonts, fontSizes, fontWeights, spacing, shadows, transitions, layout } from '@/lib/design-tokens'
import Image from 'next/image'
import Link from 'next/link'
import ClientLogout from './_components/ClientLogout'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'client') redirect('/dashboard')

  const { data: clientData } = await supabase
    .from('clients')
    .select('nom, prenom')
    .eq('id', roleData.client_id!)
    .single()

  return (
    <div style={s.root}>
      {/* Sidebar client */}
      <aside style={s.aside}>
        <div style={s.logoWrap}>
          <Image src="/logo.jpg" alt="AMP CONSEIL" width={90} height={45}
            style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} priority />
        </div>

        {clientData && (
          <div style={s.userBlock}>
            <div style={s.userAvatar}>{(clientData.prenom[0] + clientData.nom[0]).toUpperCase()}</div>
            <div>
              <p style={s.userName}>{clientData.prenom} {clientData.nom}</p>
              <p style={s.userRole}>Espace client</p>
            </div>
          </div>
        )}

        <nav style={s.nav}>
          <NavLink href="/tableau-de-bord" label="Tableau de bord" icon="📊" />
          <NavLink href="/mon-kyc" label="Mon questionnaire" icon="📋" />
          <NavLink href="/mes-documents" label="Mes documents" icon="📁" />
          <NavLink href="/messagerie" label="Messagerie" icon="💬" />
        </nav>

        <div style={s.footer}>
          <div style={s.divider} />
          <ClientLogout />
          <p style={s.contact}>contact@ampconseil.com</p>
        </div>
      </aside>

      {/* Contenu */}
      <main style={s.main}>
        <div style={s.content}>
          {children}
        </div>
      </main>
    </div>
  )
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} style={s.link}>
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
      {label}
    </Link>
  )
}

const s = {
  root: { display: 'flex', minHeight: '100vh', backgroundColor: colors.offWhite },
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
    padding: `${spacing[6]} ${spacing[5]}`,
    borderBottom: `1px solid rgba(255,255,255,0.07)`,
  },
  userBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[5]} ${spacing[5]}`,
    borderBottom: `1px solid rgba(255,255,255,0.07)`,
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(182,153,87,0.2)',
    border: '1px solid rgba(182,153,87,0.4)',
    color: colors.goldLight,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
    fontWeight: fontWeights.semibold,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  userName: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 1.2,
  },
  userRole: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.goldLight,
    letterSpacing: '0.1em',
    marginTop: '2px',
  },
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
  footer: { padding: `0 0 ${spacing[5]}` },
  divider: { height: '1px', backgroundColor: 'rgba(255,255,255,0.07)', margin: `0 ${spacing[5]} ${spacing[3]}` },
  contact: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.25)',
    padding: `${spacing[2]} ${spacing[5]}`,
    letterSpacing: '0.06em',
  },
  main: {
    flex: 1,
    marginLeft: layout.sidebarWidth,
    minHeight: '100vh',
  },
  content: {
    padding: layout.contentPadding,
    maxWidth: layout.maxContentWidth,
    width: '100%',
  },
}
