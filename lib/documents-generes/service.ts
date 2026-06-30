import 'server-only'
import { randomUUID, createHash } from 'crypto'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SnapshotPrefill } from '@/lib/collecte'
import type { DocumentMeta } from '@/lib/pdf/shared/types'
import { TEMPLATE_REGISTRY } from './registry'
import { getCabinetConfig } from './cabinet-config'
import {
  getDocumentBySnapshotAndTemplate,
  countDocumentsForClientTemplate,
  insertDocument,
} from './repository'
import type { DocumentTemplateCode, GenererDocumentResult } from './types'

const BUCKET = 'documents-generes'

interface SnapshotRow {
  id: string
  client_id: string
  session_id: string | null
  statut: string
  version_schema: string
  checksum: string | null
  snapshot: SnapshotPrefill
}

// Source exclusive du V1 (règle verrouillée) : patrimoine_snapshots finalisé.
// Jamais le référentiel live. Le statut n'est pas garanti par la FK seule —
// vérifié explicitement avant tout rendu.
async function loadFinaliseSnapshot(
  snapshotId: string,
  supabase: SupabaseClient
): Promise<SnapshotRow> {
  const { data, error } = await supabase
    .from('patrimoine_snapshots')
    .select('id, client_id, session_id, statut, version_schema, checksum, snapshot')
    .eq('id', snapshotId)
    .single()
  if (error) throw error
  const row = data as SnapshotRow
  if (row.statut !== 'finalise') {
    throw new Error(
      `Le snapshot ${snapshotId} n'est pas finalisé (statut actuel : ${row.statut}) — ` +
      "un document généré ne peut être produit qu'à partir d'un snapshot finalisé."
    )
  }
  if (!row.checksum) {
    throw new Error(
      `Le snapshot ${snapshotId} finalisé n'a pas de checksum — incohérence de données.`
    )
  }
  return row
}

// Nécessite un client supabase service_role (auth.admin n'est accessible
// qu'avec la clé service role) — cohérent avec l'appel depuis appliquer-ecarts.
async function resolveConseillerNom(
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) return 'Conseiller'
  const meta = data.user.user_metadata as Record<string, unknown> | null
  const fullName = meta && typeof meta.full_name === 'string' ? meta.full_name : null
  return fullName ?? data.user.email ?? 'Conseiller'
}

async function resolveClientIdentite(
  clientId: string,
  supabase: SupabaseClient
): Promise<{ nomComplet: string; code: string | null }> {
  const { data, error } = await supabase
    .from('clients')
    .select('nom, prenom, code')
    .eq('id', clientId)
    .single()
  if (error) throw error
  return {
    nomComplet: [data.prenom, data.nom].filter(Boolean).join(' '),
    code: data.code ?? null,
  }
}

// Point d'entrée unique du module. Idempotent par (snapshot_id, template_code) —
// règle verrouillée : un même couple ne produit jamais deux documents distincts.
export async function genererEtArchiverDocument(
  snapshotId: string,
  templateCode: DocumentTemplateCode,
  userId: string,
  supabase: SupabaseClient
): Promise<GenererDocumentResult> {
  const existing = await getDocumentBySnapshotAndTemplate(snapshotId, templateCode, supabase)
  if (existing) {
    return { document: existing, reused: true }
  }

  const templateEntry = TEMPLATE_REGISTRY[templateCode]
  if (!templateEntry) {
    throw new Error(`Aucun template enregistré pour template_code='${templateCode}'`)
  }

  const snapshotRow = await loadFinaliseSnapshot(snapshotId, supabase)

  const [cabinet, conseillerNom, clientIdentite, nbDocumentsExistants] = await Promise.all([
    getCabinetConfig(supabase),
    resolveConseillerNom(userId, supabase),
    resolveClientIdentite(snapshotRow.client_id, supabase),
    countDocumentsForClientTemplate(snapshotRow.client_id, templateCode, supabase),
  ])

  const numeroSequence = nbDocumentsExistants + 1
  const genereLe = new Date().toISOString()

  const meta: DocumentMeta = {
    cabinetNom: cabinet.raison_sociale,
    mentionsLegales: cabinet.mentions_legales,
    conseillerNom,
    clientNomComplet: clientIdentite.nomComplet,
    clientCode: clientIdentite.code,
    numeroSequence,
    genereLe,
    checksumSource: snapshotRow.checksum as string,
    snapshotId: snapshotRow.id,
    sessionId: snapshotRow.session_id,
    versionSchema: snapshotRow.version_schema,
    templateVersion: templateEntry.version,
    modeSignature: 'manuscrite',
  }

  const element = templateEntry.render(snapshotRow.snapshot, meta)
  const buffer = await renderToBuffer(element)
  const checksumPdf = createHash('sha256').update(buffer).digest('hex')
  const storagePath = `${templateCode}/${snapshotRow.client_id}/${randomUUID()}.pdf`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf' })
  if (uploadError) {
    throw new Error(`Échec upload Storage du document généré : ${uploadError.message}`)
  }

  try {
    const document = await insertDocument(
      {
        client_id: snapshotRow.client_id,
        snapshot_id: snapshotRow.id,
        session_id: snapshotRow.session_id,
        template_code: templateCode,
        template_version: templateEntry.version,
        version_schema: snapshotRow.version_schema,
        numero_sequence: numeroSequence,
        storage_path: storagePath,
        checksum_pdf: checksumPdf,
        checksum_source: snapshotRow.checksum as string,
        taille_octets: buffer.length,
        cabinet_nom: meta.cabinetNom,
        conseiller_nom: conseillerNom,
        genere_par: userId,
        genere_le: genereLe,
      },
      supabase
    )
    return { document, reused: false }
  } catch (insertError) {
    // L'INSERT a échoué (ex: course sur l'index unique d'idempotence) : le
    // fichier déjà uploadé devient orphelin — on le retire pour ne pas
    // polluer le bucket avec un document non référencé en base.
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw insertError
  }
}
