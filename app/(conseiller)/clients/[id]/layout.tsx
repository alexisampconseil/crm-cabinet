import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'
import { logAccess } from '@/lib/supabase'
import { ClientProvider } from '@/lib/ClientContext'
import type { ClientContextData, SaveHandlers } from '@/lib/ClientContext'
import type {
  Client, Famille, Enfant, Objectif, ActifFinancier,
  BienImmobilier, Passif, BudgetPoste, Fiscalite, Prevoyance, ContratPrevoyance,
} from '@/lib/supabase'
import ClientHeader from './_components/ClientHeader'
import ClientTabs from './_components/ClientTabs'
import { colors, spacing } from '@/lib/design-tokens'

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ClientLayout({ children, params }: Props) {
  const { id: clientId } = await params

  // Vérification du rôle
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (roleData?.role !== 'conseiller') redirect('/tableau-de-bord')

  // Chargement parallèle de toutes les données du dossier
  const [
    clientRes, familleRes, enfantsRes, objectifsRes,
    actifsRes, biensRes, passifsRes, budgetRes,
    fiscaliteRes, prevoyanceRes, contratsRes, dossiersRes,
  ] = await Promise.allSettled([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('famille').select('*').eq('client_id', clientId).single(),
    supabase.from('enfants').select('*').eq('client_id', clientId),
    supabase.from('objectifs').select('*').eq('client_id', clientId).order('priorite'),
    supabase.from('actifs_financiers').select('*').eq('client_id', clientId),
    supabase.from('patrimoine_immobilier').select('*').eq('client_id', clientId),
    supabase.from('passifs').select('*').eq('client_id', clientId),
    supabase.from('budget_postes').select('*').eq('client_id', clientId),
    supabase.from('fiscalite').select('*').eq('client_id', clientId).single(),
    supabase.from('prevoyance').select('*').eq('client_id', clientId).single(),
    supabase.from('contrats_prevoyance').select('*').eq('client_id', clientId),
    supabase.from('dossiers').select('*, dossier_etapes(*)').eq('client_id', clientId).order('created_at', { ascending: false }),
  ])

  if (clientRes.status === 'rejected' || !clientRes.value?.data) {
    redirect('/clients')
  }

  const client = (clientRes as PromiseFulfilledResult<{ data: Client }>).value.data

  await logAccess('client_view', `client:${clientId}`)

  const initial: ClientContextData = {
    client,
    famille:            familleRes.status === 'fulfilled' ? (familleRes.value.data as Famille | null) : null,
    enfants:            enfantsRes.status === 'fulfilled'  ? ((enfantsRes.value.data ?? []) as Enfant[]) : [],
    objectifs:          objectifsRes.status === 'fulfilled' ? ((objectifsRes.value.data ?? []) as Objectif[]) : [],
    actifsFinanciers:   actifsRes.status === 'fulfilled'   ? ((actifsRes.value.data ?? []) as ActifFinancier[]) : [],
    biensImmobiliers:   biensRes.status === 'fulfilled'    ? ((biensRes.value.data ?? []) as BienImmobilier[]) : [],
    passifs:            passifsRes.status === 'fulfilled'  ? ((passifsRes.value.data ?? []) as Passif[]) : [],
    budgetPostes:       budgetRes.status === 'fulfilled'   ? ((budgetRes.value.data ?? []) as BudgetPoste[]) : [],
    fiscalite:          fiscaliteRes.status === 'fulfilled' ? (fiscaliteRes.value.data as Fiscalite | null) : null,
    prevoyance:         prevoyanceRes.status === 'fulfilled' ? (prevoyanceRes.value.data as Prevoyance | null) : null,
    contratsPrevoyance: contratsRes.status === 'fulfilled'  ? ((contratsRes.value.data ?? []) as never[]) : [],
    dossiers:           dossiersRes.status === 'fulfilled'  ? ((dossiersRes.value.data ?? []) as never[]) : [],
  }

  // ----------------------------------------------------------------
  // Server Actions — closures capturant clientId
  // ----------------------------------------------------------------

  async function saveClient(data: Partial<Client>) {
    'use server'
    const sb = await createServerSupabase()
    const { error } = await sb.from('clients').update(data).eq('id', clientId)
    if (error) throw new Error(error.message)
  }

  async function saveFamille(data: Partial<Famille>) {
    'use server'
    const sb = await createServerSupabase()
    const { error } = await sb.from('famille')
      .upsert({ ...data, client_id: clientId }, { onConflict: 'client_id' })
    if (error) throw new Error(error.message)
  }

  async function saveEnfants(data: Enfant[]) {
    'use server'
    const sb = await createServerSupabase()
    await sb.from('enfants').delete().eq('client_id', clientId)
    if (data.length > 0) {
      const { error } = await sb.from('enfants')
        .insert(data.map(({ id: _id, client_id: _cid, ...rest }) => ({ ...rest, client_id: clientId })))
      if (error) throw new Error(error.message)
    }
  }

  async function saveObjectifs(data: Objectif[]) {
    'use server'
    const sb = await createServerSupabase()
    await sb.from('objectifs').delete().eq('client_id', clientId)
    if (data.length > 0) {
      const { error } = await sb.from('objectifs')
        .insert(data.map(({ id: _id, client_id: _cid, created_at: _ca, ...rest }) => ({ ...rest, client_id: clientId })))
      if (error) throw new Error(error.message)
    }
  }

  async function saveActifs(data: ActifFinancier[]) {
    'use server'
    const sb = await createServerSupabase()
    await sb.from('actifs_financiers').delete().eq('client_id', clientId)
    if (data.length > 0) {
      const { error } = await sb.from('actifs_financiers')
        .insert(data.map(({ id: _id, client_id: _cid, created_at: _ca, ...rest }) => ({ ...rest, client_id: clientId })))
      if (error) throw new Error(error.message)
    }
  }

  async function saveBiens(data: BienImmobilier[]) {
    'use server'
    const sb = await createServerSupabase()
    await sb.from('patrimoine_immobilier').delete().eq('client_id', clientId)
    if (data.length > 0) {
      const { error } = await sb.from('patrimoine_immobilier')
        .insert(data.map(({ id: _id, client_id: _cid, created_at: _ca, ...rest }) => ({ ...rest, client_id: clientId })))
      if (error) throw new Error(error.message)
    }
  }

  async function savePassifs(data: Passif[]) {
    'use server'
    const sb = await createServerSupabase()
    await sb.from('passifs').delete().eq('client_id', clientId)
    if (data.length > 0) {
      const { error } = await sb.from('passifs')
        .insert(data.map(({ id: _id, client_id: _cid, created_at: _ca, ...rest }) => ({ ...rest, client_id: clientId })))
      if (error) throw new Error(error.message)
    }
  }

  async function saveBudget(data: BudgetPoste[]) {
    'use server'
    const sb = await createServerSupabase()
    await sb.from('budget_postes').delete().eq('client_id', clientId)
    if (data.length > 0) {
      const { error } = await sb.from('budget_postes')
        .insert(data.map(({ id: _id, client_id: _cid, ...rest }) => ({ ...rest, client_id: clientId })))
      if (error) throw new Error(error.message)
    }
  }

  async function saveFiscalite(data: Partial<Fiscalite>) {
    'use server'
    const sb = await createServerSupabase()
    const { error } = await sb.from('fiscalite')
      .upsert({ ...data, client_id: clientId }, { onConflict: 'client_id' })
    if (error) throw new Error(error.message)
  }

  async function savePrevoyance(data: Partial<Prevoyance>) {
    'use server'
    const sb = await createServerSupabase()
    const { error } = await sb.from('prevoyance')
      .upsert({ ...data, client_id: clientId }, { onConflict: 'client_id' })
    if (error) throw new Error(error.message)
  }

  async function saveContratsPrevoyance(data: ContratPrevoyance[]) {
    'use server'
    const sb = await createServerSupabase()
    await sb.from('contrats_prevoyance').delete().eq('client_id', clientId)
    if (data.length > 0) {
      const { error } = await sb.from('contrats_prevoyance')
        .insert(data.map(({ id: _id, client_id: _cid, created_at: _ca, ...rest }) => ({ ...rest, client_id: clientId })))
      if (error) throw new Error(error.message)
    }
  }

  const handlers: SaveHandlers = {
    saveClient, saveFamille, saveEnfants, saveObjectifs,
    saveActifs, saveBiens, savePassifs, saveBudget,
    saveFiscalite, savePrevoyance, saveContratsPrevoyance,
  }

  return (
    <ClientProvider initial={initial} handlers={handlers}>
      <ClientHeader clientId={clientId} />
      <ClientTabs clientId={clientId} />
      <div style={{ paddingBottom: spacing[12] }}>
        {children}
      </div>
    </ClientProvider>
  )
}
