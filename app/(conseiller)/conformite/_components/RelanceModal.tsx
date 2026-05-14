'use client'

import { useState } from 'react'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  cardBase, buttonGold, inputBase, letterSpacings,
} from '@/lib/design-tokens'

type Contexte = 'prospect' | 'maj_annuelle' | 'changement_situation'

interface Client {
  id: string
  nom: string
  prenom: string
  email: string | null
}

interface Props {
  client: Client
  onClose: () => void
  onSuccess: (clientId: string) => void
}

const CONTEXTE_OPTIONS: { value: Contexte; emoji: string; label: string; desc: string }[] = [
  { value: 'prospect',              emoji: '👋', label: 'Nouveau prospect',        desc: 'Première prise de contact' },
  { value: 'maj_annuelle',          emoji: '🔄', label: 'Mise à jour annuelle',    desc: 'Mise à jour réglementaire annuelle' },
  { value: 'changement_situation',  emoji: '✏️', label: 'Changement de situation', desc: 'Suite à une modification déclarée' },
]

export default function RelanceModal({ client, onClose, onSuccess }: Props) {
  const [contexte, setContexte] = useState<Contexte>('prospect')
  const [email, setEmail] = useState(client.email ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!email.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/relance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, contexte, email_override: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      onSuccess(client.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setSending(false)
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...cardBase, ...s.modal }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <p style={s.headerLabel}>Envoi du questionnaire KYC</p>
            <h2 style={s.headerName}>{client.prenom} {client.nom}</h2>
          </div>
          <button onClick={onClose} style={s.closeBtn} aria-label="Fermer">✕</button>
        </div>

        {/* Corps */}
        <div style={s.body}>
          <p style={s.fieldLabel}>Contexte d'envoi</p>
          <div style={s.radioGroup}>
            {CONTEXTE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={{ ...s.radioOption, ...(contexte === opt.value ? s.radioActive : {}) }}
              >
                <input
                  type="radio"
                  name="contexte"
                  value={opt.value}
                  checked={contexte === opt.value}
                  onChange={() => setContexte(opt.value)}
                  style={{ display: 'none' }}
                />
                <span style={s.radioEmoji}>{opt.emoji}</span>
                <div>
                  <p style={s.radioLabel}>{opt.label}</p>
                  <p style={s.radioDesc}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div style={{ marginTop: spacing[5] }}>
            <label style={s.fieldLabel}>Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ ...inputBase, marginTop: spacing[1] }}
            />
          </div>

          <div style={s.infoBanner}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔒</span>
            <p style={s.infoText}>
              Un lien sécurisé valable <strong>7 jours</strong> sera envoyé au client
            </p>
          </div>

          {error && (
            <p style={s.errorText}>⚠ {error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button onClick={onClose} disabled={sending} style={s.cancelBtn}>
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !email.trim()}
            style={{ ...buttonGold, fontSize: fontSizes.sm, opacity: (sending || !email.trim()) ? 0.6 : 1 }}
          >
            {sending ? 'Envoi…' : 'Envoyer le lien KYC'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    width: '480px',
    maxWidth: '90vw',
    boxShadow: shadows.xl,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: `${spacing[5]} ${spacing[6]}`,
    borderBottom: `1px solid ${colors.border}`,
  },
  headerLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.wider,
    textTransform: 'uppercase' as const,
    color: colors.gold,
    marginBottom: spacing[1],
  },
  headerName: {
    fontFamily: fonts.heading,
    fontSize: '1.5rem',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textLight,
    padding: spacing[1],
    lineHeight: 1,
    flexShrink: 0,
  } as React.CSSProperties,
  body: {
    padding: `${spacing[5]} ${spacing[6]}`,
  },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.wider,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    display: 'block',
    marginBottom: spacing[2],
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[2],
  },
  radioOption: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[3]} ${spacing[4]}`,
    border: `1.5px solid ${colors.border}`,
    cursor: 'pointer',
    transition: '0.15s',
  } as React.CSSProperties,
  radioActive: {
    borderColor: colors.blueDeep,
    backgroundColor: colors.bluePale,
  } as React.CSSProperties,
  radioEmoji: { fontSize: '1.2rem', flexShrink: 0 },
  radioLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.blueDeep,
    margin: 0,
    lineHeight: 1.3,
  },
  radioDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textLight,
    margin: '2px 0 0',
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.bluePale,
    border: `1px solid ${colors.blueLight}`,
    padding: `${spacing[3]} ${spacing[4]}`,
    marginTop: spacing[5],
  },
  infoText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.blueDeep,
    lineHeight: 1.5,
    margin: 0,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.danger,
    marginTop: spacing[3],
    margin: `${spacing[3]} 0 0`,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[3],
    padding: `${spacing[4]} ${spacing[6]}`,
    borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.offWhite,
  },
  cancelBtn: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textMid,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: `${spacing[2]} ${spacing[3]}`,
  } as React.CSSProperties,
}
