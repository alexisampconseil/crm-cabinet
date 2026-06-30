import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DocumentGenere,
  DocumentTemplateCode,
  InsertDocumentGenereInput,
} from './types'

export async function getDocumentBySnapshotAndTemplate(
  snapshotId: string,
  templateCode: DocumentTemplateCode,
  supabase: SupabaseClient
): Promise<DocumentGenere | null> {
  const { data, error } = await supabase
    .from('documents_generes')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .eq('template_code', templateCode)
    .maybeSingle()
  if (error) throw error
  return data as DocumentGenere | null
}

export async function getDocumentById(
  id: string,
  supabase: SupabaseClient
): Promise<DocumentGenere | null> {
  const { data, error } = await supabase
    .from('documents_generes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as DocumentGenere | null
}

export async function getDocumentsByClient(
  clientId: string,
  supabase: SupabaseClient,
  templateCode?: DocumentTemplateCode
): Promise<DocumentGenere[]> {
  let query = supabase
    .from('documents_generes')
    .select('*')
    .eq('client_id', clientId)
    .order('genere_le', { ascending: false })
  if (templateCode) query = query.eq('template_code', templateCode)
  const { data, error } = await query
  if (error) throw error
  return data as DocumentGenere[]
}

// Fonde le calcul de numero_sequence — une étiquette d'affichage, jamais un
// identifiant technique (règle verrouillée). Pas de garantie transactionnelle
// stricte contre une course : protégé en dernier ressort par l'index unique
// (client_id, template_code, numero_sequence), qui ferait échouer un INSERT en
// double plutôt que de produire un doublon silencieux.
export async function countDocumentsForClientTemplate(
  clientId: string,
  templateCode: DocumentTemplateCode,
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from('documents_generes')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('template_code', templateCode)
  if (error) throw error
  return count ?? 0
}

export async function insertDocument(
  input: InsertDocumentGenereInput,
  supabase: SupabaseClient
): Promise<DocumentGenere> {
  const { data, error } = await supabase
    .from('documents_generes')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as DocumentGenere
}
