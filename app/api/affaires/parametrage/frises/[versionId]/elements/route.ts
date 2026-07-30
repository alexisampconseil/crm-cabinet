import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp } from '@/lib/affaires'

const KIND = ['etape', 'tache', 'document', 'controle', 'champ'] as const
const Schema = z.object({
  kind: z.enum(KIND),
  values: z.record(z.string(), z.unknown()),
})

// POST /api/affaires/parametrage/frises/:versionId/elements — ajouter un élément
// (étape / tâche / document / contrôle / champ) à une version de frise en brouillon.
export async function POST(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    const { kind, values } = parsed.data
    const base = { ...values, frise_version_id: versionId }

    let row: unknown
    switch (kind) {
      case 'etape': row = await parametrage.addEtape(supabase, base); break
      case 'tache': row = await parametrage.addTache(supabase, base); break
      case 'document': row = await parametrage.addDocument(supabase, base); break
      case 'controle': row = await parametrage.addControle(supabase, base); break
      case 'champ': {
        // La FK composite exige famille_id cohérent avec la version.
        const { data: v } = await supabase.from('frise_versions').select('famille_id').eq('id', versionId).maybeSingle()
        if (!v) return NextResponse.json({ error: 'Version introuvable' }, { status: 404 })
        row = await parametrage.addChampDef(supabase, { ...base, famille_id: v.famille_id })
        break
      }
    }
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
