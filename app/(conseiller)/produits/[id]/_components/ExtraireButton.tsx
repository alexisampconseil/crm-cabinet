'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  colors, fonts, fontSizes, fontWeights, spacing, radii,
} from '@/lib/design-tokens'

type Etat = 'idle' | 'loading' | 'done' | 'erreur'

export default function ExtraireButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [etat,   setEtat]   = useState<Etat>('idle')
  const [erreur, setErreur] = useState<string | null>(null)

  const extraire = async () => {
    setEtat('loading')
    setErreur(null)
    try {
      const res = await fetch('/api/documents/extract', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ document_id: documentId }),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        const text = await res.text()
        console.error('[ExtraireButton] Réponse non-JSON:', res.status, text.slice(0, 500))
        throw new Error(`Erreur serveur ${res.status} — voir les logs Next.js`)
      }
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Extraction échouée')
      setEtat('done')
      router.refresh()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue')
      setEtat('erreur')
    }
  }

  if (etat === 'done') return null

  if (etat === 'loading') {
    return (
      <div style={{ marginTop: spacing[2], display: 'flex', alignItems: 'center', gap: spacing[3] }}>
        <div style={s.spinner} />
        <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>
          Extraction en cours…
        </span>
      </div>
    )
  }

  if (etat === 'erreur') {
    return (
      <div style={{ marginTop: spacing[2], display: 'flex', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' as const }}>
        <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger }}>
          {erreur}
        </span>
        <button onClick={extraire} style={s.retryBtn}>
          ↺ Réessayer
        </button>
      </div>
    )
  }

  return (
    <button onClick={extraire} style={s.btn}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Extraire le texte
    </button>
  )
}

const s = {
  btn: {
    marginTop: spacing[2],
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    backgroundColor: 'transparent', color: colors.blue,
    border: `1px solid ${colors.blue}`,
    padding: `${spacing[2]} ${spacing[4]}`,
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: spacing[2],
  } as React.CSSProperties,
  retryBtn: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
    backgroundColor: 'transparent', color: colors.danger,
    border: `1px solid ${colors.danger}`,
    padding: `${spacing[2]} ${spacing[3]}`,
    cursor: 'pointer',
  } as React.CSSProperties,
  spinner: {
    width: '14px', height: '14px',
    border: `2px solid ${colors.border}`,
    borderTopColor: colors.blue,
    borderRadius: radii.full,
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,
}
