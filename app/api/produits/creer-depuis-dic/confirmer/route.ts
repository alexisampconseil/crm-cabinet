import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'
import { CreationProduitSchema, type CreationProduit } from '@/lib/schemas/creation-produit'
import { DB_TYPE_MAP, type FrontDocType } from '@/lib/prompts/creation-produit'

export const runtime = 'nodejs'

interface DocumentInfo {
  storage_path:  string
  nom_fichier:   string
  nb_pages:      number
  texte_extrait: string
  doc_type:      FrontDocType
}

interface ConfirmerBody {
  preview:        CreationProduit
  documents:      DocumentInfo[]
  modele:         string
  version_prompt: string
  tokens_entree:  number | null
  tokens_sortie:  number | null
  analyse_brut:   Record<string, unknown>
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Parsing ───────────────────────────────────────────────────────────────
  let body: ConfirmerBody
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!Array.isArray(body.documents) || body.documents.length === 0) {
    return NextResponse.json({ error: 'Aucun document fourni' }, { status: 400 })
  }

  // Re-valider le preview Zod pour éviter toute manipulation côté client
  const validation = CreationProduitSchema.safeParse(body.preview)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données de prévisualisation invalides' }, { status: 400 })
  }

  const preview = validation.data
  const m       = preview.metadonnees_produit
  const f       = preview.produit_facts ?? {}
  const service = createServiceSupabase()
  const now     = new Date().toISOString()

  // ── 1. Créer le produit ───────────────────────────────────────────────────
  const { data: produit, error: produitError } = await service
    .from('produits')
    .insert({
      nom:                     m.nom,
      societe_gestion:         m.societe_gestion          ?? null,
      categorie:               m.categorie                ?? 'AV',
      categorie_reglementaire: m.categorie_reglementaire  ?? null,
      isin:                    m.isin                     ?? null,
      description_ia:          m.description              ?? null,
      commentaire_sri_ia:      m.commentaire_sri          ?? null,
      sri:                     f.sri                      ?? null,
      frais_gestion:           f.frais_gestion            ?? null,
      frais_entree:            f.frais_entree             ?? null,
      frais_sortie:            f.frais_sortie             ?? null,
      duree_detention_min:     f.duree_detention_min      ?? null,
      rendement_n1:            f.rendement_n1             ?? null,
      rendement_3ans:          f.rendement_3ans           ?? null,
      actif:                   true,
    })
    .select('id')
    .single()

  if (produitError || !produit) {
    return NextResponse.json({ error: `Erreur création produit : ${produitError?.message}` }, { status: 500 })
  }

  const produitId = produit.id

  // ── 2. Upsert gouvernance ─────────────────────────────────────────────────
  // Le trigger 006 (trg_auto_gouvernance) crée déjà une gouvernance vide au INSERT
  // de produits. On upsert pour écraser avec les données IA sans risque de duplicate key.
  const { data: gouvernance, error: gouvError } = await service
    .from('produits_gouvernance')
    .upsert({
      produit_id:              produitId,
      statut_conformite:       'conforme',
      statut_validation:       'a_valider',  // JAMAIS validé automatiquement
      source_marche_cible:     'deduit_ia',
      mc_emetteur_texte:       m.mc_emetteur_texte          ?? null,
      mc_pos_connaissance:     preview.marche_cible_positif.connaissance,
      mc_pos_experience:       preview.marche_cible_positif.experience,
      mc_pos_capacite_pertes:  preview.marche_cible_positif.capacite_pertes,
      mc_pos_tolerance_risque: preview.marche_cible_positif.tolerance_risque,
      mc_pos_horizon:          preview.marche_cible_positif.horizon,
      mc_pos_sensibilite_esg:  preview.marche_cible_positif.sensibilite_esg,
      mc_neg_connaissance:     preview.marche_cible_negatif.connaissance,
      mc_neg_experience:       preview.marche_cible_negatif.experience,
      mc_neg_capacite_pertes:  preview.marche_cible_negatif.capacite_pertes,
      mc_neg_tolerance_risque: preview.marche_cible_negatif.tolerance_risque,
      mc_neg_horizon:          preview.marche_cible_negatif.horizon,
      mc_neg_sensibilite_esg:  preview.marche_cible_negatif.sensibilite_esg,
      public_exclu:            m.public_exclu               ?? null,
      conditions_acces:        m.conditions_acces           ?? null,
      conflits_interet:        m.conflits_interet           ?? null,
      notes_gouvernance:       m.notes_gouvernance          ?? null,
      justifications_ia:       preview.justifications,
      score_confiance_ia:      preview.score_confiance,
      modele_ia:               body.modele,
      date_analyse_ia:         now,
      alerte_revue:            false,
    }, { onConflict: 'produit_id' })
    .select('id')
    .single()

  if (gouvError || !gouvernance) {
    await service.from('produits').delete().eq('id', produitId)
    return NextResponse.json({ error: `Erreur upsert gouvernance : ${gouvError?.message}` }, { status: 500 })
  }

  // ── 3. Créer un produits_documents par document ───────────────────────────
  const createdDocIds: string[] = []
  let primaryDocId: string | null = null

  for (let i = 0; i < body.documents.length; i++) {
    const docInfo = body.documents[i]
    const dbType  = DB_TYPE_MAP[docInfo.doc_type] ?? 'Autre'

    const { data: doc, error: docError } = await service
      .from('produits_documents')
      .insert({
        produit_id:   produitId,
        type:         dbType,
        url:          null,
        storage_path: docInfo.storage_path,
        statut:       'actif',
      })
      .select('id')
      .single()

    if (docError || !doc) {
      if (createdDocIds.length > 0) {
        await service.from('produits_documents').delete().in('id', createdDocIds)
      }
      await service.from('produits_gouvernance').delete().eq('id', gouvernance.id)
      await service.from('produits').delete().eq('id', produitId)
      return NextResponse.json({ error: `Erreur création document ${i + 1} : ${docError?.message}` }, { status: 500 })
    }

    createdDocIds.push(doc.id)
    // Le DIC (ou le premier doc) devient le document source principal
    if (docInfo.doc_type === 'DIC' && !primaryDocId) primaryDocId = doc.id
  }

  if (!primaryDocId && createdDocIds.length > 0) primaryDocId = createdDocIds[0]

  // ── 4. Créer les documents_extraits (non-bloquant) ────────────────────────
  for (let i = 0; i < body.documents.length; i++) {
    const docInfo   = body.documents[i]
    const docId     = createdDocIds[i]
    const isPrimary = docId === primaryDocId

    await service.from('documents_extraits').insert({
      document_id:           docId,
      texte_extrait:         docInfo.texte_extrait,
      nb_pages:              docInfo.nb_pages,
      statut_analyse:        'analyse_terminee',
      gouvernance_id:        gouvernance.id,
      modele_ia:             body.modele,
      version_prompt:        body.version_prompt,
      date_analyse_ia:       now,
      tokens_entree:         isPrimary ? body.tokens_entree : null,
      tokens_sortie:         isPrimary ? body.tokens_sortie : null,
      analyse_resultat_brut: isPrimary ? body.analyse_brut  : null,
    })
  }

  // Lier la gouvernance au document source principal
  if (primaryDocId) {
    await service
      .from('produits_gouvernance')
      .update({ source_document_id: primaryDocId })
      .eq('id', gouvernance.id)
  }

  return NextResponse.json({ produit_id: produitId })
}
