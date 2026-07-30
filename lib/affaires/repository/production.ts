import type { Supa } from '../types'

export interface ProductionParTypeLigne {
  type_id: string
  libelle: string
  nb: number
  montant: number
  revenu_previsionnel: number
  revenu_realise: number
}

export interface ProductionStats {
  annee: number
  familleId: string | null
  nbEnCours: number
  nbTermineesAnnee: number
  montantTotal: number
  revenuPrevisionnel: number
  revenuRealise: number
  parType: ProductionParTypeLigne[]
}

// Statistiques de production conseiller (vue globale). RLS conseiller → toutes
// les affaires. Agrégation en mémoire (pas de système analytique dédié).
export async function getProductionStats(
  supabase: Supa,
  opts: { annee?: number; familleId?: string | null } = {}
): Promise<ProductionStats> {
  const annee = opts.annee ?? new Date().getFullYear()
  const familleId = opts.familleId ?? null

  let q = supabase
    .from('affaires')
    .select('id, type_id, famille_id, statut, montant, revenu_previsionnel, revenu_realise, date_ouverture, date_cloture')
  if (familleId) q = q.eq('famille_id', familleId)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as Array<{
    type_id: string; statut: string; montant: number | null
    revenu_previsionnel: number | null; revenu_realise: number | null; date_cloture: string | null
  }>

  const { data: typesData } = await supabase.from('affaire_types').select('id, libelle')
  const typeLabels = new Map<string, string>((typesData ?? []).map((t) => [t.id as string, t.libelle as string]))

  const anneeDe = (d: string | null) => (d ? new Date(d).getFullYear() : null)
  const dansAnnee = (r: (typeof rows)[number]) => r.statut === 'terminee' && anneeDe(r.date_cloture) === annee

  const parType = new Map<string, ProductionParTypeLigne>()
  let nbEnCours = 0, nbTermineesAnnee = 0, montantTotal = 0, revenuPrevisionnel = 0, revenuRealise = 0

  for (const r of rows) {
    if (r.statut === 'en_cours') nbEnCours++
    if (!dansAnnee(r)) continue
    nbTermineesAnnee++
    montantTotal += r.montant ?? 0
    revenuPrevisionnel += r.revenu_previsionnel ?? 0
    revenuRealise += r.revenu_realise ?? 0
    const line = parType.get(r.type_id) ?? {
      type_id: r.type_id, libelle: typeLabels.get(r.type_id) ?? r.type_id,
      nb: 0, montant: 0, revenu_previsionnel: 0, revenu_realise: 0,
    }
    line.nb++
    line.montant += r.montant ?? 0
    line.revenu_previsionnel += r.revenu_previsionnel ?? 0
    line.revenu_realise += r.revenu_realise ?? 0
    parType.set(r.type_id, line)
  }

  return {
    annee, familleId, nbEnCours, nbTermineesAnnee, montantTotal, revenuPrevisionnel, revenuRealise,
    parType: [...parType.values()].sort((a, b) => b.montant - a.montant),
  }
}

// Permission de paramétrage de l'utilisateur courant (via RPC 021).
export async function peutParametrer(supabase: Supa): Promise<boolean> {
  const { data, error } = await supabase.rpc('peut_parametrer_affaires')
  if (error) return false
  return data === true
}
