import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'

export const runtime = 'nodejs'
const BUCKET = 'produits-documents'

const CHAMPS_AUTORISES = new Set([
  'nom', 'societe_gestion', 'categorie', 'categorie_reglementaire',
  'isin', 'sri', 'rendement_n1', 'rendement_3ans', 'ratio_sharpe_3ans',
  'frais_entree', 'frais_gestion', 'frais_sortie', 'duree_detention_min',
  'date_agrement', 'encours_geres', 'description_ia', 'commentaire_sri_ia', 'actif',
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (CHAMPS_AUTORISES.has(key)) {
      update[key] = value
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ valide fourni' }, { status: 400 })
  }

  const service = createServiceSupabase()
  const { error } = await service
    .from('produits')
    .update(update)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE — suppression définitive ──────────────────────────────────────────
// Efface tous les fichiers Storage puis laisse la cascade SQL supprimer
// gouvernance, documents et extraits.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const service = createServiceSupabase()

  // 1. Collecter tous les storage_path des documents
  const { data: docs } = await service
    .from('produits_documents')
    .select('storage_path')
    .eq('produit_id', id)

  const paths = (docs ?? [])
    .map(d => d.storage_path as string | null)
    .filter((p): p is string => !!p)

  // 2. Supprimer les fichiers Storage (erreurs ignorées — ne doit pas bloquer la suppression)
  if (paths.length > 0) {
    await service.storage.from(BUCKET).remove(paths)
  }

  // 3. Supprimer le produit — CASCADE supprime gouvernance, documents, extraits
  const { error } = await service.from('produits').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
