// Erreurs métier du module Affaires + traduction PostgreSQL → HTTP.

export const AFFAIRE_CONFLICT = 'AFFAIRE_CONFLICT'

export class AffaireError extends Error {
  readonly status: number
  readonly code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AffaireError'
    this.status = status
    this.code = code
  }
}

export function isAffaireConflict(err: unknown): boolean {
  return err instanceof AffaireError && err.status === 409
}

// Forme minimale d'une erreur Supabase/PostgREST.
interface PgLikeError {
  message?: string
  code?: string
  details?: string
  hint?: string
}

// Traduction stable des erreurs métier PostgreSQL vers un AffaireError typé.
//   conflit           → 409 (AFFAIRE_CONFLICT)
//   non autorisé      → 403 (42501)
//   introuvable       → 404 (P0002)
//   données invalides → 400 (P0001, contraintes 23xxx, cast 22xxx)
//   inattendu         → 500
export function mapPgError(err: PgLikeError | null | undefined): AffaireError {
  const message = err?.message?.trim() || 'Erreur interne inattendue'
  const code = err?.code

  if (message.includes(AFFAIRE_CONFLICT)) return new AffaireError(AFFAIRE_CONFLICT, 409, code)
  if (code === '42501') return new AffaireError(message, 403, code)
  if (code === 'P0002') return new AffaireError(message, 404, code)
  if (
    code === 'P0001' ||
    (typeof code === 'string' && (code.startsWith('23') || code.startsWith('22')))
  ) {
    return new AffaireError(message, 400, code)
  }
  return new AffaireError(message, 500, code)
}

// Traduit toute exception en réponse { error, status } exploitable par une route.
export function toHttp(err: unknown): { error: string; status: number } {
  if (err instanceof AffaireError) return { error: err.message, status: err.status }
  const message = err instanceof Error ? err.message : 'Erreur interne inattendue'
  return { error: message, status: 500 }
}
