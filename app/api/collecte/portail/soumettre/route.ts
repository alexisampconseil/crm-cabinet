import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSession, updateStatut, detecterEcarts } from '@/lib/collecte'
import type { DetectionResult } from '@/lib/collecte'

const PayloadSchema = z.object({
  kyc_token: z.string().min(1, 'kyc_token requis'),
})

// POST /api/collecte/portail/soumettre
// Soumet définitivement le questionnaire client.
// Payload minimal : { kyc_token } — session_id dérivé côté serveur.
//
// Idempotence : si statut = 'soumis', retourne 200 immédiatement.
// used_at non vérifié à l'entrée pour permettre l'idempotence (retry réseau).
//
// Écritures réalisées :
//   1. collecte_sessions.statut = 'soumis'
//      (le trigger trg_cs_set_dates remplit date_soumission automatiquement)
//   2. kyc_tokens.used_at = NOW()
//   3. access_logs (RGPD)
//
// Écritures explicitement absentes :
//   - session_ecarts  (Phase 5)
//   - statut 'en_revue' (Phase 5)
//   - référentiel métier (famille, actifs_financiers, etc.)
//   - patrimoine_snapshots
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const parsed = PayloadSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  const { kyc_token } = parsed.data

  // ── 1. Vérification du token ──────────────────────────────────────────────
  // used_at délibérément non vérifié ici : l'idempotence est garantie par le
  // check de statut (§2). Un retry après used_at posé passerait ce check et
  // retournerait 200 grâce à la branche statut='soumis'.
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('kyc_tokens')
    .select('id, expires_at, collecte_session_id')
    .eq('token', kyc_token)
    .maybeSingle()

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'Token invalide ou introuvable' }, { status: 401 })
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expiré — contactez votre conseiller' }, { status: 410 })
  }
  if (!tokenRow.collecte_session_id) {
    return NextResponse.json({ error: 'Aucune session de collecte associée à ce lien' }, { status: 409 })
  }

  const sessionId = tokenRow.collecte_session_id

  // ── 2. Vérification session + idempotence ─────────────────────────────────
  let session
  try {
    session = await getSession(sessionId, supabaseAdmin)
  } catch {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  // Idempotence : déjà soumis → succès immédiat (double-click, retry réseau)
  if (session.statut === 'soumis') {
    return NextResponse.json({ submitted: true, alreadySubmitted: true }, { status: 200 })
  }

  if (session.statut !== 'en_cours') {
    return NextResponse.json(
      { error: `La session est verrouillée (statut : ${session.statut})` },
      { status: 409 }
    )
  }

  if (!session.questionnaire_version_id) {
    return NextResponse.json(
      { error: 'Aucune version de questionnaire liée à cette session' },
      { status: 500 }
    )
  }

  // ── 3. Minimum de réponses sauvegardées ───────────────────────────────────
  const { count, error: countError } = await supabaseAdmin
    .from('questionnaire_reponses')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .not('reponse_valeur', 'is', null)

  if (countError) {
    return NextResponse.json(
      { error: 'Erreur lors de la vérification des réponses' },
      { status: 500 }
    )
  }
  if ((count ?? 0) === 0) {
    return NextResponse.json(
      { error: 'Aucune réponse sauvegardée — remplissez au moins un champ avant de soumettre' },
      { status: 422 }
    )
  }

  // ── 4. Transition en_cours → soumis ──────────────────────────────────────
  // Le trigger trg_cs_set_dates (migration 014 §14a) renseigne date_soumission.
  try {
    await updateStatut(sessionId, 'soumis', supabaseAdmin)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la soumission'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── 5. Marquage du token utilisé (après transition — ordre intentionnel) ──
  // Si cette étape échoue, la session est déjà 'soumis'. Un retry retournera
  // 200 via la branche idempotente §2, puis retente cette mise à jour.
  await supabaseAdmin
    .from('kyc_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', kyc_token)

  // ── 6. Log RGPD ───────────────────────────────────────────────────────────
  await supabaseAdmin.from('access_logs').insert({
    action:   'collecte_soumise',
    resource: `client:${session.client_id}`,
    role:     'anon',
  })

  // ── 7. Détection automatique des écarts ───────────────────────────────────
  // Encapsulée dans un try/catch : un échec de détection ne remet pas en cause
  // la soumission (statut déjà 'soumis'). La relance manuelle est disponible
  // via PATCH /api/collecte/sessions/:id/detecter-ecarts (route conseiller).
  let detection: DetectionResult = { nb_ecarts: 0, statut_final: 'session_invalide' }
  try {
    detection = await detecterEcarts(sessionId, supabaseAdmin)
  } catch (err) {
    console.error('[portail/soumettre] Erreur détection écarts — soumission préservée', err)
  }

  return NextResponse.json(
    {
      submitted:     true,
      nb_ecarts:     detection.nb_ecarts,
      statut_final:  detection.statut_final,
    },
    { status: 200 }
  )
}
