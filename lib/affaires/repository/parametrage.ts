import type { Supa } from '../types'

// Lectures paramétrage (incluant lignes inactives — écran d'administration).
export async function listFamilles(supabase: Supa) {
  const { data, error } = await supabase.from('affaire_familles')
    .select('id, code, libelle, ordre, actif').order('ordre', { ascending: true })
  if (error) throw error
  return data ?? []
}
export async function listTypes(supabase: Supa, familleId?: string) {
  let q = supabase.from('affaire_types')
    .select('id, famille_id, code, libelle, ordre, actif, categorie_patrimoniale, categorie_produit')
    .order('ordre', { ascending: true })
  if (familleId) q = q.eq('famille_id', familleId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
export async function listPartenaires(supabase: Supa) {
  const { data, error } = await supabase.from('partenaires')
    .select('id, nom, type_partenaire, actif, notes').order('nom', { ascending: true })
  if (error) throw error
  return data ?? []
}
export async function listMotifs(supabase: Supa) {
  const { data, error } = await supabase.from('affaire_motifs_archivage')
    .select('id, code, libelle, ordre, actif, necessite_commentaire').order('ordre', { ascending: true })
  if (error) throw error
  return data ?? []
}
export async function listFrises(supabase: Supa, familleId?: string) {
  let q = supabase.from('frise_versions')
    .select('id, famille_id, version, statut, actif, version_schema, publie_le, created_at')
    .order('created_at', { ascending: false })
  if (familleId) q = q.eq('famille_id', familleId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
export async function getFriseDetail(supabase: Supa, versionId: string) {
  const { data: version, error } = await supabase.from('frise_versions')
    .select('id, famille_id, version, statut, actif, version_schema').eq('id', versionId).maybeSingle()
  if (error) throw error
  if (!version) return null
  const [etapes, taches, documents, controles, champs] = await Promise.all([
    supabase.from('frise_etapes_modele').select('id, code, libelle, description, instructions, ordre, delai_indicatif_jours, validation_manuelle, conditions_blocage').eq('frise_version_id', versionId).order('ordre', { ascending: true }),
    supabase.from('frise_taches_modele').select('id, etape_modele_id, code, libelle, obligatoire, ordre').eq('frise_version_id', versionId),
    supabase.from('frise_documents_modele').select('id, etape_modele_id, code, libelle, type_document, obligatoire, ordre').eq('frise_version_id', versionId),
    supabase.from('frise_controles_modele').select('id, etape_modele_id, code, libelle, type_controle, obligatoire, ordre').eq('frise_version_id', versionId),
    supabase.from('affaire_champ_defs').select('id, portee, type_id, code, libelle, type_donnee, obligatoire, ordre, regles_validation').eq('frise_version_id', versionId).order('ordre', { ascending: true }),
  ])
  for (const r of [etapes, taches, documents, controles, champs]) if (r.error) throw r.error
  return {
    version,
    etapes: etapes.data ?? [], taches: taches.data ?? [], documents: documents.data ?? [],
    controles: controles.data ?? [], champs: champs.data ?? [],
  }
}
