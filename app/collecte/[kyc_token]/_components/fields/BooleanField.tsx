'use client'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

interface Props {
  value: string   // "true" | "false" | ""
  onChange: (value: string) => void
  fieldKey: string  // identifiant unique pour le name du groupe radio
}

export default function BooleanField({ value, onChange, fieldKey }: Props) {
  return (
    <div style={{ display: 'flex', gap: spacing[6] }}>
      {(['true', 'false'] as const).map(v => (
        <label
          key={v}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
            cursor: 'pointer',
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
            color: colors.text,
            fontWeight: value === v ? fontWeights.medium : fontWeights.regular,
          }}
        >
          <input
            type="radio"
            name={fieldKey}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            style={{ accentColor: colors.blue, cursor: 'pointer' }}
          />
          {v === 'true' ? 'Oui' : 'Non'}
        </label>
      ))}
    </div>
  )
}
