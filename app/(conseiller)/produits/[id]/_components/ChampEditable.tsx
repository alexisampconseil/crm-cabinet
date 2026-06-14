'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

export type Option = { value: string; label: string }
export type FieldType = 'text' | 'number' | 'percentage' | 'select' | 'textarea' | 'date' | 'boolean'

interface ChampEditableProps {
  label: string
  valeur: string | number | boolean | null | undefined
  champ: string
  type?: FieldType
  options?: Option[]
  routeApi: string
  nullable?: boolean
  variant?: 'info' | 'dim'  // 'info' = InfoLine style, 'dim' = DimRow style
}

export default function ChampEditable({
  label,
  valeur,
  champ,
  type = 'text',
  options,
  routeApi,
  nullable = true,
  variant = 'info',
}: ChampEditableProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(valeur != null ? String(valeur) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)

  function formatDisplay(): string {
    if (valeur == null || valeur === '') return '—'
    if (type === 'percentage') return `${valeur} %`
    if (type === 'boolean') return valeur ? 'Oui' : 'Non'
    if (type === 'date') {
      try {
        return new Intl.DateTimeFormat('fr-FR').format(new Date(String(valeur)))
      } catch {
        return String(valeur)
      }
    }
    if (type === 'select' && options) {
      const opt = options.find(o => o.value === String(valeur))
      return opt?.label ?? String(valeur)
    }
    return String(valeur)
  }

  function startEditing() {
    setDraft(valeur != null ? String(valeur) : '')
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      let finalValue: unknown
      if (draft === '') {
        finalValue = nullable ? null : valeur
      } else if (type === 'number' || type === 'percentage') {
        const n = parseFloat(draft)
        finalValue = isNaN(n) ? null : n
      } else if (type === 'boolean') {
        finalValue = draft === 'true'
      } else {
        finalValue = draft
      }

      const res = await fetch(routeApi, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [champ]: finalValue }),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(`Erreur serveur ${res.status}`)
      }
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erreur mise à jour')
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const isDim = variant === 'dim'
  const hasValue = valeur != null && valeur !== ''

  const rowBase: React.CSSProperties = {
    padding: `${spacing[2]} 0`,
    borderBottom: `1px solid ${colors.border}`,
  }

  const labelStyle: React.CSSProperties = isDim
    ? {
        fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMid,
        flexShrink: 0,
      }
    : {
        fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
        letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMid,
        flex: '0 0 180px',
      }

  const valueStyle: React.CSSProperties = isDim
    ? {
        fontFamily: fonts.body, fontSize: fontSizes.sm,
        color: hasValue ? colors.blueDeep : colors.textLight,
        fontWeight: hasValue ? fontWeights.medium : fontWeights.regular,
        fontStyle: hasValue ? 'normal' : 'italic',
      }
    : {
        fontFamily: fonts.body, fontSize: fontSizes.sm,
        color: hasValue ? colors.text : colors.textLight,
        fontStyle: hasValue ? 'normal' : 'italic',
        textAlign: 'right',
      }

  if (editing) {
    return (
      <div style={{ ...rowBase, display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <span style={labelStyle}>{label}</span>
        <div style={{ display: 'flex', gap: spacing[2], alignItems: 'flex-start' }}>
          {type === 'textarea' ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              autoFocus
            />
          ) : (type === 'select' || type === 'boolean') ? (
            <select
              value={draft}
              onChange={e => setDraft(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: '140px' }}
              autoFocus
            >
              {type === 'boolean' ? (
                <>
                  <option value="false">Non</option>
                  <option value="true">Oui</option>
                </>
              ) : (
                <>
                  {nullable && <option value="">—</option>}
                  {(options ?? []).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </>
              )}
            </select>
          ) : (
            <input
              type={
                type === 'date' ? 'date' :
                (type === 'number' || type === 'percentage') ? 'number' : 'text'
              }
              value={draft}
              onChange={e => setDraft(e.target.value)}
              step={type === 'percentage' || type === 'number' ? '0.01' : undefined}
              style={inputStyle}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') cancel()
              }}
            />
          )}
          <div style={{ display: 'flex', gap: spacing[1], flexShrink: 0 }}>
            <button
              onClick={save}
              disabled={saving}
              style={saveBtnStyle}
              title="Enregistrer"
            >
              {saving ? '…' : '✓'}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              style={cancelBtnStyle}
              title="Annuler"
            >
              ✕
            </button>
          </div>
        </div>
        {error && (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      style={{ ...rowBase, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <span style={valueStyle}>{formatDisplay()}</span>
        <button
          onClick={startEditing}
          title={`Modifier ${label}`}
          aria-label={`Modifier ${label}`}
          style={{
            fontFamily: fonts.body, fontSize: '0.72rem',
            background: 'none', border: `1px solid ${colors.border}`,
            cursor: 'pointer', color: colors.textMid,
            padding: '1px 5px', lineHeight: 1,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s',
            flexShrink: 0,
          }}
        >
          ✎
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text,
  border: `1px solid ${colors.info}`,
  padding: `${spacing[1]} ${spacing[2]}`,
  flex: 1, minWidth: 0,
  backgroundColor: colors.white,
  outline: 'none',
}

const saveBtnStyle: React.CSSProperties = {
  fontFamily: fonts.body, fontSize: fontSizes.xs,
  backgroundColor: colors.success,
  color: colors.white, border: 'none',
  padding: `${spacing[1]} ${spacing[3]}`,
  cursor: 'pointer',
  fontWeight: fontWeights.bold,
  minWidth: '28px',
}

const cancelBtnStyle: React.CSSProperties = {
  fontFamily: fonts.body, fontSize: fontSizes.xs,
  backgroundColor: 'transparent', color: colors.textMid,
  border: `1px solid ${colors.border}`,
  padding: `${spacing[1]} ${spacing[2]}`,
  cursor: 'pointer',
}
