// Surface publique du module Documents générés (archive documentaire
// réglementaire). Importer depuis '@/lib/documents-generes' plutôt que depuis
// les sous-modules directement.

export type {
  DocumentTemplateCode,
  DocumentModeSignature,
  DocumentGenere,
  InsertDocumentGenereInput,
  CabinetConfig,
  GenererDocumentResult,
} from './types'

export { genererEtArchiverDocument } from './service'

export {
  getDocumentBySnapshotAndTemplate,
  getDocumentById,
  getDocumentsByClient,
  countDocumentsForClientTemplate,
} from './repository'

export { getCabinetConfig } from './cabinet-config'
