'use client'

import { useState } from 'react'
import {
  colors, fonts, fontSizes, fontWeights, spacing, transitions, buttonGold,
} from '@/lib/design-tokens'

interface Props {
  clientId: string
  kycStatus: string
  email: string | null
}

interface LienResult {
  sessionId:  string
  url:        string
  expires_at: string
}

export default function GenerateCollecteLinkButton({ clientId, kycStatus, email }: Props) {
  const [state,    setState]    = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result,   setResult]   = useState<LienResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied,   setCopied]   = useState(false)

  const [emailState, setEmailState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [emailError, setEmailError] = useState('')

  const disabled = kycStatus === 'en_cours' || state === 'loading'

  async function handleGenerate() {
    setState('loading')
    setErrorMsg('')
    try {
      const type = kycStatus === 'non_fait' ? 'bilan_initial' : 'mise_a_jour'
      const res = await fetch('/api/collecte/liens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          type,
          perimetre: 'client_seul',
          expiresInHours: 168,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message = (data as { error?: string }).error
        if (res.status === 409) {
          setErrorMsg(message ?? 'Une session de collecte est déjà active pour ce client.')
        } else if (res.status === 422) {
          setErrorMsg(message ?? 'Aucune version de questionnaire active — publiez-en une avant de générer un lien.')
        } else if (res.status === 401 || res.status === 403) {
          setErrorMsg(message ?? 'Accès non autorisé.')
        } else {
          setErrorMsg(message ?? 'Erreur lors de la génération du lien.')
        }
        setState('error')
        return
      }

      setResult({ sessionId: data.session.id, url: data.url, expires_at: data.expires_at })
      setState('success')
    } catch {
      setErrorMsg('Erreur réseau — réessayez.')
      setState('error')
    }
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSendEmail() {
    if (!result) return
    setEmailState('loading')
    setEmailError('')
    try {
      const res = await fetch(`/api/collecte/sessions/${result.sessionId}/notifier`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEmailError((data as { error?: string }).error ?? 'Erreur lors de l\'envoi de l\'email.')
        setEmailState('error')
        return
      }
      setEmailState('sent')
    } catch {
      setEmailError('Erreur réseau — réessayez.')
      setEmailState('error')
    }
  }

  if (state === 'success' && result) {
    return (
      <div style={s.resultBox}>
        <p style={s.resultLabel}>Lien de collecte généré</p>
        <div style={s.linkRow}>
          <span style={s.linkText} title={result.url}>{result.url}</span>
          <button onClick={handleCopy} style={s.copyBtn}>
            {copied ? '✓ Copié' : 'Copier'}
          </button>
          <a href={result.url} target="_blank" rel="noopener noreferrer" style={s.openLink}>
            Ouvrir →
          </a>
        </div>
        <div style={s.linkRow}>
          <button
            onClick={handleSendEmail}
            disabled={!email || emailState === 'loading' || emailState === 'sent'}
            style={{
              ...s.copyBtn,
              opacity: (!email || emailState === 'loading' || emailState === 'sent') ? 0.5 : 1,
              cursor: (!email || emailState === 'loading' || emailState === 'sent') ? 'not-allowed' : 'pointer',
            }}
          >
            {emailState === 'loading' ? 'Envoi…' : emailState === 'sent' ? '✓ Email envoyé' : 'Envoyer par email'}
          </button>
          {!email && <span style={s.noEmailHint}>Aucun email enregistré</span>}
          {emailState === 'error' && <span style={s.emailErrorHint}>{emailError}</span>}
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrapper}>
      <button
        onClick={handleGenerate}
        disabled={disabled}
        style={{
          ...buttonGold,
          fontSize: fontSizes.xs,
          padding: '6px 14px',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        } as React.CSSProperties}
      >
        {state === 'loading' ? 'Génération…' : 'Générer un lien de collecte'}
      </button>
      {state === 'error' && (
        <p style={s.errorText}>{errorMsg}</p>
      )}
    </div>
  )
}

const s = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: spacing[1],
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.danger,
    margin: 0,
    maxWidth: '260px',
  },
  resultBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[1],
    padding: `${spacing[2]} ${spacing[3]}`,
    backgroundColor: colors.successBg,
    border: `1px solid ${colors.successBorder}`,
  },
  resultLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.success,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    margin: 0,
  },
  linkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  },
  linkText: {
    fontFamily: 'monospace',
    fontSize: fontSizes.xs,
    color: colors.textMid,
    maxWidth: '220px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  copyBtn: {
    fontFamily: fonts.body,
    fontSize: '0.62rem',
    fontWeight: fontWeights.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '3px 8px',
    backgroundColor: 'transparent',
    color: colors.blue,
    border: `1px solid ${colors.blueLight}`,
    cursor: 'pointer',
    transition: transitions.fast,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  openLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.blue,
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  noEmailHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textLight,
    fontStyle: 'italic' as const,
  },
  emailErrorHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.danger,
  },
}
