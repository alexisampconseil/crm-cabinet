'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { colors, fonts, fontSizes, fontWeights, spacing, cardBase, tableHeaderCell, tableCell, buttonGold } from '@/lib/design-tokens'
import { api, euros, dateFr, AFFAIRE_STATUT_LABEL, AFFAIRE_STATUT_STYLE, StateMsg } from './lib'

interface AffaireRow {
  id: string; libelle: string; famille_id: string; type_id: string
  statut: string; montant: number | null; revenu_previsionnel: number | null
  revenu_realise: number | null; date_ouverture: string
}
interface Ref { familles: { id: string; libelle: string }[]; types: { id: string; libelle: string }[] }

const FILTRES = [
  { key: 'en_cours', label: 'En cours' },
  { key: 'terminee', label: 'Terminées' },
  { key: 'archivee', label: 'Archivées' },
  { key: 'all', label: 'Toutes' },
]

export default function AffairesListClient({ clientId }: { clientId: string }) {
  const [affaires, setAffaires] = useState<AffaireRow[]>([])
  const [ref, setRef] = useState<Ref>({ familles: [], types: [] })
  const [filtre, setFiltre] = useState('en_cours')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [a, r] = await Promise.all([
        api<{ affaires: AffaireRow[] }>(`/api/affaires?clientId=${clientId}`),
        api<Ref>(`/api/affaires/referentiel`),
      ])
      setAffaires(a.affaires); setRef({ familles: r.familles ?? [], types: r.types ?? [] })
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }, [clientId])

  useEffect(() => { load() }, [load])

  const nom = (list: { id: string; libelle: string }[], id: string) => list.find((x) => x.id === id)?.libelle ?? '—'
  const filtered = affaires.filter((a) => filtre === 'all' || a.statut === filtre)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4], gap: spacing[3], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: spacing[2] }}>
          {FILTRES.map((f) => (
            <button key={f.key} onClick={() => setFiltre(f.key)}
              style={{ ...tab, ...(filtre === f.key ? tabActive : {}) }}>
              {f.label}
            </button>
          ))}
        </div>
        <Link href={`/clients/${clientId}/affaires/nouvelle`} style={{ ...buttonGold, fontSize: fontSizes.xs, padding: '8px 18px', textDecoration: 'none' }}>
          + Nouvelle affaire
        </Link>
      </div>

      {loading && <StateMsg kind="loading">Chargement des affaires…</StateMsg>}
      {error && <StateMsg kind="error">{error}</StateMsg>}
      {!loading && !error && filtered.length === 0 && <StateMsg kind="empty">Aucune affaire pour ce filtre.</StateMsg>}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ ...cardBase, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Libellé', 'Famille', 'Type', 'Statut', 'Montant', 'CA prév.', 'CA réal.', 'Ouverture'].map((h) => (
                  <th key={h} style={tableHeaderCell}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={{ cursor: 'pointer' }}>
                  <td style={tableCell}>
                    <Link href={`/clients/${clientId}/affaires?affaire=${a.id}`} style={{ color: colors.blue, textDecoration: 'none', fontWeight: fontWeights.medium }}>{a.libelle}</Link>
                  </td>
                  <td style={tableCell}>{nom(ref.familles, a.famille_id)}</td>
                  <td style={tableCell}>{nom(ref.types, a.type_id)}</td>
                  <td style={tableCell}><span style={AFFAIRE_STATUT_STYLE[a.statut]}>{AFFAIRE_STATUT_LABEL[a.statut] ?? a.statut}</span></td>
                  <td style={tableCell}>{euros(a.montant)}</td>
                  <td style={tableCell}>{euros(a.revenu_previsionnel)}</td>
                  <td style={tableCell}>{euros(a.revenu_realise)}</td>
                  <td style={tableCell}>{dateFr(a.date_ouverture)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const tab: React.CSSProperties = {
  fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textMid,
  padding: '6px 14px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: '6px', cursor: 'pointer',
}
const tabActive: React.CSSProperties = { color: colors.white, backgroundColor: colors.blueDeep, borderColor: colors.blueDeep }
