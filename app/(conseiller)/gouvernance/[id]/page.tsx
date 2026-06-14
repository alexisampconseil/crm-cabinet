import { redirect } from 'next/navigation'

export default async function GouvernanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/produits/${id}?tab=gouvernance`)
}
