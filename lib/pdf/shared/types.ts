// Métadonnées communes à tous les templates de documents générés (KYC
// aujourd'hui ; bilan annuel, annexes ESG/LCB-FT demain). Assemblées par le
// service avant le rendu — chaque template les reçoit en plus de ses données
// métier propres (ex: SnapshotPrefill pour kyc_particulier).
export interface DocumentMeta {
  cabinetNom: string
  // Bloc de mentions légales complet, imprimé verbatim (ligne par ligne) en
  // pied de page — pas recomposé à partir de champs atomiques.
  mentionsLegales: string

  conseillerNom: string

  clientNomComplet: string
  clientCode: string | null

  numeroSequence: number
  genereLe: string
  // checksum_pdf n'est pas inclus ici : il ne peut être calculé qu'APRÈS le
  // rendu du PDF (il porte sur les octets du fichier final) — impossible de
  // l'imprimer à l'intérieur du document qu'il décrit. Seul checksum_source
  // (celui de la donnée, connu avant le rendu) est imprimable.
  checksumSource: string
  snapshotId: string
  sessionId: string | null
  versionSchema: string
  templateVersion: string

  modeSignature: 'manuscrite' | 'electronique'
}
