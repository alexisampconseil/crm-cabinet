'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, fonts, fontSizes, spacing } from '@/lib/design-tokens'

export default function SupprimerDocument({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmer() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(`Erreur serveur ${res.status}`)
      }
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Suppression échouée')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] }}>
        <span style={{
          fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger,
        }}>
          Supprimer définitivement ?
        </span>
        <button
          onClick={confirmer}
          disabled={loading}
          style={{
            fontFamily: fonts.body, fontSize: fontSizes.xs,
            background: 'none', border: `1px solid ${colors.danger}`,
            color: colors.danger, padding: `2px ${spacing[3]}`, cursor: 'pointer',
          }}
        >
          {loading ? '…' : 'Oui, supprimer'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={loading}
          style={{
            fontFamily: fonts.body, fontSize: fontSizes.xs,
            background: 'none', border: `1px solid ${colors.border}`,
            color: colors.textMid, padding: `2px ${spacing[3]}`, cursor: 'pointer',
          }}
        >
          Annuler
        </button>
        {error && (
          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger }}>
            {error}
          </span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs,
        background: 'none', border: `1px solid ${colors.border}`,
        color: colors.textLight, padding: `2px ${spacing[3]}`,
        cursor: 'pointer', marginTop: spacing[2],
        display: 'inline-flex', alignItems: 'center', gap: spacing[1],
      }}
    >
      ✕ Supprimer
    </button>
  )
}
