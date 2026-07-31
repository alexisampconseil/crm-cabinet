import { NextResponse } from 'next/server'

// Familles réglementaires : données système, lecture seule (aucune modification
// ni désactivation depuis l'interface).
const MESSAGE = 'Les familles réglementaires sont des données système du CRM et ne peuvent pas être modifiées depuis l’interface.'

export function PATCH() {
  return NextResponse.json({ error: MESSAGE }, { status: 403 })
}
