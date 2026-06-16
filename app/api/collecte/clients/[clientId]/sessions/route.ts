import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getSessionsByClient } from '@/lib/collecte'

// GET /api/collecte/clients/:clientId/sessions — toutes les sessions d'un client
// Conseillers : accès à tous les clients.
// Clients : vérification explicite que le clientId de l'URL correspond au leur
//           (défense en profondeur — ne pas compter uniquement sur RLS).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  if (!userRole) return NextResponse.json({ error: 'Rôle introuvable' }, { status: 403 })

  if (userRole.role === 'client') {
    if (userRole.client_id !== clientId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
  }

  try {
    const sessions = await getSessionsByClient(clientId, supabase)
    return NextResponse.json(sessions)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la récupération des sessions'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
