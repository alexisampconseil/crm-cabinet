'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, cardBase, statusBadge } from '@/lib/design-tokens'
import { api, euros, StateMsg, etapeTone, progressionEtapes } from './lib'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface EtapeMini { id: string; ordre: number; libelle: string; statut: string }
interface Compact {
  id: string; libelle: string; type: string; montant: number | null
  progression: number; etapes: EtapeMini[]; currentId: string | null; bloque: boolean
}

function abbrev(label: string, max = 16): string {
  const s = (label ?? '').trim()
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

export default function AffairesEnCoursBloc({ clientId }: { clientId: string }) {
  const router = useRouter()
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
          const etapes: EtapeMini[] = (det?.etapes ?? []).map((e: any) => ({ id: e.id, ordre: e.ordre, libelle: e.libelle, statut: e.statut }))
          const courante = etapes.find((e) => e.statut === 'en_cours') ?? etapes.find((e) => e.statut === 'a_faire')
          const bloque = (det?.blocages ?? []).some((b: any) => b.actif && !b.deroge)
          return {
            id: x.id, libelle: x.libelle, type: typeLabel.get(x.type_id) ?? '—', montant: x.montant,
            progression: progressionEtapes(etapes), etapes, currentId: courante?.id ?? null, bloque,
          }
        })
        setItems(compact)
      } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
    })()
  }, [clientId])

  const open = (id: string) => router.push(`/clients/${clientId}/affaires?affaire=${id}`)

  if (error) return <StateMsg kind="error">{error}</StateMsg>
  if (!items) return <StateMsg kind="loading">Chargement des affaires…</StateMsg>
  if (items.length === 0) return <StateMsg kind="empty">Aucune affaire en cours.</StateMsg>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      {items.map((it) => (
        <div key={it.id} onClick={() => open(it.id)} role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open(it.id)}
          style={{ ...cardBase, padding: spacing[4], cursor: 'pointer', display: 'flex', gap: spacing[5], alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Infos à gauche */}
          <div style={{ minWidth: 200, flex: '1 1 220px' }}>
            <div style={{ fontFamily: fonts.body, fontWeight: fontWeights.semibold, color: colors.blueDeep }}>{it.libelle}</div>
            <div style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: 2 }}>
              {it.type}{it.montant != null ? ` · ${euros(it.montant)}` : ''} · {it.progression}%
            </div>
            {it.bloque && <span style={{ ...statusBadge.danger, marginTop: spacing[2], display: 'inline-block' }}>Bloquée</span>}
          </div>
          {/* Frise chevrons à droite */}
          <div style={{ flex: '2 1 320px', minWidth: 0 }}>
            <MiniFrise etapes={it.etapes} currentId={it.currentId} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MiniFrise({ etapes, currentId }: { etapes: EtapeMini[]; currentId: string | null }) {
  if (etapes.length === 0) return <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, fontStyle: 'italic' }}>Aucune étape</span>
  return (
    <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 2 }}>
      {etapes.map((e, i) => {
        const t = etapeTone(e.statut)
        const current = e.id === currentId
        const done = e.statut === 'terminee'
        return (
          <div key={e.id} title={`${e.ordre}. ${e.libelle} — ${t.label}`}
            style={{
              fontFamily: fonts.body, fontSize: '0.6rem', fontWeight: current ? fontWeights.bold : fontWeights.medium,
              color: current ? colors.white : done ? colors.success : t.color,
              backgroundColor: current ? colors.gold : done ? colors.successBg : colors.offWhite,
              border: `1px solid ${current ? colors.gold : done ? colors.successBorder : colors.border}`,
              padding: '4px 12px 4px 16px', marginLeft: i === 0 ? 0 : -8, whiteSpace: 'nowrap', flexShrink: 0,
              clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)',
              ...(i === 0 ? { clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)', paddingLeft: 12, borderRadius: `${radii.sm} 0 0 ${radii.sm}` } : {}),
            }}>
            {done ? '✓ ' : ''}{abbrev(e.libelle)}
          </div>
        )
      })}
    </div>
  )
}
