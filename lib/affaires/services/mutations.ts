import type { Supa, RpcAffaireResult, RpcPropositionResult, PropositionOperation, PropositionCible } from '../types'
import { mapPgError } from '../errors'
import { resolveChampDefId } from '../repository/affaires'
import { AffaireError } from '../errors'

// Appel RPC générique : renvoie la première ligne, traduit l'erreur PG.
async function rpc<T>(supabase: Supa, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw mapPgError(error)
  const row = Array.isArray(data) ? data[0] : data
  return row as T
}

// ── Création / modification ──────────────────────────────────────────────────
export interface CreerAffaireInput {
  clientId: string; familleId: string; typeId: string; libelle: string
  montant?: number | null; frais?: number | null; revenuPrevisionnel?: number | null
  produitId?: string | null; partenaireId?: string | null
}
export function creerAffaire(supabase: Supa, i: CreerAffaireInput): Promise<RpcAffaireResult> {
  return rpc(supabase, 'fn_affaire_creer', {
    p_client_id: i.clientId, p_famille_id: i.familleId, p_type_id: i.typeId, p_libelle: i.libelle,
    p_montant: i.montant ?? null, p_frais: i.frais ?? null, p_revenu_previsionnel: i.revenuPrevisionnel ?? null,
    p_produit_id: i.produitId ?? null, p_partenaire_id: i.partenaireId ?? null,
  })
}

export interface ModifierInfosInput {
  affaireId: string; versionAttendue: number; libelle: string
  montant?: number | null; frais?: number | null; revenuPrevisionnel?: number | null
  produitId?: string | null; partenaireId?: string | null
}
export function modifierInfos(supabase: Supa, i: ModifierInfosInput): Promise<RpcAffaireResult> {
  return rpc(supabase, 'fn_affaire_modifier_infos', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue, p_libelle: i.libelle,
    p_montant: i.montant ?? null, p_frais: i.frais ?? null, p_revenu_previsionnel: i.revenuPrevisionnel ?? null,
    p_produit_id: i.produitId ?? null, p_partenaire_id: i.partenaireId ?? null,
  })
}

// ── Exécution ────────────────────────────────────────────────────────────────
// Le champ est identifié côté route par l'id de la ligne de valeur ; on résout
// la définition (champ_def_id) avant l'appel RPC.
export async function modifierChamp(
  supabase: Supa,
  i: { affaireId: string; versionAttendue: number; champValeurId: string; valeur: unknown | null }
): Promise<RpcAffaireResult> {
  const champDefId = await resolveChampDefId(supabase, i.affaireId, i.champValeurId)
  if (!champDefId) throw new AffaireError('Champ introuvable pour cette affaire.', 404)
  return rpc(supabase, 'fn_affaire_champ_modifier', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue,
    p_champ_def_id: champDefId, p_valeur: i.valeur ?? null,
  })
}

function statutMutation(fn: string, idParam: string) {
  return (
    supabase: Supa,
    i: { affaireId: string; versionAttendue: number; elementId: string; statut: string }
  ): Promise<RpcAffaireResult> =>
    rpc(supabase, fn, {
      p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue,
      [idParam]: i.elementId, p_statut: i.statut,
    })
}
export const modifierEtape = statutMutation('fn_affaire_etape_statut', 'p_etape_id')
export const modifierTache = statutMutation('fn_affaire_tache_statut', 'p_tache_id')
export const modifierDocument = statutMutation('fn_affaire_document_statut', 'p_document_id')
export const modifierControle = statutMutation('fn_affaire_controle_statut', 'p_controle_id')

export function derogerBlocage(
  supabase: Supa,
  i: { affaireId: string; versionAttendue: number; blocageId: string; motif: string }
): Promise<RpcAffaireResult> {
  return rpc(supabase, 'fn_affaire_deroger_blocage', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue,
    p_blocage_id: i.blocageId, p_motif: i.motif,
  })
}

// ── Cycle de vie ─────────────────────────────────────────────────────────────
export function terminer(
  supabase: Supa, i: { affaireId: string; versionAttendue: number; revenuRealise?: number | null }
): Promise<RpcAffaireResult> {
  return rpc(supabase, 'fn_affaire_terminer', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue, p_revenu_realise: i.revenuRealise ?? null,
  })
}
export function archiver(
  supabase: Supa, i: { affaireId: string; versionAttendue: number; motifId: string; commentaire?: string | null }
): Promise<RpcAffaireResult> {
  return rpc(supabase, 'fn_affaire_archiver', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue,
    p_motif_id: i.motifId, p_commentaire: i.commentaire ?? null,
  })
}
export function reouvrir(
  supabase: Supa, i: { affaireId: string; versionAttendue: number; motif: string }
): Promise<RpcAffaireResult> {
  return rpc(supabase, 'fn_affaire_reouvrir', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue, p_motif: i.motif,
  })
}
export function corrigerRevenu(
  supabase: Supa, i: { affaireId: string; versionAttendue: number; revenu: number; motif: string }
): Promise<RpcAffaireResult> {
  return rpc(supabase, 'fn_affaire_corriger_revenu', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue, p_revenu: i.revenu, p_motif: i.motif,
  })
}

// ── Propositions patrimoniales ───────────────────────────────────────────────
export interface CreerPropositionInput {
  affaireId: string; versionAttendue: number
  operation: PropositionOperation; cibleType: PropositionCible
  donnees: Record<string, unknown>
  actifFinancierId?: string | null; patrimoineImmobilierId?: string | null
  passifId?: string | null; contratPrevoyanceId?: string | null
}
export function creerProposition(supabase: Supa, i: CreerPropositionInput): Promise<RpcPropositionResult> {
  return rpc(supabase, 'fn_affaire_proposition_creer', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue,
    p_operation: i.operation, p_cible_type: i.cibleType, p_donnees: i.donnees,
    p_actif_financier_id: i.actifFinancierId ?? null,
    p_patrimoine_immobilier_id: i.patrimoineImmobilierId ?? null,
    p_passif_id: i.passifId ?? null, p_contrat_prevoyance_id: i.contratPrevoyanceId ?? null,
  })
}
export function appliquerProposition(
  supabase: Supa, i: { affaireId: string; versionAttendue: number; propositionId: string }
): Promise<RpcPropositionResult> {
  return rpc(supabase, 'fn_affaire_proposition_appliquer', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue, p_proposition_id: i.propositionId,
  })
}
export function rejeterProposition(
  supabase: Supa, i: { affaireId: string; versionAttendue: number; propositionId: string; motif?: string | null }
): Promise<RpcPropositionResult> {
  return rpc(supabase, 'fn_affaire_proposition_rejeter', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue,
    p_proposition_id: i.propositionId, p_motif: i.motif ?? null,
  })
}
export function annulerProposition(
  supabase: Supa, i: { affaireId: string; versionAttendue: number; propositionId: string; motif?: string | null }
): Promise<RpcPropositionResult> {
  return rpc(supabase, 'fn_affaire_proposition_annuler', {
    p_affaire_id: i.affaireId, p_version_attendue: i.versionAttendue,
    p_proposition_id: i.propositionId, p_motif: i.motif ?? null,
  })
}
