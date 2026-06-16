import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  QuestionnaireReponse,
  QuestionnaireReponseBloc,
  QuestionnaireReponseInput,
} from '../types'

export async function getReponsesBySession(
  sessionId: string,
  supabase: SupabaseClient
): Promise<QuestionnaireReponse[]> {
  const { data, error } = await supabase
    .from('questionnaire_reponses')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as QuestionnaireReponse[]
}

export async function getReponsesByBloc(
  sessionId: string,
  bloc: QuestionnaireReponseBloc,
  supabase: SupabaseClient
): Promise<QuestionnaireReponse[]> {
  const { data, error } = await supabase
    .from('questionnaire_reponses')
    .select('*')
    .eq('session_id', sessionId)
    .eq('bloc', bloc)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as QuestionnaireReponse[]
}

export async function getReponsesByGroupe(
  sessionId: string,
  groupeInstanceId: string,
  supabase: SupabaseClient
): Promise<QuestionnaireReponse[]> {
  const { data, error } = await supabase
    .from('questionnaire_reponses')
    .select('*')
    .eq('session_id', sessionId)
    .eq('groupe_instance_id', groupeInstanceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as QuestionnaireReponse[]
}

// Upsert via SELECT + INSERT/UPDATE en deux temps.
// Supabase JS ne supporte pas ON CONFLICT sur index UNIQUE partiels
// (idx_qr_unique_non_repeatable et idx_qr_unique_repeatable, migration 009).
// Le filtre IS NULL / = sur groupe_instance_id reproduit fidèlement la logique
// des deux index partiels : une réponse non-répétable ≠ une réponse répétable
// même si tous les autres champs sont identiques.
export async function upsertReponse(
  input: QuestionnaireReponseInput,
  supabase: SupabaseClient
): Promise<QuestionnaireReponse> {
  let selectQuery = supabase
    .from('questionnaire_reponses')
    .select('id')
    .eq('session_id', input.session_id)
    .eq('question_code', input.question_code)
    .eq('portee', input.portee)

  if (input.groupe_instance_id) {
    selectQuery = selectQuery.eq('groupe_instance_id', input.groupe_instance_id)
  } else {
    selectQuery = selectQuery.is('groupe_instance_id', null)
  }

  const { data: existing, error: selectError } = await selectQuery.maybeSingle()
  if (selectError) throw selectError

  if (existing) {
    const { data, error } = await supabase
      .from('questionnaire_reponses')
      .update({
        reponse_type: input.reponse_type,
        reponse_valeur: input.reponse_valeur ?? null,
        reponse_metadata: input.reponse_metadata ?? {},
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data as QuestionnaireReponse
  }

  const { data, error } = await supabase
    .from('questionnaire_reponses')
    .insert({
      session_id: input.session_id,
      bloc: input.bloc,
      question_code: input.question_code,
      portee: input.portee,
      groupe_instance_id: input.groupe_instance_id ?? null,
      reponse_type: input.reponse_type,
      reponse_valeur: input.reponse_valeur ?? null,
      reponse_metadata: input.reponse_metadata ?? {},
      questionnaire_version_id: input.questionnaire_version_id ?? null,
      version_questionnaire: input.version_questionnaire ?? null,
      saisi_par: input.saisi_par,
    })
    .select()
    .single()
  if (error) throw error
  return data as QuestionnaireReponse
}

export async function deleteReponse(
  id: string,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('questionnaire_reponses')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function deleteReponsesByGroupe(
  sessionId: string,
  groupeInstanceId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('questionnaire_reponses')
    .delete()
    .eq('session_id', sessionId)
    .eq('groupe_instance_id', groupeInstanceId)
  if (error) throw error
}
