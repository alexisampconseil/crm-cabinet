'use client'
import { inputBase } from '@/lib/design-tokens'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function TextField({ value, onChange, placeholder }: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? ''}
      style={{ ...inputBase, maxWidth: '480px' }}
    />
  )
}
