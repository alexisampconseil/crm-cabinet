import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'

// Ancienne route autonome du détail d'affaire : redirige désormais vers l'onglet
// « Affaires » du client, avec l'affaire sélectionnée (expérience intégrée).
export default async function AffaireDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('affaires').select('client_id').eq('id', id).maybeSingle()
  if (data?.client_id) redirect(`/clients/${data.client_id}/affaires?affaire=${id}`)
  redirect('/clients')
}
