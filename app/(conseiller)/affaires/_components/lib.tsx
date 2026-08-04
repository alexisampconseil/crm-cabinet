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
// Date « jour » sans heure ni fuseau : on isole la portion YYYY-MM-DD de la
// valeur stockée (timestamptz sérialisé) — aucune construction de Date, donc
// aucun décalage de fuseau horaire.
export function dateOnly(d: string | null | undefined): string {
  return d ? String(d).slice(0, 10) : ''
}
export function dateFrOnly(d: string | null | undefined): string {
  const s = dateOnly(d)
  if (!s) return '—'
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y}`
}
// Date du jour dans le fuseau local du conseiller, au format 'YYYY-MM-DD'.
export function todayLocal(): string {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
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

// ── Statuts : libellés compréhensibles + tons sobres (palette CRM) ────────────
type Tone = 'todo' | 'current' | 'done' | 'skip' | 'ok' | 'ko' | 'derog'
const TONE_STYLE: Record<Tone, React.CSSProperties> = {
  todo: statusBadge.neutral, current: statusBadge.info, done: statusBadge.success,
  skip: statusBadge.neutral, ok: statusBadge.success, ko: statusBadge.danger, derog: statusBadge.warning,
}
export interface StatutOpt { value: string; label: string; tone: Tone }

export const ETAPE_STATUTS: StatutOpt[] = [
  { value: 'a_faire', label: 'Non réalisé', tone: 'todo' },
  { value: 'en_cours', label: 'En cours', tone: 'current' },
  { value: 'terminee', label: 'Réalisé', tone: 'done' },
  { value: 'ignoree', label: 'Ignoré', tone: 'skip' },
]
export const TACHE_STATUTS = ETAPE_STATUTS
export const DOC_STATUTS: StatutOpt[] = [
  { value: 'attendu', label: 'Attendu', tone: 'todo' },
  { value: 'depose', label: 'Déposé', tone: 'current' },
  { value: 'valide', label: 'Validé', tone: 'ok' },
  { value: 'refuse', label: 'Refusé', tone: 'ko' },
  { value: 'non_requis', label: 'Non requis', tone: 'skip' },
]
export const CTRL_STATUTS: StatutOpt[] = [
  { value: 'a_controler', label: 'À contrôler', tone: 'todo' },
  { value: 'conforme', label: 'Conforme', tone: 'ok' },
  { value: 'non_conforme', label: 'Non conforme', tone: 'ko' },
  { value: 'deroge', label: 'Dérogé', tone: 'derog' },
]
export function statutMeta(opts: StatutOpt[], value: string): { label: string; style: React.CSSProperties } {
  const o = opts.find((x) => x.value === value)
  return o ? { label: o.label, style: TONE_STYLE[o.tone] } : { label: value, style: statusBadge.neutral }
}
export function StatutBadge({ opts, value }: { opts: StatutOpt[]; value: string }) {
  const { label, style } = statutMeta(opts, value)
  return <span style={style}>{label}</span>
}

// Ton d'une étape pour la frise (couleurs de remplissage, palette CRM sobre).
export function etapeTone(statut: string): { color: string; bg: string; label: string } {
  switch (statut) {
    case 'terminee': return { color: colors.success, bg: colors.successBg, label: 'Réalisé' }
    case 'en_cours': return { color: colors.blue, bg: colors.bluePale, label: 'En cours' }
    case 'ignoree': return { color: colors.textLight, bg: colors.offWhite, label: 'Ignoré' }
    default: return { color: colors.textLight, bg: colors.white, label: 'Non réalisé' }
  }
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

// ── Progression d'une frise (part d'étapes réalisées / ignorées) ─────────────
export function progressionEtapes(etapes: { statut: string }[]): number {
  if (!etapes.length) return 0
  const done = etapes.filter((e) => e.statut === 'terminee' || e.statut === 'ignoree').length
  return Math.round((100 * done) / etapes.length)
}

// ── Frais : deux champs liés € ⇄ % (base = montant de l'affaire) ──────────────
// La valeur métier enregistrée reste `frais` en euros ; le pourcentage est
// purement calculé (frais / montant × 100), sans colonne en base.
function parseNum(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const round2 = (n: number) => Math.round(n * 100) / 100
const fmt2 = (n: number) => round2(n).toFixed(2)

export function FraisFields(props: {
  montant: number | null
  initialEuros: number | null
  onEurosChange: (euros: number | null) => void
  disabled?: boolean
}) {
  const { montant, initialEuros, onEurosChange, disabled } = props
  const hasBase = typeof montant === 'number' && montant > 0
  const [euros, setEuros] = React.useState(initialEuros != null ? String(initialEuros) : '')
  const [pct, setPct] = React.useState(
    initialEuros != null && hasBase ? fmt2((100 * initialEuros) / (montant as number)) : ''
  )
  const lastEdited = React.useRef<'euros' | 'pct'>('euros')

  // Quand le montant change : garder comme référence le dernier champ modifié,
  // recalculer l'autre ; sans base valable, le pourcentage reste vide.
  React.useEffect(() => {
    if (!hasBase) { setPct(''); return }
    const base = montant as number
    if (lastEdited.current === 'euros') {
      const e = parseNum(euros)
      setPct(e == null ? '' : fmt2((100 * e) / base))
    } else {
      const p = parseNum(pct)
      const e = p == null ? null : round2((base * p) / 100)
      setEuros(e == null ? '' : String(e))
      onEurosChange(e)
    }
    // Recalcul volontairement déclenché par le seul changement de montant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montant])

  const onEuros = (v: string) => {
    lastEdited.current = 'euros'
    setEuros(v)
    const e = parseNum(v)
    onEurosChange(e)
    setPct(!hasBase || e == null ? '' : fmt2((100 * e) / (montant as number)))
  }
  const onPct = (v: string) => {
    lastEdited.current = 'pct'
    setPct(v)
    const p = parseNum(v)
    if (!hasBase) return
    if (p == null) { setEuros(''); onEurosChange(null); return }
    const e = round2(((montant as number) * p) / 100)
    setEuros(String(e)); onEurosChange(e)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[4] }}>
      <div>
        <label style={fx.label}>Frais (€)</label>
        <input style={fx.input} type="number" inputMode="decimal" value={euros} disabled={disabled}
          onChange={(e) => onEuros(e.target.value)} placeholder="0" />
      </div>
      <div>
        <label style={fx.label}>Frais (%)</label>
        <input style={{ ...fx.input, ...(hasBase ? {} : fx.disabled) }} type="number" inputMode="decimal"
          value={pct} disabled={disabled || !hasBase} onChange={(e) => onPct(e.target.value)}
          placeholder={hasBase ? '0,00' : 'Montant requis'} />
      </div>
    </div>
  )
}

// ── Aide contextuelle : icône ⓘ + popover (clic + clavier + survol) ──────────
export function HelpTip({ title, text, examples }: { title?: string; text: string; examples?: string[] }) {
  const [open, setOpen] = React.useState(false)
  // Ouverture au clic et au clavier (Entrée/Espace déclenchent le clic natif).
  // Le survol est un bonus qui n'entre pas en conflit avec le clic (il ne fait
  // qu'ouvrir). Fermeture : nouveau clic, Échap, perte de focus, ou sortie souris.
  return (
    <span style={ht.wrap} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={'Aide' + (title ? ' : ' + title : '')}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        onBlur={() => setOpen(false)}
        style={ht.btn}
      >ⓘ</button>
      {open && (
        <span role="tooltip" style={ht.pop}>
          {title && <span style={ht.title}>{title}</span>}
          <span style={ht.text}>{text}</span>
          {examples && examples.length > 0 && (
            <span style={ht.exWrap}>
              <span style={ht.exLabel}>Exemples</span>
              {examples.map((ex, i) => <span key={i} style={ht.exItem}>• {ex}</span>)}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
const ht = {
  wrap: { position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: spacing[1] } as React.CSSProperties,
  btn: { border: 'none', background: 'none', cursor: 'pointer', color: colors.blue, fontSize: '0.85rem', lineHeight: 1, padding: 0, fontFamily: fonts.body } as React.CSSProperties,
  pop: { position: 'absolute', top: '140%', left: 0, zIndex: 1200, width: 260, backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: radii.md, boxShadow: '0 8px 28px rgba(45,68,98,0.16)', padding: spacing[3], display: 'flex', flexDirection: 'column', gap: spacing[1], textAlign: 'left', cursor: 'default' } as React.CSSProperties,
  title: { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.blueDeep, textTransform: 'uppercase', letterSpacing: '0.06em' } as React.CSSProperties,
  text: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, lineHeight: 1.5 } as React.CSSProperties,
  exWrap: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: spacing[1], paddingTop: spacing[1], borderTop: `1px solid ${colors.border}` } as React.CSSProperties,
  exLabel: { fontFamily: fonts.body, fontSize: '0.6rem', fontWeight: fontWeights.bold, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.gold } as React.CSSProperties,
  exItem: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid } as React.CSSProperties,
}

const fx = {
  label: { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.textMid, display: 'block', marginBottom: spacing[1] } as React.CSSProperties,
  input: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, backgroundColor: colors.white, border: `1px solid ${colors.border}`, padding: `${spacing[2]} ${spacing[3]}`, outline: 'none', width: '100%' } as React.CSSProperties,
  disabled: { backgroundColor: colors.offWhite, color: colors.textLight } as React.CSSProperties,
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
