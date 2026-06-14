'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

interface Props {
  produitId:   string
  nomProduit:  string
}

export default function SupprimerProduit({ produitId, nomProduit }: Props) {
  const router = useRouter()
  const [etape,   setEtape]   = useState<'idle' | 'confirm' | 'loading'>('idle')
  const [saisie,  setSaisie]  = useState('')
  const [error,   setError]   = useState<string | null>(null)

  const confirmText = nomProduit

  async function supprimer() {
    if (saisie !== confirmText) return
    setEtape('loading')
    setError(null)
    try {
      const res  = await fetch(`/api/produits/${produitId}`, { method: 'DELETE' })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erreur suppression')
      router.push('/produits')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setEtape('confirm')
    }
  }

  if (etape === 'idle') {
    return (
      <button
        onClick={() => setEtape('confirm')}
        style={{
          fontFamily: fonts.body, fontSize: fontSizes.xs,
          background: 'none', border: 'none',
          color: colors.danger, cursor: 'pointer',
          textDecoration: 'underline', padding: 0,
        }}
      >
        Supprimer définitivement
      </button>
    )
  }

  return (
    <div style={{
      padding: spacing[5], backgroundColor: colors.dangerBg,
      border: `1px solid ${colors.dangerBorder}`, marginTop: spacing[3],
    }}>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.danger, marginBottom: spacing[2] }}>
        ⚠ Suppression définitive — action irréversible
      </p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, lineHeight: 1.6, marginBottom: spacing[4] }}>
        Cette action supprime le produit, sa gouvernance, tous ses documents et les fichiers associés en Storage.
        <br />
        <strong>Aucune restauration possible.</strong> Utilisez plutôt «&nbsp;Retirer du catalogue&nbsp;» pour archiver.
      </p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginBottom: spacing[2] }}>
        Saisissez le nom exact du produit pour confirmer :
        <br />
        <code style={{ fontFamily: 'monospace', fontWeight: fontWeights.bold, color: colors.danger }}>{confirmText}</code>
      </p>
      <input
        type="text"
        value={saisie}
        onChange={e => setSaisie(e.target.value)}
        placeholder={confirmText}
        style={{
          fontFamily: fonts.body, fontSize: fontSizes.sm,
          border: `1px solid ${colors.dangerBorder}`, padding: `${spacing[2]} ${spacing[3]}`,
          width: '100%', marginBottom: spacing[3],
          outline: 'none', backgroundColor: colors.white,
        }}
      />
      {error && (
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginBottom: spacing[2] }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: spacing[3] }}>
        <button
          onClick={supprimer}
          disabled={saisie !== confirmText || etape === 'loading'}
          style={{
            fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            backgroundColor: saisie !== confirmText ? colors.textLight : colors.danger,
            color: colors.white, border: 'none',
            padding: `${spacing[2]} ${spacing[5]}`,
            cursor: saisie !== confirmText ? 'not-allowed' : 'pointer',
          }}
        >
          {etape === 'loading' ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
        <button
          onClick={() => { setEtape('idle'); setSaisie(''); setError(null) }}
          disabled={etape === 'loading'}
          style={{
            fontFamily: fonts.body, fontSize: fontSizes.xs,
            background: 'none', border: `1px solid ${colors.border}`,
            color: colors.textMid, padding: `${spacing[2]} ${spacing[4]}`,
            cursor: 'pointer',
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
