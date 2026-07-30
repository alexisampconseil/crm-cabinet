import type { Supa } from '../types'
import { mapPgError } from '../errors'

// Écritures paramétrage via la session Supabase de l'utilisateur : la RLS
// (conseiller + peut_parametrer_affaires) et les triggers d'immuabilité des
// frises publiées font foi. On traduit toute erreur PG en AffaireError.

async function insertRow(supabase: Supa, table: string, values: Record<string, unknown>) {
  const { data, error } = await supabase.from(table).insert(values).select().single()
  if (error) throw mapPgError(error)
  return data
}
async function updateRow(supabase: Supa, table: string, id: string, values: Record<string, unknown>) {
  const { data, error } = await supabase.from(table).update(values).eq('id', id).select().single()
  if (error) throw mapPgError(error)
  return data
}
async function deleteRow(supabase: Supa, table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw mapPgError(error)
  return { id }
}

export const parametrage = {
  // Config simple
  createFamille: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'affaire_familles', v),
  updateFamille: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'affaire_familles', id, v),
  createType: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'affaire_types', v),
  updateType: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'affaire_types', id, v),
  createPartenaire: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'partenaires', v),
  updatePartenaire: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'partenaires', id, v),
  createMotif: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'affaire_motifs_archivage', v),
  updateMotif: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'affaire_motifs_archivage', id, v),

  // Frises (structure éditable uniquement en brouillon — enforced par triggers)
  createFriseBrouillon: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'frise_versions', { ...v, statut: 'brouillon' }),
  addEtape: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'frise_etapes_modele', v),
  updateEtape: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'frise_etapes_modele', id, v),
  deleteEtape: (s: Supa, id: string) => deleteRow(s, 'frise_etapes_modele', id),
  addTache: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'frise_taches_modele', v),
  updateTache: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'frise_taches_modele', id, v),
  deleteTache: (s: Supa, id: string) => deleteRow(s, 'frise_taches_modele', id),
  addDocument: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'frise_documents_modele', v),
  updateDocument: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'frise_documents_modele', id, v),
  deleteDocument: (s: Supa, id: string) => deleteRow(s, 'frise_documents_modele', id),
  addControle: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'frise_controles_modele', v),
  updateControle: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'frise_controles_modele', id, v),
  deleteControle: (s: Supa, id: string) => deleteRow(s, 'frise_controles_modele', id),
  addChampDef: (s: Supa, v: Record<string, unknown>) => insertRow(s, 'affaire_champ_defs', v),
  updateChampDef: (s: Supa, id: string, v: Record<string, unknown>) => updateRow(s, 'affaire_champ_defs', id, v),
  deleteChampDef: (s: Supa, id: string) => deleteRow(s, 'affaire_champ_defs', id),
}

export async function publierFrise(supabase: Supa, versionId: string) {
  const { data, error } = await supabase.rpc('fn_frise_publier', { p_version_id: versionId })
  if (error) throw mapPgError(error)
  return Array.isArray(data) ? data[0] : data
}
export async function archiverFrise(supabase: Supa, versionId: string) {
  const { data, error } = await supabase.rpc('fn_frise_archiver', { p_version_id: versionId })
  if (error) throw mapPgError(error)
  return Array.isArray(data) ? data[0] : data
}
