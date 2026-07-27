import type { Supa, AffaireFamille, AffaireType, Partenaire, FriseVersion } from '../types'

// Familles actives (ordonnées) — lecture pour le formulaire de création.
export async function getFamillesActives(supabase: Supa): Promise<AffaireFamille[]> {
  const { data, error } = await supabase
    .from('affaire_familles')
    .select('id, code, libelle, ordre, actif')
    .eq('actif', true)
    .order('ordre', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AffaireFamille[]
}

// Types actifs (éventuellement filtrés par famille).
export async function getTypesActifs(supabase: Supa, familleId?: string): Promise<AffaireType[]> {
  let q = supabase
    .from('affaire_types')
    .select('id, famille_id, code, libelle, ordre, actif, categorie_patrimoniale, categorie_produit')
    .eq('actif', true)
    .order('ordre', { ascending: true })
  if (familleId) q = q.eq('famille_id', familleId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as AffaireType[]
}

export async function getPartenairesActifs(supabase: Supa): Promise<Partenaire[]> {
  const { data, error } = await supabase
    .from('partenaires')
    .select('id, nom, type_partenaire, actif')
    .eq('actif', true)
    .order('nom', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Partenaire[]
}

// Versions de frise publiées et actives (une par famille) — indique où une
// création est possible.
export async function getFrisesActives(supabase: Supa): Promise<FriseVersion[]> {
  const { data, error } = await supabase
    .from('frise_versions')
    .select('id, famille_id, version, statut, actif')
    .eq('actif', true)
    .eq('statut', 'publie')
  if (error) throw error
  return (data ?? []) as unknown as FriseVersion[]
}

// Données consolidées pour le formulaire de création d'affaire.
export async function getDonneesCreation(supabase: Supa): Promise<{
  familles: AffaireFamille[]
  types: AffaireType[]
  partenaires: Partenaire[]
  frisesActives: FriseVersion[]
}> {
  const [familles, types, partenaires, frisesActives] = await Promise.all([
    getFamillesActives(supabase),
    getTypesActifs(supabase),
    getPartenairesActifs(supabase),
    getFrisesActives(supabase),
  ])
  return { familles, types, partenaires, frisesActives }
}
