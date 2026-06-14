// Ce fichier est SERVEUR UNIQUEMENT.
// import 'server-only' garantit une erreur de build si ce module est
// importé depuis un Client Component ('use client').
// Il contient le client Supabase service_role qui détient SUPABASE_SERVICE_ROLE_KEY.
import 'server-only'

import { createClient } from '@supabase/supabase-js'

const BUCKET = 'produits-documents'
// Durée de validité des signed URLs générées à la demande (1 heure)
const SIGNED_URL_TTL = 3600

export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Génère une signed URL temporaire pour un fichier dans Supabase Storage.
// À appeler dans les Server Components ou les Route Handlers.
// Ne jamais exposer la signed URL sans vérification d'accès préalable.
export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = SIGNED_URL_TTL
): Promise<string | null> {
  const service = createServiceSupabase()
  const { data, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
