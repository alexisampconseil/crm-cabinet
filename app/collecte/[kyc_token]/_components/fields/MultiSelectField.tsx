'use client'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

interface Props {
  value: string   // JSON array string, ex : '["Pinel","LMNP"]'
  onChange: (value: string) => void
  options: string[]
}

function formatOption(opt: string): string {
  return opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function MultiSelectField({ value, onChange, options }: Props) {
  let selected: string[] = []
  try {
    selected = JSON.parse(value || '[]') as string[]
  } catch {
    selected = []
  }

  const toggle = (opt: string) => {
    const updated = selected.includes(opt)
      ? selected.filter(v => v !== opt)
      : [...selected, opt]
    onChange(JSON.stringify(updated))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      {options.map(opt => (
        <label
          key={opt}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[3],
            cursor: 'pointer',
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
            color: colors.text,
            fontWeight: selected.includes(opt) ? fontWeights.medium : fontWeights.regular,
          }}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            style={{ accentColor: colors.blue, cursor: 'pointer' }}
          />
          {formatOption(opt)}
        </label>
      ))}
    </div>
  )
}
