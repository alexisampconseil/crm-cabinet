'use client'
import type { QuestionnaireQuestion } from '@/lib/collecte'
import {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  labelBase,
  spacing,
  statusBadge,
} from '@/lib/design-tokens'
import TextField from './fields/TextField'
import NumberField from './fields/NumberField'
import DateField from './fields/DateField'
import BooleanField from './fields/BooleanField'
import SelectField from './fields/SelectField'
import MultiSelectField from './fields/MultiSelectField'

interface Props {
  question: QuestionnaireQuestion
  value: string
  onChange: (value: string) => void
  fieldKey: string
}

export default function QuestionField({ question, value, onChange, fieldKey }: Props) {
  return (
    <div style={{ marginBottom: spacing[5] }}>
      <label
        style={{
          ...labelBase,
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
          marginBottom: spacing[2],
        }}
      >
        {question.libelle}
        {question.obligatoire && (
          <span style={{ color: colors.danger, fontWeight: fontWeights.bold }}> *</span>
        )}
        {question.portee === 'conjoint' && (
          <span
            style={{
              ...statusBadge.info,
              fontSize: fontSizes.xs,
              marginLeft: spacing[2],
            }}
          >
            Conjoint
          </span>
        )}
      </label>

      {question.type === 'texte' && (
        <TextField value={value} onChange={onChange} placeholder={question.placeholder} />
      )}
      {question.type === 'nombre' && (
        <NumberField value={value} onChange={onChange} placeholder={question.placeholder} />
      )}
      {question.type === 'date' && (
        <DateField value={value} onChange={onChange} />
      )}
      {question.type === 'booleen' && (
        <BooleanField value={value} onChange={onChange} fieldKey={fieldKey} />
      )}
      {question.type === 'liste' && (
        <SelectField value={value} onChange={onChange} options={question.options ?? []} />
      )}
      {question.type === 'multi_liste' && (
        <MultiSelectField value={value} onChange={onChange} options={question.options ?? []} />
      )}
    </div>
  )
}
