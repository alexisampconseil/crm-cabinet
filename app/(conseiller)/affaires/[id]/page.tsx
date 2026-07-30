import AffaireDetailClient from '../_components/AffaireDetailClient'

export default async function AffaireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AffaireDetailClient affaireId={id} />
}
