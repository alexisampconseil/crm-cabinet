import type {
  Supa, Affaire, AffaireDetail, AffaireEtape, AffaireTache, AffaireDocument,
  AffaireControle, AffaireBlocage, AffaireChampValeur, AffaireEvenement, AffaireProposition,
} from '../types'

const AFFAIRE_COLS =
  'id, client_id, famille_id, type_id, frise_version_id, produit_id, partenaire_id, ' +
  'libelle, montant, frais, revenu_previsionnel, revenu_realise, statut, ' +
  'motif_archivage_id, commentaire_archivage, date_ouverture, date_cloture, date_archivage, ' +
  'version_row, created_at, updated_at'

// Liste des affaires d'un client (sélection explicite ; pas de chargement de la frise).
export async function listAffairesByClient(supabase: Supa, clientId: string): Promise<Affaire[]> {
  const { data, error } = await supabase
    .from('affaires')
    .select(AFFAIRE_COLS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Affaire[]
}

export async function getAffaire(supabase: Supa, affaireId: string): Promise<Affaire | null> {
  const { data, error } = await supabase
    .from('affaires')
    .select(AFFAIRE_COLS)
    .eq('id', affaireId)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Affaire) ?? null
}

// Détail complet (frise instanciée) d'une affaire.
export async function getAffaireDetail(supabase: Supa, affaireId: string): Promise<AffaireDetail | null> {
  const affaire = await getAffaire(supabase, affaireId)
  if (!affaire) return null

  const [etapes, taches, documents, controles, blocages, champs] = await Promise.all([
    supabase.from('affaire_etapes')
      .select('id, affaire_id, code, libelle, ordre, statut, validation_manuelle, date_debut, date_fin')
      .eq('affaire_id', affaireId).order('ordre', { ascending: true }),
    supabase.from('affaire_taches')
      .select('id, affaire_id, etape_id, code, libelle, obligatoire, ordre, statut')
      .eq('affaire_id', affaireId).order('ordre', { ascending: true }),
    supabase.from('affaire_documents')
      .select('id, affaire_id, etape_id, code, libelle, obligatoire, ordre, statut')
      .eq('affaire_id', affaireId).order('ordre', { ascending: true }),
    supabase.from('affaire_controles')
      .select('id, affaire_id, etape_id, code, libelle, obligatoire, ordre, statut')
      .eq('affaire_id', affaireId).order('ordre', { ascending: true }),
    supabase.from('affaire_blocages')
      .select('id, affaire_id, etape_id, code, libelle, actif, deroge, motif_derogation')
      .eq('affaire_id', affaireId).order('created_at', { ascending: true }),
    supabase.from('affaire_champ_valeurs')
      .select('id, affaire_id, champ_def_id, valeur')
      .eq('affaire_id', affaireId),
  ])
  for (const r of [etapes, taches, documents, controles, blocages, champs]) {
    if (r.error) throw r.error
  }
  return {
    affaire,
    etapes: (etapes.data ?? []) as unknown as AffaireEtape[],
    taches: (taches.data ?? []) as unknown as AffaireTache[],
    documents: (documents.data ?? []) as unknown as AffaireDocument[],
    controles: (controles.data ?? []) as unknown as AffaireControle[],
    blocages: (blocages.data ?? []) as unknown as AffaireBlocage[],
    champs: (champs.data ?? []) as unknown as AffaireChampValeur[],
  }
}

export async function getAffaireEvenements(supabase: Supa, affaireId: string): Promise<AffaireEvenement[]> {
  const { data, error } = await supabase
    .from('affaire_evenements')
    .select('id, affaire_id, type_evenement, motif, details, auteur_id, created_at')
    .eq('affaire_id', affaireId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as AffaireEvenement[]
}

export async function getAffairePropositions(supabase: Supa, affaireId: string): Promise<AffaireProposition[]> {
  const { data, error } = await supabase
    .from('affaire_propositions_patrimoniales')
    .select(
      'id, affaire_id, client_id, operation, cible_type, donnees_proposees, statut, ' +
      'actif_financier_id, patrimoine_immobilier_id, passif_id, contrat_prevoyance_id, ' +
      'cree_actif_financier_id, cree_patrimoine_immobilier_id, cree_passif_id, cree_contrat_prevoyance_id, ' +
      'decided_by, decided_at, motif_decision, created_at'
    )
    .eq('affaire_id', affaireId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as AffaireProposition[]
}

// Résout la définition de champ (champ_def_id) à partir d'une ligne de valeur.
export async function resolveChampDefId(
  supabase: Supa, affaireId: string, champValeurId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('affaire_champ_valeurs')
    .select('champ_def_id')
    .eq('id', champValeurId)
    .eq('affaire_id', affaireId)
    .maybeSingle()
  if (error) throw error
  return (data?.champ_def_id as string) ?? null
}
