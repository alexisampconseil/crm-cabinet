import type { Supa } from '../types'
import { AffaireError } from '../errors'

// Garde applicative : exige un utilisateur authentifié de rôle conseiller.
// Retourne l'identifiant de l'utilisateur. Lève un AffaireError (401/403) sinon.
// La RLS et les RPC SECURITY DEFINER refont le contrôle côté base ; ceci est la
// défense en profondeur applicative.
export async function requireConseiller(supabase: Supa): Promise<{ userId: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AffaireError('Non authentifié', 401)

  const { data: role, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new AffaireError('Rôle introuvable', 403)
  if (!role || role.role !== 'conseiller') {
    throw new AffaireError('Accès réservé aux conseillers', 403)
  }
  return { userId: user.id }
}
