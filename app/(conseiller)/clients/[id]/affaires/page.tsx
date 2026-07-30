import AffairesListClient from '@/app/(conseiller)/affaires/_components/AffairesListClient'

export default async function ClientAffairesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AffairesListClient clientId={id} />
}
