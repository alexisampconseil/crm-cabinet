import AffairesListClient from '@/app/(conseiller)/affaires/_components/AffairesListClient'
import AffaireDetailClient from '@/app/(conseiller)/affaires/_components/AffaireDetailClient'

// Onglet « Affaires » du client. Le détail d'une affaire s'affiche dans ce même
// onglet (via ?affaire=<id>), sans quitter le contexte du client : l'en-tête et
// les onglets restent visibles.
export default async function ClientAffairesPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ affaire?: string }>
}) {
  const { id } = await params
  const { affaire } = await searchParams
  if (affaire) return <AffaireDetailClient affaireId={affaire} clientId={id} />
  return <AffairesListClient clientId={id} />
}
