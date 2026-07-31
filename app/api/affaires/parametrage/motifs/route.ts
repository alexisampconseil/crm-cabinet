import { NextResponse } from 'next/server'

// Motifs d'archivage : liste système prédéfinie, lecture seule. Écritures
// désactivées (aucune création depuis l'interface).
const MESSAGE = 'Les motifs d’archivage sont une liste système du CRM et ne peuvent pas être créés ni modifiés depuis l’interface.'

export function POST() {
  return NextResponse.json({ error: MESSAGE }, { status: 403 })
}
