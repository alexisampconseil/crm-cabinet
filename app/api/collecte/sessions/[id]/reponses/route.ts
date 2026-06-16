import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { getSession, getReponsesBySession, upsertReponse } from '@/lib/collecte'

const BLOCS = [
  'identite', 'foyer', 'situation_pro', 'revenus', 'charges',
  'actifs_financiers', 'immobilier', 'passifs', 'fiscalite', 'prevoyance', 'objectifs',
] as const

const TYPES = ['texte', 'nombre', 'date', 'booleen', 'liste', 'multi_liste'] as const
const PORTEES = ['client', 'conjoint', 'foyer'] as const
const SAISI_PAR = ['client', 'conseiller'] as const

const ReponseSchema = z.object({
  bloc: z.enum(BLOCS),
  question_code: z.string().min(1, 'question_code requis'),
  portee: z.enum(PORTEES),
  groupe_instance_id: z.string().uuid().nullable().optional(),
  reponse_type: z.enum(TYPES),
  reponse_valeur: z.string().nullable().optional(),
  reponse_metadata: z.record(z.string(), z.unknown()).optional(),
  questionnaire_version_id: z.string().uuid().nullable().optional(),
  version_questionnaire: z.string().nullable().optional(),
  saisi_par: z.enum(SAISI_PAR),
})

// GET /api/collecte/sessions/:id/reponses — toutes les réponses d'une session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const reponses = await getReponsesBySession(id, supabase)
    return NextResponse.json(reponses)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la récupération des réponses'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// POST /api/collecte/sessions/:id/reponses — créer ou mettre à jour une réponse
// La session doit être en statut brouillon ou en_cours.
// Le session_id est toujours pris depuis l'URL (le corps ne peut pas l'écraser).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const parsed = ReponseSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  // Vérification statut session avant toute écriture
  let session
  try {
    session = await getSession(sessionId, supabase)
  } catch {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  if (!['brouillon', 'en_cours'].includes(session.statut)) {
    return NextResponse.json(
      { error: `La session est verrouillée (statut : ${session.statut}) — aucune modification après soumission` },
      { status: 409 }
    )
  }

  try {
    const reponse = await upsertReponse(
      { ...parsed.data, session_id: sessionId },
      supabase
    )
    return NextResponse.json(reponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde de la réponse'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
