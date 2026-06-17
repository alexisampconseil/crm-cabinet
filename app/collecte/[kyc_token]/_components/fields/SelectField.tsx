'use client'
import { inputBase } from '@/lib/design-tokens'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[]
}

// Transforme un code snake_case en libellé lisible : "communaute_reduite" → "Communaute Reduite"
function formatOption(opt: string): string {
  return opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function SelectField({ value, onChange, options }: Props) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputBase, maxWidth: '360px', cursor: 'pointer' }}
    >
      <option value="">— Sélectionner —</option>
      {options.map(opt => (
        <option key={opt} value={opt}>
          {formatOption(opt)}
        </option>
      ))}
    </select>
  )
}
