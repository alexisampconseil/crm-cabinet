import { NextResponse } from 'next/server'

// Motifs d'archivage : liste système, lecture seule (aucune modification depuis
// l'interface).
const MESSAGE = 'Les motifs d’archivage sont une liste système du CRM et ne peuvent pas être modifiés depuis l’interface.'

export function PATCH() {
  return NextResponse.json({ error: MESSAGE }, { status: 403 })
}
