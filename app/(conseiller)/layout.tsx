import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'
import { colors, layout, spacing } from '@/lib/design-tokens'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'

export default async function ConseillerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!roleData) redirect('/login')
  if (roleData.role !== 'conseiller') redirect('/tableau-de-bord')

  return (
    <div style={s.root}>
      <Sidebar />
      <div style={s.main}>
        <Topbar userEmail={user.email ?? ''} />
        <div style={s.content}>
          {children}
        </div>
      </div>
    </div>
  )
}

const s = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: colors.offWhite,
  },
  main: {
    flex: 1,
    // min-width: 0 permet à cette colonne flex de rétrécir sous la largeur
    // intrinsèque de son contenu (tableaux/grilles/frises larges) : sans lui,
    // un enfant large force la page à déborder → scroll horizontal global.
    minWidth: 0,
    marginLeft: layout.sidebarWidth,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
  },
  content: {
    flex: 1,
    padding: layout.contentPadding,
    maxWidth: layout.maxContentWidth,
    width: '100%',
  },
}
