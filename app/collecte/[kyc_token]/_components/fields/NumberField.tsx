'use client'
import { inputBase } from '@/lib/design-tokens'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function NumberField({ value, onChange, placeholder }: Props) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '0'}
      style={{ ...inputBase, maxWidth: '240px' }}
    />
  )
}
