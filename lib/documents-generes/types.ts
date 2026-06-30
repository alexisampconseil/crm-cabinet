// =============================================================================
// Types TypeScript — module Documents générés (archive documentaire
// réglementaire). Couvre documents_generes et cabinet_config.
// =============================================================================

// ── documents_generes ──────────────────────────────────────────────────────────

// Aujourd'hui une seule valeur (règle verrouillée : source exclusive du KYC V1
// = patrimoine_snapshot). L'union grandira avec de nouveaux modèles de document
// (bilan_annuel, esg_annexe…) qui restent basés sur un snapshot — l'ajout d'un
// second type de SOURCE FK (ex: esg_profils) est un sujet de migration distinct,
// documenté dans 018_documents_generes.sql.
export type DocumentTemplateCode = 'kyc_particulier'

export type DocumentModeSignature = 'manuscrite' | 'electronique'

export interface DocumentGenere {
  id: string
  client_id: string
  snapshot_id: string
  session_id: string | null
  template_code: DocumentTemplateCode
  template_version: string
  version_schema: string
  numero_sequence: number
  storage_path: string
  checksum_pdf: string
  checksum_source: string
  taille_octets: number
  cabinet_nom: string
  conseiller_nom: string
  genere_par: string | null
  genere_le: string
  mode_signature: DocumentModeSignature
  signe_client_le: string | null
  signe_conseiller_le: string | null
  created_at: string
}

export interface InsertDocumentGenereInput {
  client_id: string
  snapshot_id: string
  session_id: string | null
  template_code: DocumentTemplateCode
  template_version: string
  version_schema: string
  numero_sequence: number
  storage_path: string
  checksum_pdf: string
  checksum_source: string
  taille_octets: number
  cabinet_nom: string
  conseiller_nom: string
  genere_par: string | null
  genere_le: string
}

// ── cabinet_config ──────────────────────────────────────────────────────────────

export interface CabinetConfig {
  id: string
  raison_sociale: string
  // Bloc de mentions légales complet, imprimé verbatim en pied de page —
  // formulation juridique arrêtée par le cabinet, pas recomposée à partir de
  // champs atomiques (cf. migration 019).
  mentions_legales: string
}

// ── Service ──────────────────────────────────────────────────────────────────────

export interface GenererDocumentResult {
  document: DocumentGenere
  // true si l'idempotence (règle verrouillée) a réutilisé un document existant
  // pour (snapshot_id, template_code) plutôt que d'en générer un nouveau.
  reused: boolean
}
