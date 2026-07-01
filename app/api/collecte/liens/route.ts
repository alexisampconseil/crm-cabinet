import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  creerSession,
  ouvrirSession,
  getSessionActive,
  getVersionActive,
  buildCollecteUrl,
} from '@/lib/collecte'

const CreateLienSchema = z.object({
  clientId: z.string().uuid('clientId doit être un UUID valide'),
  perimetre: z.enum(['client_seul', 'foyer']).optional(),
  expiresInHours: z.number().int().min(1).max(720).optional().default(168),
  notes_conseiller: z.string().max(2000).optional(),
})

// POST /api/collecte/liens
// Génère un lien client complet (kyc_token + collecte_session + snapshot_prefill figé)
// en une seule opération atomique best-effort.
// Réservé aux conseillers authentifiés.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!userRole || userRole.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès réservé aux conseillers' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const parsed = CreateLienSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  const { clientId, perimetre, expiresInHours, notes_conseiller } = parsed.data

  // Déclarés avant le try pour être accessibles dans le catch si une création partielle
  // a eu lieu avant l'erreur — permet d'informer le conseiller sur la récupération.
  let createdSessionId: string | undefined
  let createdTokenId: string | undefined

  try {
    // 1. Vérification client — kyc_status utilisé pour déterminer le type de session
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, nom, prenom, kyc_status')
      .eq('id', clientId)
      .single()
    if (clientErr || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // Type déterminé automatiquement — le conseiller ne choisit pas.
    // Client avec KYC déjà validé (complet ou à renouveler) → mise à jour annuelle simplifiée.
    // Sinon (non_fait, prospect) → bilan initial complet.
    const sessionType: 'bilan_initial' | 'verification_annuelle' =
      (client.kyc_status === 'complet' || client.kyc_status === 'a_renouveler')
        ? 'verification_annuelle'
        : 'bilan_initial'

    // 2. Vérification aucune session active (brouillon ou en_cours)
    const sessionExistante = await getSessionActive(clientId, supabase)
    if (sessionExistante) {
      return NextResponse.json(
        {
          error: `Une session est déjà active pour ce client (id: ${sessionExistante.id}, statut: ${sessionExistante.statut})`,
          session_id: sessionExistante.id,
        },
        { status: 409 }
      )
    }

    // 3. Vérification version active du questionnaire — bloquant avant toute création
    // pour éviter une session orpheline sans version publiée.
    const versionActive = await getVersionActive(supabase)
    if (!versionActive) {
      return NextResponse.json(
        {
          error:
            "Aucune version de questionnaire active. Publiez une version avant de générer un lien.",
        },
        { status: 422 }
      )
    }

    // 4. Création de la session en brouillon (canal portail_client)
    const session = await creerSession(
      {
        clientId,
        perimetre: perimetre ?? 'client_seul',
        type: sessionType,
        canal: 'portail_client',
        notes_conseiller,
      },
      supabase
    )
    createdSessionId = session.id

    // 5. Création du kyc_token lié à la session.
    // supabaseAdmin utilisé par cohérence avec le flux legacy (contournement RLS kyc_tokens).
    // contexte='maj_annuelle' : champ hérité du legacy — la sémantique réelle est portée
    // par collecte_sessions.type.
    const expiresAt = new Date(Date.now() + expiresInHours * 3_600_000).toISOString()
    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from('kyc_tokens')
      .insert({
        client_id: clientId,
        contexte: 'maj_annuelle',
        expires_at: expiresAt,
        collecte_session_id: session.id,
      })
      .select('id, token')
      .single()

    if (tokenErr || !tokenRow) {
      console.error('[collecte/liens] Échec création token', tokenErr)
      return NextResponse.json(
        {
          error: 'Erreur lors de la création du token',
          session_id: createdSessionId,
          recoverable: true,
          recovery: createdSessionId
            ? `La session est en statut brouillon. Relancez PATCH /api/collecte/sessions/${createdSessionId}/ouvrir après avoir résolu le problème.`
            : undefined,
        },
        { status: 500 }
      )
    }
    createdTokenId = tokenRow.id

    // 6. Liaison inverse : session → token (bidirectionnel requis par migration 007)
    const { error: linkErr } = await supabase
      .from('collecte_sessions')
      .update({ kyc_token_id: tokenRow.id })
      .eq('id', session.id)
    if (linkErr) {
      console.error('[collecte/liens] Échec liaison kyc_token_id', linkErr)
      // Non bloquant : le portail public retrouve la session via kyc_tokens.collecte_session_id.
      // La liaison inverse sera absente — à surveiller en monitoring.
    }

    // 7. Ouverture de la session : brouillon → en_cours
    // Capture le snapshot_prefill (10 tables référentiel) et lie questionnaire_version_id.
    // Le trigger trg_cs_set_dates (migration 014) renseigne date_ouverture = NOW().
    const { session: sessionOuverte } = await ouvrirSession(session.id, supabase)

    // 8. Mise à jour kyc_status du client si applicable
    await supabaseAdmin
      .from('clients')
      .update({ kyc_status: 'en_cours' })
      .eq('id', clientId)
      .in('kyc_status', ['non_fait', 'a_renouveler'])

    // 9. Log RGPD
    await supabaseAdmin.from('access_logs').insert({
      user_id: user.id,
      role: 'conseiller',
      action: 'collecte_lien_genere',
      resource: `client:${clientId}`,
    })

    // Usage interne CRM (copier/ouvrir) : tolère localhost et retombe sur une URL
    // relative si aucune base n'est configurée — le bouton reste fonctionnel en
    // développement, mais le conseiller est averti que le lien ne marchera pas par email.
    const lien = buildCollecteUrl(tokenRow.token, { allowLocalhost: true, fallbackRelative: true })

    return NextResponse.json(
      {
        token: tokenRow.token,
        url: lien.url,
        ...(lien.warning && { warning: lien.warning }),
        expires_at: expiresAt,
        session: sessionOuverte,
        client: { id: client.id, nom: client.nom, prenom: client.prenom },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[collecte/liens]', err)
    // Les erreurs réseau/fetch de @supabase/supabase-js (ex : échec TLS) ne sont
    // pas des instances d'Error mais des objets { message, details, hint, code }.
    // On extrait .message dans tous les cas pour ne jamais masquer la cause réelle
    // derrière un message générique.
    const message =
      err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erreur serveur')
    return NextResponse.json(
      {
        error: message,
        ...(createdSessionId && { session_id: createdSessionId }),
        ...(createdTokenId && { token_id: createdTokenId }),
        ...(createdSessionId && {
          recoverable: true,
          recovery: `La session est en statut brouillon. Relancez PATCH /api/collecte/sessions/${createdSessionId}/ouvrir après avoir résolu le problème.`,
        }),
      },
      { status: 500 }
    )
  }
}
