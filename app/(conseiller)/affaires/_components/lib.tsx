'use client'

import React from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, statusBadge } from '@/lib/design-tokens'

// ── Formatage ────────────────────────────────────────────────────────────────
export function euros(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
export function dateFr(d: string | null | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

// ── Libellés & badges ────────────────────────────────────────────────────────
export const AFFAIRE_STATUT_LABEL: Record<string, string> = {
  en_cours: 'En cours', terminee: 'Terminée', archivee: 'Archivée',
}
export const AFFAIRE_STATUT_STYLE: Record<string, React.CSSProperties> = {
  en_cours: statusBadge.info, terminee: statusBadge.success, archivee: statusBadge.neutral,
}
export const CIBLE_LABEL: Record<string, string> = {
  actif_financier: 'Actif financier', patrimoine_immobilier: 'Immobilier',
  passif: 'Passif', contrat_prevoyance: 'Contrat de prévoyance',
}

export function Badge({ label, style }: { label: string; style?: React.CSSProperties }) {
  return <span style={{ ...statusBadge.neutral, ...style }}>{label}</span>
}

// ── Appels API + gestion du conflit 409 ──────────────────────────────────────
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new ApiError(json?.error ?? `Erreur ${res.status}`, res.status)
  return json as T
}
export function isConflict(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409
}

// ── Atomes UI ────────────────────────────────────────────────────────────────
export function StateMsg({ kind, children }: { kind: 'loading' | 'empty' | 'error' | 'success'; children: React.ReactNode }) {
  const map: Record<string, React.CSSProperties> = {
    loading: { color: colors.textMid },
    empty: { color: colors.textLight, fontStyle: 'italic' },
    error: { color: colors.danger, backgroundColor: colors.dangerBg, border: `1px solid ${colors.dangerBorder}`, padding: spacing[3], borderRadius: radii.sm },
    success: { color: colors.success },
  }
  return <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, padding: `${spacing[2]} 0`, ...map[kind] }}>{children}</p>
}

// Modale de confirmation, avec motif optionnel/obligatoire.
export function ConfirmModal(props: {
  title: string
  message?: string
  motif?: 'none' | 'optional' | 'required'
  motifLabel?: string
  confirmLabel?: string
  busy?: boolean
  error?: string | null
  onConfirm: (motif: string) => void
  onCancel: () => void
}) {
  const [motif, setMotif] = React.useState('')
  const needMotif = props.motif === 'required'
  const disabled = props.busy || (needMotif && motif.trim() === '')
  return (
    <div style={ov.backdrop} onClick={props.onCancel}>
      <div style={ov.box} onClick={(e) => e.stopPropagation()}>
        <h3 style={ov.title}>{props.title}</h3>
        {props.message && <p style={ov.msg}>{props.message}</p>}
        {props.motif && props.motif !== 'none' && (
          <textarea
            value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder={props.motifLabel ?? (needMotif ? 'Motif (obligatoire)' : 'Motif (optionnel)')}
            style={ov.textarea} rows={3}
          />
        )}
        {props.error && <StateMsg kind="error">{props.error}</StateMsg>}
        <div style={ov.actions}>
          <button style={ov.btnCancel} onClick={props.onCancel} disabled={props.busy}>Annuler</button>
          <button style={{ ...ov.btnConfirm, opacity: disabled ? 0.5 : 1 }} disabled={disabled}
            onClick={() => props.onConfirm(motif.trim())}>
            {props.busy ? 'En cours…' : (props.confirmLabel ?? 'Confirmer')}
          </button>
        </div>
      </div>
    </div>
  )
}

const ov = {
  backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(20,30,45,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 } as React.CSSProperties,
  box: { backgroundColor: colors.white, borderRadius: radii.md, padding: spacing[6], width: 'min(480px, 92vw)', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' } as React.CSSProperties,
  title: { fontFamily: fonts.heading, fontSize: fontSizes.lg, color: colors.blueDeep, marginBottom: spacing[3] } as React.CSSProperties,
  msg: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, marginBottom: spacing[4] } as React.CSSProperties,
  textarea: { width: '100%', fontFamily: fonts.body, fontSize: fontSizes.sm, padding: spacing[3], border: `1px solid ${colors.border}`, borderRadius: radii.sm, marginBottom: spacing[3], resize: 'vertical' } as React.CSSProperties,
  actions: { display: 'flex', justifyContent: 'flex-end', gap: spacing[3], marginTop: spacing[3] } as React.CSSProperties,
  btnCancel: { fontFamily: fonts.body, fontSize: fontSizes.sm, padding: `8px 16px`, border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: radii.sm, cursor: 'pointer', color: colors.textMid } as React.CSSProperties,
  btnConfirm: { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, padding: `8px 18px`, border: 'none', backgroundColor: colors.blue, color: colors.white, borderRadius: radii.sm, cursor: 'pointer' } as React.CSSProperties,
}
