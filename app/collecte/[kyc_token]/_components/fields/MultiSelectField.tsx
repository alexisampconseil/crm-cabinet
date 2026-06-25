'use client'
import type { QuestionnaireOption } from '@/lib/collecte'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'
import { normalizeOptions } from './normalizeOptions'

interface Props {
  value: string   // JSON array string, ex : '["Pinel","LMNP"]'
  onChange: (value: string) => void
  options: string[] | QuestionnaireOption[]
}

export default function MultiSelectField({ value, onChange, options }: Props) {
  const normalized = normalizeOptions(options)

  let selected: string[] = []
  try {
    selected = JSON.parse(value || '[]') as string[]
  } catch {
    selected = []
  }

  const toggle = (optValue: string) => {
    const updated = selected.includes(optValue)
      ? selected.filter(v => v !== optValue)
      : [...selected, optValue]
    onChange(JSON.stringify(updated))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      {normalized.map(opt => (
        <label
          key={opt.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[3],
            cursor: 'pointer',
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
            color: colors.text,
            fontWeight: selected.includes(opt.value) ? fontWeights.medium : fontWeights.regular,
          }}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            style={{ accentColor: colors.blue, cursor: 'pointer' }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}
