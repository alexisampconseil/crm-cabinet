import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp } from '@/lib/affaires'

type Kind = 'etape' | 'tache' | 'document' | 'controle' | 'champ'
const UPDATERS = {
  etape: parametrage.updateEtape, tache: parametrage.updateTache, document: parametrage.updateDocument,
  controle: parametrage.updateControle, champ: parametrage.updateChampDef,
} as const
const DELETERS = {
  etape: parametrage.deleteEtape, tache: parametrage.deleteTache, document: parametrage.deleteDocument,
  controle: parametrage.deleteControle, champ: parametrage.deleteChampDef,
} as const

function isKind(k: string): k is Kind {
  return k === 'etape' || k === 'tache' || k === 'document' || k === 'controle' || k === 'champ'
}

// PATCH — modifier un élément de frise (brouillon uniquement, enforced par trigger)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string; kind: string; elementId: string }> }
) {
  const { kind, elementId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    if (!isKind(kind)) return NextResponse.json({ error: 'Type d’élément invalide' }, { status: 400 })
    const parsed = z.record(z.string(), z.unknown()).safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const row = await UPDATERS[kind](supabase, elementId, parsed.data)
    return NextResponse.json(row)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}

// DELETE — supprimer un élément de frise (brouillon uniquement)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ versionId: string; kind: string; elementId: string }> }
) {
  const { kind, elementId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    if (!isKind(kind)) return NextResponse.json({ error: 'Type d’élément invalide' }, { status: 400 })
    const row = await DELETERS[kind](supabase, elementId)
    return NextResponse.json(row)
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
