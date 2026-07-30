'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, cardBase, statusBadge } from '@/lib/design-tokens'
import { api, StateMsg } from './lib'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Compact { id: string; libelle: string; type: string; progression: number; etape: string | null; bloque: boolean }

export default function AffairesEnCoursBloc({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Compact[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const [a, r] = await Promise.all([
          api<{ affaires: any[] }>(`/api/affaires?clientId=${clientId}`),
          api<{ types: any[] }>(`/api/affaires/referentiel`),
        ])
        const typeLabel = new Map<string, string>((r.types ?? []).map((t) => [t.id, t.libelle]))
        const enCours = a.affaires.filter((x) => x.statut === 'en_cours')
        const details = await Promise.all(enCours.map((x) => api<any>(`/api/affaires/${x.id}`).catch(() => null)))
        const compact: Compact[] = enCours.map((x, i) => {
          const det = details[i]
          const etapes: any[] = det?.etapes ?? []
          const done = etapes.filter((e) => e.statut === 'terminee' || e.statut === 'ignoree').length
          const prog = etapes.length ? Math.round((100 * done) / etapes.length) : 0
          const courante = etapes.find((e) => e.statut === 'en_cours') ?? etapes.find((e) => e.statut === 'a_faire')
          const bloque = (det?.blocages ?? []).some((b: any) => b.actif && !b.deroge)
          return { id: x.id, libelle: x.libelle, type: typeLabel.get(x.type_id) ?? '—', progression: prog, etape: courante?.libelle ?? null, bloque }
        })
        setItems(compact)
      } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
    })()
  }, [clientId])

  if (error) return <StateMsg kind="error">{error}</StateMsg>
  if (!items) return <StateMsg kind="loading">Chargement des affaires…</StateMsg>
  if (items.length === 0) return <StateMsg kind="empty">Aucune affaire en cours.</StateMsg>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      {items.map((it) => (
        <Link key={it.id} href={`/affaires/${it.id}`} style={{ ...cardBase, padding: spacing[4], textDecoration: 'none', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: fonts.body, fontWeight: fontWeights.semibold, color: colors.blueDeep, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.libelle}</div>
              <div style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>{it.type}{it.etape ? ` · ${it.etape}` : ''}</div>
            </div>
            {it.bloque && <span style={statusBadge.danger}>Bloquée</span>}
          </div>
          <div style={{ marginTop: spacing[2], height: 6, backgroundColor: colors.offWhite, borderRadius: radii.full, overflow: 'hidden' }}>
            <div style={{ width: `${it.progression}%`, height: '100%', backgroundColor: colors.gold }} />
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: 2 }}>{it.progression}%</div>
        </Link>
      ))}
    </div>
  )
}
