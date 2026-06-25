'use client'
import type { QuestionnaireBloc } from '@/lib/collecte'
import { colors, fonts, fontSizes, fontWeights, letterSpacings, spacing } from '@/lib/design-tokens'
import { makeFormKey, evaluateConditions } from './prefillResolver'
import QuestionField from './QuestionField'

interface Props {
  bloc: QuestionnaireBloc
  formState: Map<string, string>
  instances: string[]   // groupe_instance_ids pour les questions répétables de ce bloc
  // immediate=true : liste, booleen, multi_liste — sélection atomique, pas de debounce
  onChange: (key: string, value: string, immediate?: boolean) => void
  perimetre: string
  // Présent uniquement pour les blocs où l'ajout est autorisé (voir BLOCS_AVEC_AJOUT)
  onAjouterInstance?: () => void
  plafondAtteint?: boolean
}

export default function BlocCard({
  bloc, formState, instances, onChange, perimetre, onAjouterInstance, plafondAtteint,
}: Props) {
  const fixedQuestions = bloc.questions.filter(q => !q.repete)
  const repeatableQuestions = bloc.questions.filter(q => q.repete)

  return (
    <div
      style={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.border}`,
        marginBottom: spacing[5],
        overflow: 'hidden',
      }}
    >
      {/* En-tête du bloc */}
      <div
        style={{
          borderLeft: `3px solid ${colors.gold}`,
          padding: `${spacing[4]} ${spacing[6]}`,
          backgroundColor: colors.bluePale,
        }}
      >
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.bold,
            letterSpacing: letterSpacings.label,
            textTransform: 'uppercase' as const,
            color: colors.blueDeep,
            margin: 0,
          }}
        >
          {bloc.libelle}
        </p>
      </div>

      {/* Corps */}
      <div style={{ padding: `${spacing[5]} ${spacing[6]}` }}>

        {/* Questions fixes (non-répétables) */}
        {fixedQuestions.map(question => {
          const visible = evaluateConditions(question.conditions, formState, perimetre)
          if (!visible) return null
          const key = makeFormKey(question.code, question.portee, null)
          return (
            <QuestionField
              key={key}
              question={question}
              value={formState.get(key) ?? ''}
              onChange={value => onChange(key, value, ['liste', 'booleen', 'multi_liste'].includes(question.type))}
              fieldKey={key}
            />
          )
        })}

        {/* Section répétable (instances) */}
        {repeatableQuestions.length > 0 && (
          <div>
            {fixedQuestions.length > 0 && (
              <div
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  marginBottom: spacing[5],
                  paddingTop: spacing[4],
                }}
              />
            )}

            {instances.length === 0 && (
              <p
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSizes.base,
                  color: colors.textLight,
                  fontStyle: 'italic',
                  marginBottom: onAjouterInstance ? spacing[4] : 0,
                }}
              >
                Aucun élément renseigné dans votre dossier.
              </p>
            )}

            {instances.map((groupeId, idx) => (
              <div
                key={groupeId}
                style={{
                  borderLeft: `2px solid ${colors.blueLight}`,
                  paddingLeft: spacing[5],
                  marginBottom: idx < instances.length - 1 ? spacing[6] : 0,
                }}
              >
                <p
                  style={{
                    fontFamily: fonts.body,
                    fontSize: fontSizes.xs,
                    fontWeight: fontWeights.bold,
                    letterSpacing: letterSpacings.wide,
                    textTransform: 'uppercase' as const,
                    color: colors.textMid,
                    marginBottom: spacing[4],
                  }}
                >
                  Élément {idx + 1}
                </p>

                {repeatableQuestions.map(question => {
                  // Condition résolue DANS la même instance (groupeId) — ex :
                  // n'afficher "employeur" que si "nature"='salaire' pour cette ligne.
                  const visible = evaluateConditions(question.conditions, formState, perimetre, groupeId)
                  if (!visible) return null
                  const key = makeFormKey(question.code, question.portee, groupeId)
                  return (
                    <QuestionField
                      key={key}
                      question={question}
                      value={formState.get(key) ?? ''}
                      onChange={value => onChange(key, value, ['liste', 'booleen', 'multi_liste'].includes(question.type))}
                      fieldKey={key}
                    />
                  )
                })}
              </div>
            ))}

            {onAjouterInstance && (
              <div style={{ marginTop: instances.length > 0 ? spacing[5] : 0 }}>
                <button
                  type="button"
                  onClick={onAjouterInstance}
                  disabled={plafondAtteint}
                  style={{
                    fontFamily: fonts.body,
                    fontSize: fontSizes.sm,
                    fontWeight: fontWeights.medium,
                    color: plafondAtteint ? colors.textLight : colors.blue,
                    backgroundColor: 'transparent',
                    border: `1px solid ${plafondAtteint ? colors.border : colors.blueLight}`,
                    padding: `${spacing[2]} ${spacing[4]}`,
                    cursor: plafondAtteint ? 'not-allowed' : 'pointer',
                  }}
                >
                  + Ajouter un élément
                </button>
                {plafondAtteint && (
                  <p
                    style={{
                      fontFamily: fonts.body,
                      fontSize: fontSizes.xs,
                      color: colors.textLight,
                      fontStyle: 'italic',
                      marginTop: spacing[2],
                    }}
                  >
                    Nombre maximum d&apos;éléments atteint pour cette section.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
