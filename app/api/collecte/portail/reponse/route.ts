import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSession, getVersionById, upsertReponse } from '@/lib/collecte'

// Codes valides — alignés avec les CHECK constraints de migration 009
const BLOCS = [
  'identite', 'foyer', 'situation_pro', 'revenus', 'charges',
  'actifs_financiers', 'immobilier', 'passifs', 'fiscalite', 'prevoyance', 'objectifs',
] as const

const TYPES   = ['texte', 'nombre', 'date', 'booleen', 'liste', 'multi_liste'] as const
const PORTEES = ['client', 'conjoint', 'foyer'] as const

const PayloadSchema = z.object({
  kyc_token:          z.string().min(1, 'kyc_token requis'),
  bloc:               z.enum(BLOCS),
  question_code:      z.string().min(1, 'question_code requis'),
  portee:             z.enum(PORTEES),
  groupe_instance_id: z.string().uuid('groupe_instance_id doit être un UUID valide').nullable().optional(),
  reponse_type:       z.enum(TYPES),
  reponse_valeur:     z.string().nullable().optional(),
  reponse_metadata:   z.record(z.string(), z.unknown()).optional(),
})

// POST /api/collecte/portail/reponse
// Sauvegarde progressive d'une réponse client (un champ à la fois).
// Authentification : kyc_token uniquement — le client n'a pas de session Supabase Auth.
// session_id dérivé côté serveur depuis kyc_tokens.collecte_session_id (anti-IDOR).
// Écrit uniquement dans questionnaire_reponses.
// Ne touche jamais : collecte_sessions.statut, kyc_tokens.used_at, session_ecarts.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const parsed = PayloadSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  const {
    kyc_token,
    bloc,
    question_code,
    portee,
    groupe_instance_id,
    reponse_type,
    reponse_valeur,
    reponse_metadata,
  } = parsed.data

  // ── 1. Vérification du token ──────────────────────────────────────────────
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('kyc_tokens')
    .select('id, used_at, expires_at, collecte_session_id')
    .eq('token', kyc_token)
    .maybeSingle()

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'Token invalide ou introuvable' }, { status: 401 })
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'Ce lien a déjà été utilisé' }, { status: 410 })
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expiré — contactez votre conseiller' }, { status: 410 })
  }
  if (!tokenRow.collecte_session_id) {
    return NextResponse.json({ error: 'Aucune session de collecte associée à ce lien' }, { status: 409 })
  }

  // session_id est dérivé du token côté serveur — le client ne peut pas l'écraser
  const sessionId = tokenRow.collecte_session_id

  // ── 2. Vérification de la session ─────────────────────────────────────────
  let session
  try {
    session = await getSession(sessionId, supabaseAdmin)
  } catch {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  if (session.statut !== 'en_cours') {
    return NextResponse.json(
      { error: `La session est verrouillée (statut : ${session.statut}) — aucune modification autorisée` },
      { status: 409 }
    )
  }

  if (!session.questionnaire_version_id) {
    return NextResponse.json(
      { error: 'Aucune version de questionnaire liée à cette session' },
      { status: 500 }
    )
  }

  // ── 3. Validation de la structure du questionnaire ────────────────────────
  let qv
  try {
    qv = await getVersionById(session.questionnaire_version_id, supabaseAdmin)
  } catch {
    return NextResponse.json({ error: 'Version du questionnaire introuvable' }, { status: 500 })
  }

  const blocObj = qv.structure.blocs.find(b => b.code === bloc)
  if (!blocObj) {
    return NextResponse.json(
      { error: `Bloc "${bloc}" inconnu dans la version ${qv.version} du questionnaire` },
      { status: 422 }
    )
  }

  const questionObj = blocObj.questions.find(q => q.code === question_code && q.portee === portee)
  if (!questionObj) {
    return NextResponse.json(
      { error: `Question "${question_code}" introuvable avec portée "${portee}" dans le bloc "${bloc}"` },
      { status: 422 }
    )
  }

  if (questionObj.type !== reponse_type) {
    return NextResponse.json(
      { error: `Type incorrect pour "${question_code}" : attendu "${questionObj.type}", reçu "${reponse_type}"` },
      { status: 422 }
    )
  }

  // ── 4. Cohérence groupe_instance_id ───────────────────────────────────────
  if (questionObj.repete && !groupe_instance_id) {
    return NextResponse.json(
      { error: `groupe_instance_id UUID obligatoire pour "${question_code}" (repete: true)` },
      { status: 422 }
    )
  }
  if (!questionObj.repete && groupe_instance_id) {
    return NextResponse.json(
      { error: `groupe_instance_id non attendu pour "${question_code}" (repete: false)` },
      { status: 422 }
    )
  }

  // ── 5. Upsert dans questionnaire_reponses ─────────────────────────────────
  // Aucun effet de bord : statut session inchangé, used_at inchangé, 0 écart généré.
  try {
    const reponse = await upsertReponse(
      {
        session_id:               sessionId,
        bloc,
        question_code,
        portee,
        groupe_instance_id:       groupe_instance_id ?? null,
        reponse_type,
        reponse_valeur:           reponse_valeur ?? null,
        reponse_metadata:         reponse_metadata ?? {},
        questionnaire_version_id: session.questionnaire_version_id,
        version_questionnaire:    qv.version,
        saisi_par:                'client',
      },
      supabaseAdmin
    )

    return NextResponse.json({ id: reponse.id }, { status: 200 })
  } catch (err) {
    console.error('[portail/reponse]', err)
    const message = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
