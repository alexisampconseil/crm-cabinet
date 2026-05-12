'use client'

import { useState } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, transitions, buttonPrimary } from '@/lib/design-tokens'

interface RelanceButtonProps {
  clientId: string
  email: string | null
  type: 'kyc_initial' | 'kyc_renouvellement'
  compact?: boolean
}

export default function RelanceButton({ clientId, email, type, compact }: RelanceButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!email) return null

  const handleRelance = async () => {
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/relance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setState('sent')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur')
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  if (state === 'sent') {
    return (
      <span style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs,
        color: colors.success, fontWeight: fontWeights.medium,
        letterSpacing: '0.06em',
      }}>
        ✓ Email envoyé
      </span>
    )
  }

  if (state === 'error') {
    return (
      <span style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs,
        color: colors.danger,
      }}>
        ⚠ {errorMsg}
      </span>
    )
  }

  const label = type === 'kyc_renouvellement' ? 'Renouveler KYC' : 'Envoyer KYC'

  if (compact) {
    return (
      <button
        onClick={handleRelance}
        disabled={state === 'loading'}
        style={{
          fontFamily: fonts.body,
          fontSize: '0.62rem',
          fontWeight: fontWeights.medium,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          padding: '4px 10px',
          backgroundColor: 'transparent',
          color: colors.blue,
          border: `1px solid ${colors.blueLight}`,
          cursor: 'pointer',
          transition: transitions.fast,
          opacity: state === 'loading' ? 0.6 : 1,
        }}
      >
        {state === 'loading' ? '…' : '→ Envoyer'}
      </button>
    )
  }

  return (
    <button
      onClick={handleRelance}
      disabled={state === 'loading'}
      style={{
        ...buttonPrimary,
        fontSize: fontSizes.xs,
        padding: `${spacing[2]} ${spacing[4]}`,
        opacity: state === 'loading' ? 0.7 : 1,
        cursor: state === 'loading' ? 'not-allowed' : 'pointer',
      } as React.CSSProperties}
    >
      {state === 'loading' ? 'Envoi…' : label}
    </button>
  )
}
