'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, fonts, fontSizes, fontWeights, spacing, transitions } from '@/lib/design-tokens'

interface Props {
  sessionId: string
  clientEmail: string | null
}

export default function SessionActiveActions({ sessionId, clientEmail }: Props) {
  const router = useRouter()

  const [lienLoading, setLienLoading] = useState(false)
  const [lienError,   setLienError]   = useState('')
  const [copied,      setCopied]      = useState(false)
  const [emailState,  setEmailState]  = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [annulState,  setAnnulState]  = useState<'idle' | 'confirm' | 'loading' | 'error'>('idle')
  const [annulError,  setAnnulError]  = useState('')

  async function fetchLien(): Promise<{ url: string } | null> {
    setLienLoading(true)
    setLienError('')
    try {
      const res = await fetch(`/api/collecte/sessions/${sessionId}/lien`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLienError((data as { error?: string }).error ?? 'Erreur lors de la récupération du lien')
        return null
      }
      return data as { url: string }
    } catch {
      setLienError('Erreur réseau')
      return null
    } finally {
      setLienLoading(false)
    }
  }

  async function handleCopier() {
    const lien = await fetchLien()
    if (!lien) return
    await navigator.clipboard.writeText(lien.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleOuvrir() {
    const lien = await fetchLien()
    if (!lien) return
    window.open(lien.url, '_blank', 'noopener,noreferrer')
  }

  async function handleEnvoyer() {
    setEmailState('loading')
    try {
      const res = await fetch(`/api/collecte/sessions/${sessionId}/notifier`, { method: 'POST' })
      if (!res.ok) { setEmailState('error'); return }
      setEmailState('sent')
      setTimeout(() => setEmailState('idle'), 2500)
    } catch {
      setEmailState('error')
    }
  }

  async function handleAnnuler() {
    setAnnulState('loading')
    setAnnulError('')
    try {
      const res = await fetch(`/api/collecte/sessions/${sessionId}/annuler`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAnnulError((data as { error?: string }).error ?? 'Erreur lors de l\'annulation')
        setAnnulState('error')
        return
      }
      router.refresh()
    } catch {
      setAnnulError('Erreur réseau')
      setAnnulState('error')
    }
  }

  if (annulState === 'confirm' || annulState === 'loading') {
    return (
      <div style={s.confirmRow}>
        <span style={s.confirmText}>Confirmer ?</span>
        <button onClick={handleAnnuler} disabled={annulState === 'loading'} style={s.btnDanger}>
          {annulState === 'loading' ? '…' : 'Oui, annuler'}
        </button>
        <button onClick={() => setAnnulState('idle')} disabled={annulState === 'loading'} style={s.btnGhost}>
          Non
        </button>
      </div>
    )
  }

  return (
    <div style={s.wrapper}>
      <div style={s.actions}>
        <button onClick={handleCopier} disabled={lienLoading} style={s.btnGhost}>
          {copied ? '✓ Copié' : 'Copier'}
        </button>
        <button onClick={handleOuvrir} disabled={lienLoading} style={s.btnGhost}>
          Ouvrir
        </button>
        <button onClick={handleEnvoyer} disabled={!clientEmail || emailState === 'loading'} style={s.btnGhost}>
          {emailState === 'loading' ? 'Envoi…' : emailState === 'sent' ? '✓ Envoyé' : 'Email'}
        </button>
        <button onClick={() => setAnnulState('confirm')} style={s.btnDanger}>
          Annuler
        </button>
      </div>
      {(lienError || annulError) && (
        <p style={s.errorText}>{lienError || annulError}</p>
      )}
    </div>
  )
}

const s = {
  wrapper: { display: 'flex', flexDirection: 'column' as const, gap: spacing[1], alignItems: 'flex-end' },
  actions: { display: 'flex', gap: spacing[2] },
  confirmRow: { display: 'flex', alignItems: 'center', gap: spacing[2] },
  confirmText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMid,
    whiteSpace: 'nowrap' as const,
  },
  btnGhost: {
    fontFamily: fonts.body,
    fontSize: '0.62rem',
    fontWeight: fontWeights.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: colors.blue,
    border: `1px solid ${colors.blueLight}`,
    cursor: 'pointer',
    transition: transitions.fast,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  btnDanger: {
    fontFamily: fonts.body,
    fontSize: '0.62rem',
    fontWeight: fontWeights.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: colors.danger,
    border: `1px solid ${colors.dangerBorder}`,
    cursor: 'pointer',
    transition: transitions.fast,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.danger,
    margin: 0,
    maxWidth: '220px',
    textAlign: 'right' as const,
  } as React.CSSProperties,
}
