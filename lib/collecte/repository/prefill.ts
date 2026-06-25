// Lectures du référentiel patrimonial pour la construction du snapshot_prefill.
// Chaque fonction lit une section du référentiel et retourne le sous-type
// SnapshotPrefill correspondant, prêt à être assemblé par services/prefill.ts.
//
// Toutes les fonctions reçoivent l'instance supabase en paramètre :
// les routes API choisissent entre createServerSupabase() (conseiller authentifié)
// et createServiceSupabase() (portail public via kyc_token).

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SnapshotPrefillIdentite,
  SnapshotPrefillFoyer,
  SnapshotPrefillConjoint,
  SnapshotPrefillSituationPro,
  SnapshotPrefillActif,
  SnapshotPrefillImmobilier,
  SnapshotPrefillPassif,
  SnapshotPrefillBudget,
  SnapshotPrefillFiscalite,
  SnapshotPrefillPrevoyance,
  SnapshotPrefillObjectif,
} from '../types'

export async function readIdentite(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillIdentite> {
  const [
    { data: client, error: clientError },
    { data: famille, error: famError },
  ] = await Promise.all([
    supabase.from('clients').select('nom, prenom').eq('id', clientId).single(),
    supabase
      .from('famille')
      .select(
        'nom, prenom, date_naissance, nationalite, pays_naissance, lieu_naissance, adresse, code_postal, ville, email, telephone'
      )
      .eq('client_id', clientId)
      .maybeSingle(),
  ])
  if (clientError) throw clientError
  if (famError) throw famError

  // famille.nom/prenom prend le pas sur clients.nom/prenom (plus précis ou à jour)
  // famille est la source de vérité du questionnaire — jamais clients.email/telephone.
  return {
    nom: famille?.nom ?? client.nom,
    prenom: famille?.prenom ?? client.prenom,
    date_naissance: famille?.date_naissance ?? null,
    nationalite: famille?.nationalite ?? null,
    pays_naissance: famille?.pays_naissance ?? null,
    lieu_naissance: famille?.lieu_naissance ?? null,
    adresse: famille?.adresse ?? null,
    code_postal: famille?.code_postal ?? null,
    ville: famille?.ville ?? null,
    email: famille?.email ?? null,
    telephone: famille?.telephone ?? null,
  }
}

export async function readFoyer(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillFoyer> {
  const [
    { data: famille, error: famError },
    { data: enfants, error: enfError },
  ] = await Promise.all([
    supabase
      .from('famille')
      .select(
        'situation, regime_matrimonial, date_mariage, contrat_mariage, date_contrat_mariage, donation_dernier_vivant, regime_pacs, date_pacs, conjoint_nom, conjoint_prenom, conjoint_profession, conjoint_employeur, conjoint_categorie_professionnelle, conjoint_pays_naissance, conjoint_lieu_naissance, conjoint_email, conjoint_telephone'
      )
      .eq('client_id', clientId)
      .maybeSingle(),
    supabase
      .from('enfants')
      .select('id, prenom, nom, date_naissance, a_charge, filiation')
      .eq('client_id', clientId)
      .order('date_naissance', { ascending: true }),
  ])
  if (famError) throw famError
  if (enfError) throw enfError

  const conjoint: SnapshotPrefillConjoint | null =
    famille?.conjoint_nom || famille?.conjoint_prenom
      ? {
          nom: famille.conjoint_nom ?? null,
          prenom: famille.conjoint_prenom ?? null,
          profession: famille.conjoint_profession ?? null,
          employeur: famille.conjoint_employeur ?? null,
          categorie_professionnelle: famille.conjoint_categorie_professionnelle ?? null,
          pays_naissance: famille.conjoint_pays_naissance ?? null,
          lieu_naissance: famille.conjoint_lieu_naissance ?? null,
          email: famille.conjoint_email ?? null,
          telephone: famille.conjoint_telephone ?? null,
        }
      : null

  return {
    situation: famille?.situation ?? null,
    regime_matrimonial: famille?.regime_matrimonial ?? null,
    date_mariage: famille?.date_mariage ?? null,
    contrat_mariage: famille?.contrat_mariage ?? null,
    date_contrat_mariage: famille?.date_contrat_mariage ?? null,
    donation_dernier_vivant: famille?.donation_dernier_vivant ?? null,
    regime_pacs: famille?.regime_pacs ?? null,
    date_pacs: famille?.date_pacs ?? null,
    conjoint,
    enfants: (enfants ?? []).map((e) => ({
      id: e.id,
      prenom: e.prenom,
      nom: e.nom ?? null,
      date_naissance: e.date_naissance ?? null,
      a_charge: e.a_charge,
      filiation: e.filiation ?? null,
    })),
  }
}

export async function readSituationPro(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillSituationPro> {
  const { data, error } = await supabase
    .from('famille')
    .select(
      'profession, employeur, categorie_professionnelle, conjoint_profession, conjoint_employeur, conjoint_categorie_professionnelle'
    )
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw error

  const hasConjoint = !!(data?.conjoint_profession || data?.conjoint_employeur)

  return {
    client: {
      profession: data?.profession ?? null,
      employeur: data?.employeur ?? null,
      categorie: data?.categorie_professionnelle ?? null,
    },
    conjoint: hasConjoint
      ? {
          profession: data?.conjoint_profession ?? null,
          employeur: data?.conjoint_employeur ?? null,
          categorie: data?.conjoint_categorie_professionnelle ?? null,
        }
      : null,
  }
}

export async function readActifsFinanciers(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillActif[]> {
  const { data, error } = await supabase
    .from('actifs_financiers')
    .select('id, nature, libelle, montant, souscrit_par, date_souscription, detail')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((a) => ({
    id: a.id,
    nature: a.nature,
    libelle: a.libelle,
    montant: a.montant ?? null,
    souscrit_par: a.souscrit_par ?? null,
    date_souscription: a.date_souscription ?? null,
    detail: (a.detail ?? {}) as Record<string, unknown>,
  }))
}

export async function readPatrimoineImmobilier(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillImmobilier[]> {
  const { data, error } = await supabase
    .from('patrimoine_immobilier')
    .select('id, nature, valeur, detenu_par, revenus_annuels, date_acquisition, quote_part_detenue, detail')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((b) => ({
    id: b.id,
    nature: b.nature,
    valeur: b.valeur ?? null,
    detenu_par: b.detenu_par ?? null,
    revenus_annuels: b.revenus_annuels ?? null,
    date_acquisition: b.date_acquisition ?? null,
    quote_part_detenue: b.quote_part_detenue ?? null,
    detail: (b.detail ?? {}) as Record<string, unknown>,
  }))
}

export async function readPassifs(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillPassif[]> {
  const { data, error } = await supabase
    .from('passifs')
    .select('id, nature, banque, montant, capital_restant_du, mensualite, taux, detail')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    nature: p.nature,
    banque: p.banque ?? null,
    montant: p.montant ?? null,
    capital_restant_du: p.capital_restant_du ?? null,
    mensualite: p.mensualite ?? null,
    taux: p.taux ?? null,
    detail: (p.detail ?? {}) as Record<string, unknown>,
  }))
}

export async function readBudget(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillBudget> {
  const { data, error } = await supabase
    .from('budget_postes')
    .select('id, type, libelle, montant_annuel, nature, detail')
    .eq('client_id', clientId)
    .order('libelle', { ascending: true })
  if (error) throw error

  const postes = data ?? []
  const toPoste = (p: (typeof postes)[number]) => ({
    id: p.id,
    libelle: p.libelle,
    montant_annuel: p.montant_annuel ?? null,
    nature: p.nature ?? null,
    detail: (p.detail ?? {}) as Record<string, unknown>,
  })
  const revenus = postes.filter((p) => p.type === 'revenu').map(toPoste)
  const charges = postes.filter((p) => p.type === 'charge').map(toPoste)

  const totalRevenus = revenus.reduce((s, p) => s + (p.montant_annuel ?? 0), 0)
  const totalCharges = charges.reduce((s, p) => s + (p.montant_annuel ?? 0), 0)

  return { revenus, charges, solde_annuel: totalRevenus - totalCharges }
}

export async function readFiscalite(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillFiscalite> {
  const { data, error } = await supabase
    .from('fiscalite')
    .select('tranche_ir, revenu_fiscal, nombre_parts, option_bareme, ifi, dispositifs')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw error
  return {
    tranche_ir: data?.tranche_ir ?? null,
    revenu_fiscal: data?.revenu_fiscal ?? null,
    nombre_parts: data?.nombre_parts ?? null,
    option_bareme: data?.option_bareme ?? null,
    ifi: data?.ifi ?? null,
    dispositifs: data?.dispositifs ?? [],
  }
}

export async function readPrevoyance(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillPrevoyance> {
  const [
    { data: prev, error: prevError },
    { data: contrats, error: contratsError },
  ] = await Promise.all([
    supabase
      .from('prevoyance')
      .select('testament, droits_retraite_estimes')
      .eq('client_id', clientId)
      .maybeSingle(),
    supabase
      .from('contrats_prevoyance')
      .select('id, nature, compagnie, montant')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true }),
  ])
  if (prevError) throw prevError
  if (contratsError) throw contratsError

  return {
    testament: prev?.testament ?? false,
    droits_retraite_estimes: prev?.droits_retraite_estimes ?? null,
    contrats: (contrats ?? []).map((c) => ({
      id: c.id,
      nature: c.nature,
      compagnie: c.compagnie ?? null,
      montant: c.montant ?? null,
    })),
  }
}

export async function readObjectifs(
  clientId: string,
  supabase: SupabaseClient
): Promise<SnapshotPrefillObjectif[]> {
  const { data, error } = await supabase
    .from('objectifs')
    .select('id, libelle, horizon, montant_cible, priorite')
    .eq('client_id', clientId)
    .order('priorite', { ascending: true })
  if (error) throw error
  return (data ?? []).map((o) => ({
    id: o.id,
    libelle: o.libelle,
    horizon: o.horizon ?? null,
    montant_cible: o.montant_cible ?? null,
    priorite: o.priorite,
  }))
}
