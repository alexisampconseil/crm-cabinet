import AffaireCreateClient from '@/app/(conseiller)/affaires/_components/AffaireCreateClient'

export default async function ClientAffaireNouvellePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AffaireCreateClient clientId={id} />
}
