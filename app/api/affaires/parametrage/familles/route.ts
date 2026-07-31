import { NextResponse } from 'next/server'

// Les familles réglementaires sont des données système du CRM : lecture seule.
// Écritures désactivées (création interdite depuis l'interface).
const MESSAGE = 'Les familles réglementaires sont des données système du CRM et ne peuvent pas être créées ni modifiées depuis l’interface.'

export function POST() {
  return NextResponse.json({ error: MESSAGE }, { status: 403 })
}
