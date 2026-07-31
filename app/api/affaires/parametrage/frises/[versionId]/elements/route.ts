import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, toHttp, uniqueCode, nextOrdre } from '@/lib/affaires'

const KIND = ['etape', 'tache', 'document', 'controle', 'champ'] as const
const TYPES_DONNEE = ['texte', 'nombre', 'montant', 'booleen', 'date', 'enum'] as const

const Schema = z.object({
  kind: z.enum(KIND),
  values: z.record(z.string(), z.unknown()),
})

// POST /api/affaires/parametrage/frises/:versionId/elements
// Ajoute un élément (étape / action / document / contrôle / information) à une
// version en brouillon. Le conseiller ne fournit que le libellé (+ options) ;
// le code et l'ordre sont générés automatiquement.
export async function POST(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
    const { kind, values } = parsed.data

    const libelle = String(values.libelle ?? '').trim()
    if (!libelle) return NextResponse.json({ error: 'Le libellé est obligatoire.', field: 'libelle' }, { status: 400 })
    const obligatoire = values.obligatoire !== false

    let row: unknown
    if (kind === 'etape') {
      const { data: ex, error } = await supabase.from('frise_etapes_modele')
        .select('code, ordre').eq('frise_version_id', versionId)
      if (error) throw error
      row = await parametrage.addEtape(supabase, {
        frise_version_id: versionId, libelle,
        code: uniqueCode(libelle, (ex ?? []).map((r) => r.code as string)),
        ordre: nextOrdre((ex ?? []).map((r) => r.ordre as number)),
      })
    } else if (kind === 'tache' || kind === 'document' || kind === 'controle') {
      const etapeId = String(values.etape_modele_id ?? '')
      if (!etapeId) return NextResponse.json({ error: 'Étape cible manquante.' }, { status: 400 })
      const table = kind === 'tache' ? 'frise_taches_modele'
        : kind === 'document' ? 'frise_documents_modele' : 'frise_controles_modele'
      const { data: ex, error } = await supabase.from(table)
        .select('code, ordre').eq('etape_modele_id', etapeId)
      if (error) throw error
      const base = {
        frise_version_id: versionId, etape_modele_id: etapeId, libelle, obligatoire,
        code: uniqueCode(libelle, (ex ?? []).map((r) => r.code as string)),
        ordre: nextOrdre((ex ?? []).map((r) => r.ordre as number)),
      }
      row = kind === 'tache' ? await parametrage.addTache(supabase, base)
        : kind === 'document' ? await parametrage.addDocument(supabase, base)
        : await parametrage.addControle(supabase, base)
    } else {
      // champ (information à renseigner)
      const portee = values.portee === 'type' ? 'type' : 'famille'
      const type_id = portee === 'type' ? (String(values.type_id ?? '') || null) : null
      if (portee === 'type' && !type_id) {
        return NextResponse.json({ error: 'Sélectionnez un type d’affaire pour restreindre l’information.', field: 'type_id' }, { status: 400 })
      }
      const rawType = String(values.type_donnee ?? 'texte')
      const type_donnee = (TYPES_DONNEE as readonly string[]).includes(rawType) ? rawType : 'texte'
      const { data: v } = await supabase.from('frise_versions').select('famille_id').eq('id', versionId).maybeSingle()
      if (!v) return NextResponse.json({ error: 'Version de frise introuvable.' }, { status: 404 })
      const { data: ex, error } = await supabase.from('affaire_champ_defs')
        .select('code, ordre').eq('frise_version_id', versionId)
      if (error) throw error
      row = await parametrage.addChampDef(supabase, {
        frise_version_id: versionId, famille_id: v.famille_id, portee, type_id,
        libelle, type_donnee, obligatoire: values.obligatoire === true,
        code: uniqueCode(libelle, (ex ?? []).map((r) => r.code as string)),
        ordre: nextOrdre((ex ?? []).map((r) => r.ordre as number)),
      })
    }
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
