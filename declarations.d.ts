// Déclaration pour le sous-chemin interne de pdf-parse@1.1.1
// Utilisé à la place de l'index.js qui a un bug module.parent dans Node 14+
declare module 'pdf-parse/lib/pdf-parse.js' {
  import type { Options, Output } from 'pdf-parse'
  const pdfParse: (dataBuffer: Buffer, options?: Options) => Promise<Output>
  export default pdfParse
  export = pdfParse
}
