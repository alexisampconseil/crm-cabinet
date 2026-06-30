'use client'

import { useState } from 'react'
import { colors, fonts, fontSizes, fontWeights } from '@/lib/design-tokens'

export default function DownloadKycButton({ archiveId }: { archiveId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function handleDownload() {
    setState('loading')
    try {
      const res = await fetch(`/api/documents-generes/${archiveId}/signed-url`)
      const data = await res.json()
      if (!res.ok || !data.url) {
        setState('error')
        return
      }
      window.open(data.url, '_blank')
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <button onClick={handleDownload} disabled={state === 'loading'} style={s.button}>
      {state === 'loading' ? 'Préparation…' : state === 'error' ? 'Erreur — réessayer' : 'Télécharger'}
    </button>
  )
}

const s = {
  button: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.blue,
    background: 'none',
    border: `1px solid ${colors.blue}`,
    borderRadius: 2,
    padding: '6px 14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
}
