import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuestionnaireVersion } from '../types'

export async function getVersionActive(
  supabase: SupabaseClient
): Promise<QuestionnaireVersion | null> {
  const { data, error } = await supabase
    .from('questionnaire_versions')
    .select('*')
    .eq('actif', true)
    .maybeSingle()
  if (error) throw error
  return data as QuestionnaireVersion | null
}

export async function getVersionById(
  id: string,
  supabase: SupabaseClient
): Promise<QuestionnaireVersion> {
  const { data, error } = await supabase
    .from('questionnaire_versions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as QuestionnaireVersion
}

export async function getVersions(
  supabase: SupabaseClient
): Promise<QuestionnaireVersion[]> {
  const { data, error } = await supabase
    .from('questionnaire_versions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as QuestionnaireVersion[]
}
