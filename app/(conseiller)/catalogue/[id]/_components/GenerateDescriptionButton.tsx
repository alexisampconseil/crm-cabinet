'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  colors, fonts, fontSizes, fontWeights, spacing,
} from '@/lib/design-tokens'

export function GenerateDescriptionButton({ produitId, hasDescription }: { produitId: string; hasDescription: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleGenerate = async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/produits/${produitId}/generate-description`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setState('done')
      router.refresh()
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const label = {
    idle: hasDescription ? '↻ Régénérer la fiche IA' : '✦ Générer la fiche IA',
    loading: 'Génération en cours…',
    done: '✓ Fiche générée',
    error: 'Erreur — réessayer',
  }[state]

  return (
    <button
      onClick={handleGenerate}
      disabled={state === 'loading' || state === 'done'}
      style={{
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.medium,
        color: state === 'error' ? colors.danger : state === 'done' ? colors.success : colors.textMid,
        background: 'none',
        border: `1px solid ${state === 'error' ? colors.dangerBorder : colors.border}`,
        padding: `${spacing[2]} ${spacing[4]}`,
        cursor: state === 'loading' || state === 'done' ? 'default' : 'pointer',
        letterSpacing: '0.04em',
        opacity: state === 'loading' ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {label}
    </button>
  )
}
