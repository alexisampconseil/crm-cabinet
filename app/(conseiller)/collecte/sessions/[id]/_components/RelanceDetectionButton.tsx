'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  colors, fonts, fontSizes, spacing, buttonGold,
} from '@/lib/design-tokens'

interface Props {
  sessionId: string
}

export default function RelanceDetectionButton({ sessionId }: Props) {
  const router = useRouter()
  const [state,    setState]    = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleRelance() {
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch(
        `/api/collecte/sessions/${sessionId}/detecter-ecarts`,
        { method: 'PATCH' }
      )
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Erreur lors de la détection')
        setState('error')
      } else {
        // Recharge les données serveur sans changer l'URL — la page bascule en mode revue
        router.refresh()
      }
    } catch {
      setErrorMsg('Erreur réseau — réessayez')
      setState('error')
    }
  }

  return (
    <div style={s.wrapper}>
      <button
        onClick={handleRelance}
        disabled={state === 'loading'}
        style={{
          ...buttonGold,
          opacity: state === 'loading' ? 0.6 : 1,
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
        } as React.CSSProperties}
      >
        {state === 'loading' ? 'Détection en cours…' : 'Relancer la détection des écarts'}
      </button>
      {state === 'error' && (
        <p style={s.error}>{errorMsg}</p>
      )}
    </div>
  )
}

const s = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    margin: 0,
  },
}
