'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CollecteSession } from '@/lib/collecte'
import {
  colors, fonts, fontSizes, fontWeights, spacing, transitions, statusBadge,
} from '@/lib/design-tokens'

interface Props {
  session: CollecteSession
}

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_cours:  'En cours',
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

export default function CollecteActiveIndicator({ session }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')

  async function handleCopier() {
    setCopyState('loading')
    try {
      const res = await fetch(`/api/collecte/sessions/${session.id}/lien`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setCopyState('error'); return }
      await navigator.clipboard.writeText((data as { url: string }).url)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
    }
  }

  return (
    <div style={s.wrapper}>
      <span style={statusBadge.info}>Collecte en cours</span>
      <span style={s.detail}>
        {STATUT_LABELS[session.statut] ?? session.statut} · créée le {formatDate(session.created_at)}
      </span>
      <button onClick={handleCopier} disabled={copyState === 'loading'} style={s.copyBtn}>
        {copyState === 'copied' ? '✓ Copié' : copyState === 'error' ? 'Erreur' : 'Copier le lien'}
      </button>
      <Link href="/collecte" style={s.link}>Voir →</Link>
    </div>
  )
}

const s = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap' as const,
  },
  detail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMid,
    whiteSpace: 'nowrap' as const,
  },
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
  link: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.blue,
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
}
