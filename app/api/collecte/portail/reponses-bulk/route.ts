import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSession, upsertReponse } from '@/lib/collecte'
import type { QuestionnaireReponseInput } from '@/lib/collecte'

// POST /api/collecte/portail/reponses-bulk
//
// Soumission groupée des réponses pour un ensemble de blocs confirmés
// "inchangés" dans le parcours de mise à jour annuelle simplifiée.
// Utilisée en remplacement de N appels séquentiels vers /portail/reponse
// pour éviter un délai perceptible lors de la validation finale.
//
// Authentification : kyc_token uniquement (même logique que /portail/reponse).
// Différence avec /portail/reponse :
//   - Accepte un tableau de réponses en une seule requête HTTP.
//   - Pas de validation structure questionnaire (les valeurs proviennent du
//     snapshot_prefill généré serveur-side, pas d'une saisie utilisateur libre).
//   - Toutes les upserts sont exécutées en parallèle.
//
// Plafond anti-abus : refusé si le tableau dépasse 200 items.

interface BulkReponseItem {
  bloc: string
  question_code: string
  portee: string
  groupe_instance_id: string | null
  reponse_type: string
  reponse_valeur: string | null
  reponse_metadata: Record<string, unknown>
}

interface BulkPayload {
  kyc_token: string
  reponses: BulkReponseItem[]
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as BulkPayload | null
  if (!body?.kyc_token || !Array.isArray(body?.reponses)) {
    return NextResponse.json(
      { error: 'Corps invalide — kyc_token et reponses[] requis' },
      { status: 400 }
    )
  }
  if (body.reponses.length > 200) {
    return NextResponse.json({ error: 'Trop de réponses (max 200)' }, { status: 422 })
  }

  // ── Vérification du token ──────────────────────────────────────────────────
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('kyc_tokens')
    .select('id, used_at, expires_at, collecte_session_id')
    .eq('token', body.kyc_token)
    .maybeSingle()

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'Token invalide ou introuvable' }, { status: 401 })
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'Ce lien a déjà été utilisé' }, { status: 410 })
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expiré' }, { status: 410 })
  }
  if (!tokenRow.collecte_session_id) {
    return NextResponse.json({ error: 'Aucune session associée' }, { status: 409 })
  }

  const sessionId = tokenRow.collecte_session_id

  // ── Vérification de la session ─────────────────────────────────────────────
  let session
  try {
    session = await getSession(sessionId, supabaseAdmin)
  } catch {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }
  if (session.statut !== 'en_cours') {
    return NextResponse.json(
      { error: `Session verrouillée (statut : ${session.statut})` },
      { status: 409 }
    )
  }
  if (!session.questionnaire_version_id) {
    return NextResponse.json({ error: 'Aucune version de questionnaire' }, { status: 500 })
  }

  // ── Upsert en parallèle ────────────────────────────────────────────────────
  const inputs: QuestionnaireReponseInput[] = body.reponses.map(r => ({
    session_id:          sessionId,
    bloc:                r.bloc as QuestionnaireReponseInput['bloc'],
    question_code:       r.question_code,
    portee:              r.portee as QuestionnaireReponseInput['portee'],
    groupe_instance_id:  r.groupe_instance_id ?? undefined,
    reponse_type:        r.reponse_type as QuestionnaireReponseInput['reponse_type'],
    reponse_valeur:      r.reponse_valeur ?? null,
    reponse_metadata:    r.reponse_metadata,
    questionnaire_version_id: session.questionnaire_version_id ?? undefined,
    saisi_par:           'client',
  }))

  const results = await Promise.allSettled(
    inputs.map(input => upsertReponse(input, supabaseAdmin))
  )

  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    return NextResponse.json(
      { error: `${failed.length} réponse(s) n'ont pas pu être enregistrées`, saved: results.length - failed.length },
      { status: 207 }
    )
  }

  return NextResponse.json({ saved: results.length })
}
