'use client'

import { useEffect, useState, useCallback } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, cardBase, tableHeaderCell, tableCell } from '@/lib/design-tokens'
import { api, euros, StateMsg } from './lib'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Stats {
  annee: number; nbEnCours: number; nbTermineesAnnee: number
  montantTotal: number; revenuPrevisionnel: number; revenuRealise: number
  parType: { type_id: string; libelle: string; nb: number; montant: number; revenu_previsionnel: number; revenu_realise: number }[]
}

export default function ProductionAffaires() {
  const now = new Date().getFullYear()
  const [annee, setAnnee] = useState(now)
  const [familleId, setFamilleId] = useState('')
  const [familles, setFamilles] = useState<any[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { api<{ familles: any[] }>('/api/affaires/referentiel').then((r) => setFamilles(r.familles ?? [])).catch(() => {}) }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams({ production: '1', annee: String(annee) })
      if (familleId) params.set('familleId', familleId)
      const r = await api<{ production: Stats }>(`/api/affaires?${params.toString()}`)
      setStats(r.production)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }, [annee, familleId])
  useEffect(() => { load() }, [load])

  const annees = [now, now - 1, now - 2, now - 3]

  return (
    <div style={{ ...cardBase, padding: spacing[5], marginTop: spacing[6] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing[3], marginBottom: spacing[4] }}>
        <h2 style={{ fontFamily: fonts.heading, fontSize: fontSizes.lg, color: colors.blueDeep }}>Production — Affaires</h2>
        <div style={{ display: 'flex', gap: spacing[2] }}>
          <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={sel}>
            {annees.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={familleId} onChange={(e) => setFamilleId(e.target.value)} style={sel}>
            <option value="">Toutes familles</option>
            {familles.map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
          </select>
        </div>
      </div>

      {error && <StateMsg kind="error">{error}</StateMsg>}
      {!stats && !error && <StateMsg kind="loading">Chargement…</StateMsg>}
      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: spacing[4], marginBottom: spacing[5] }}>
            <Kpi label="En cours" value={String(stats.nbEnCours)} />
            <Kpi label={`Terminées ${stats.annee}`} value={String(stats.nbTermineesAnnee)} />
            <Kpi label="Montant total" value={euros(stats.montantTotal)} />
            <Kpi label="CA prévisionnel" value={euros(stats.revenuPrevisionnel)} />
            <Kpi label="CA réalisé" value={euros(stats.revenuRealise)} />
          </div>
          {stats.parType.length === 0 ? <StateMsg kind="empty">Aucune affaire terminée sur cette période.</StateMsg> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Type', 'Nb', 'Montant', 'CA prév.', 'CA réal.'].map((h) => <th key={h} style={tableHeaderCell}>{h}</th>)}</tr></thead>
              <tbody>
                {stats.parType.map((l) => (
                  <tr key={l.type_id}>
                    <td style={tableCell}>{l.libelle}</td>
                    <td style={tableCell}>{l.nb}</td>
                    <td style={tableCell}>{euros(l.montant)}</td>
                    <td style={tableCell}>{euros(l.revenu_previsionnel)}</td>
                    <td style={tableCell}>{euros(l.revenu_realise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: fonts.heading, fontSize: '1.6rem', fontWeight: fontWeights.light, color: colors.blueDeep }}>{value}</div>
      <div style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}
const sel: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSizes.sm, padding: '6px 10px', border: `1px solid ${colors.border}`, borderRadius: '6px', backgroundColor: colors.white }
