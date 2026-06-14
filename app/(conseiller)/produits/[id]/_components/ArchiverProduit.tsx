'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

interface Props {
  produitId: string
  estActif: boolean
  nomProduit: string
}

export default function ArchiverProduit({ produitId, estActif, nomProduit }: Props) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  async function toggle() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/produits/${produitId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ actif: !estActif }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
      setConfirm(false)
    }
  }

  if (estActif) {
    // Mode actif → proposer de retirer du catalogue
    return (
      <div>
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            style={{
              fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
              letterSpacing: '0.06em', background: 'none',
              border: `1px solid ${colors.border}`, color: colors.textMid,
              padding: `${spacing[2]} ${spacing[4]}`, cursor: 'pointer',
            }}
          >
            Retirer du catalogue
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing[3],
            padding: `${spacing[3]} ${spacing[4]}`,
            backgroundColor: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
          }}>
            <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.warning, flex: 1 }}>
              Retirer «&nbsp;{nomProduit}&nbsp;» du catalogue ? Le produit sera archivé, pas supprimé.
            </span>
            <button
              onClick={toggle}
              disabled={loading}
              style={{
                fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
                backgroundColor: colors.warning, color: colors.white,
                border: 'none', padding: `${spacing[2]} ${spacing[4]}`, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '…' : 'Confirmer'}
            </button>
            <button
              onClick={() => setConfirm(false)}
              style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, background: 'none', border: 'none', color: colors.textMid, cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        )}
        {error && <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: spacing[1] }}>{error}</p>}
      </div>
    )
  }

  // Mode archivé → proposer de réactiver
  return (
    <div>
      <button
        onClick={toggle}
        disabled={loading}
        style={{
          fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
          letterSpacing: '0.06em',
          backgroundColor: colors.success, color: colors.white,
          border: 'none', padding: `${spacing[2]} ${spacing[4]}`,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '…' : 'Réactiver le produit'}
      </button>
      {error && <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: spacing[1] }}>{error}</p>}
    </div>
  )
}
