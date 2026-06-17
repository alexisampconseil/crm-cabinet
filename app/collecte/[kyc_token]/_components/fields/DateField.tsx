'use client'
import { inputBase } from '@/lib/design-tokens'

interface Props {
  value: string
  onChange: (value: string) => void
}

export default function DateField({ value, onChange }: Props) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputBase, maxWidth: '200px' }}
    />
  )
}
