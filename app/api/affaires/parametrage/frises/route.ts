import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { requirePeutParametrer, parametrage, getFriseDetail, toHttp, nextVersionLabel } from '@/lib/affaires'

// POST /api/affaires/parametrage/frises — créer un brouillon de frise.
// Le conseiller choisit seulement la famille. Le numéro de version est généré,
// et si une frise est déjà publiée pour cette famille, sa structure est copiée
// dans le nouveau brouillon (« Créer une nouvelle version »).
const Schema = z.object({ famille_id: z.string().uuid() })

/* eslint-disable @typescript-eslint/no-explicit-any */
async function cloneStructure(supabase: SupabaseClient, sourceId: string, targetId: string, familleId: string) {
  const detail = await getFriseDetail(supabase, sourceId)
  if (!detail) return
  const idMap = new Map<string, string>()
  for (const e of detail.etapes as any[]) {
    const ne = await parametrage.addEtape(supabase, {
      frise_version_id: targetId, code: e.code, libelle: e.libelle, ordre: e.ordre,
      description: e.description ?? null, instructions: e.instructions ?? null,
      delai_indicatif_jours: e.delai_indicatif_jours ?? null,
      validation_manuelle: e.validation_manuelle, conditions_blocage: e.conditions_blocage ?? {},
    })
    idMap.set(e.id, (ne as any).id)
  }
  for (const t of detail.taches as any[]) {
    const et = idMap.get(t.etape_modele_id); if (!et) continue
    await parametrage.addTache(supabase, { frise_version_id: targetId, etape_modele_id: et, code: t.code, libelle: t.libelle, obligatoire: t.obligatoire, ordre: t.ordre })
  }
  for (const dcm of detail.documents as any[]) {
    const et = idMap.get(dcm.etape_modele_id); if (!et) continue
    await parametrage.addDocument(supabase, { frise_version_id: targetId, etape_modele_id: et, code: dcm.code, libelle: dcm.libelle, type_document: dcm.type_document ?? null, obligatoire: dcm.obligatoire, ordre: dcm.ordre })
  }
  for (const c of detail.controles as any[]) {
    const et = idMap.get(c.etape_modele_id); if (!et) continue
    await parametrage.addControle(supabase, { frise_version_id: targetId, etape_modele_id: et, code: c.code, libelle: c.libelle, type_controle: c.type_controle ?? null, obligatoire: c.obligatoire, ordre: c.ordre })
  }
  for (const ch of detail.champs as any[]) {
    await parametrage.addChampDef(supabase, {
      frise_version_id: targetId, famille_id: familleId, portee: ch.portee, type_id: ch.type_id ?? null,
      code: ch.code, libelle: ch.libelle, type_donnee: ch.type_donnee, obligatoire: ch.obligatoire,
      ordre: ch.ordre, regles_validation: ch.regles_validation ?? {},
    })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  try {
    await requirePeutParametrer(supabase)
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Sélectionnez une famille.', field: 'famille_id' }, { status: 400 })
    const { famille_id } = parsed.data

    const { data: versions, error } = await supabase.from('frise_versions')
      .select('id, version, statut, actif').eq('famille_id', famille_id)
    if (error) throw error
    const rows = versions ?? []

    if (rows.some((v) => v.statut === 'brouillon')) {
      return NextResponse.json({ error: 'Un brouillon existe déjà pour cette famille. Modifiez-le ou publiez-le avant d’en créer un autre.' }, { status: 409 })
    }

    const version = nextVersionLabel(rows.map((v) => v.version as string))
    const brouillon = await parametrage.createFriseBrouillon(supabase, { famille_id, version })

    const source = rows.find((v) => v.actif && v.statut === 'publie') ?? rows.find((v) => v.statut === 'publie')
    if (source) await cloneStructure(supabase, source.id as string, (brouillon as any).id as string, famille_id)

    return NextResponse.json(brouillon, { status: 201 })
  } catch (err) {
    const { error, status } = toHttp(err)
    return NextResponse.json({ error }, { status })
  }
}
