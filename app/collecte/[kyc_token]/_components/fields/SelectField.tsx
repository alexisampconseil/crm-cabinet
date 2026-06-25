'use client'
import type { QuestionnaireOption } from '@/lib/collecte'
import { inputBase } from '@/lib/design-tokens'
import { normalizeOptions } from './normalizeOptions'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[] | QuestionnaireOption[]
}

export default function SelectField({ value, onChange, options }: Props) {
  const normalized = normalizeOptions(options)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputBase, maxWidth: '360px', cursor: 'pointer' }}
    >
      <option value="">— Sélectionner —</option>
      {normalized.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
