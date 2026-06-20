'use client'
import { useState, useRef, useEffect } from 'react'
import type {
  QuestionnaireStructure,
  QuestionnaireReponseBloc,
  QuestionnaireReponsePortee,
  QuestionnaireReponseType,
  SnapshotPrefill,
  CollecteSessionPerimetre,
  CollecteSessionStatut,
} from '@/lib/collecte'
import {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  letterSpacings,
  lineHeights,
  spacing,
} from '@/lib/design-tokens'
import {
  makeFormKey,
  resolvePrefillAbsolute,
  resolvePrefillItem,
  getRepeatableItems,
  evaluateConditions,
} from './prefillResolver'
import BlocCard from './BlocCard'

// ── Types ─────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

// Blocs où l'ajout d'une nouvelle instance est autorisé (Phase 8, objectif 1).
// 'enfants' (bloc foyer) reste hors scope malgré la même limitation technique.
const BLOCS_AVEC_AJOUT = new Set([
  'revenus', 'charges', 'actifs_financiers', 'immobilier', 'passifs', 'objectifs',
])

interface ResolvedMeta {
  bloc: QuestionnaireReponseBloc
  question_code: string
  portee: QuestionnaireReponsePortee
  groupe_instance_id: string | null
  reponse_type: QuestionnaireReponseType
}

interface Props {
  structure: QuestionnaireStructure
  snapshot: SnapshotPrefill | null
  perimetre: CollecteSessionPerimetre
  statut: CollecteSessionStatut
  versionLibelle: string
  kycToken: string
}

// ── Initialisation du state depuis le snapshot ────────────────────────────────

function initFormState(
  structure: QuestionnaireStructure,
  snapshot: SnapshotPrefill | null
): Map<string, string> {
  const map = new Map<string, string>()
  if (!snapshot) return map

  for (const bloc of structure.blocs) {
    for (const q of bloc.questions) {
      if (!q.repete && q.prefill_path) {
        map.set(
          makeFormKey(q.code, q.portee, null),
          resolvePrefillAbsolute(snapshot, q.prefill_path)
        )
      }
    }
    if (bloc.repete_source) {
      const items = getRepeatableItems(snapshot, bloc.repete_source)
      for (const item of items) {
        for (const q of bloc.questions) {
          if (q.repete && q.prefill_path) {
            map.set(
              makeFormKey(q.code, q.portee, item.id),
              resolvePrefillItem(item, q.prefill_path)
            )
          }
        }
      }
    }
  }

  return map
}

function initInstances(
  structure: QuestionnaireStructure,
  snapshot: SnapshotPrefill | null
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (!snapshot) return map

  for (const bloc of structure.blocs) {
    if (bloc.repete_source) {
      const items = getRepeatableItems(snapshot, bloc.repete_source)
      map.set(bloc.code, items.map(item => item.id))
    }
  }

  return map
}

// ── Résolution clé → métadonnées pour l'API autosave ─────────────────────────

function resolveMetaFromKey(
  key: string,
  structure: QuestionnaireStructure
): ResolvedMeta | null {
  const parts = key.split('|')
  if (parts.length !== 3) return null
  const [code, portee, groupeId] = parts

  for (const bloc of structure.blocs) {
    const q = bloc.questions.find(q => q.code === code && q.portee === portee)
    if (q) {
      return {
        bloc:               bloc.code as QuestionnaireReponseBloc,
        question_code:      code,
        portee:             portee as QuestionnaireReponsePortee,
        groupe_instance_id: groupeId || null,
        reponse_type:       q.type,
      }
    }
  }
  return null
}

// ── Validation client-side des champs obligatoires ────────────────────────────
// Exclut les questions répétables existantes (leur gestion par instance est Phase 4+).
// Couvre en revanche les nouvelles instances ajoutées localement (nouvellesInstances) —
// un ajout incomplet échouerait de toute façon à l'application au référentiel
// (colonnes NOT NULL), mieux vaut prévenir avant la soumission.
// Non bloquant — affiché en avertissement avant confirmation.

function checkRequiredFields(
  structure: QuestionnaireStructure,
  formState: Map<string, string>,
  perimetre: string,
  instances: Map<string, string[]>,
  nouvellesInstances: Set<string>
): string[] {
  const missing: string[] = []
  for (const bloc of structure.blocs) {
    for (const q of bloc.questions) {
      if (!q.obligatoire) continue

      if (!q.repete) {
        if (!evaluateConditions(q.conditions, formState, perimetre)) continue
        const val = formState.get(makeFormKey(q.code, q.portee, null)) ?? ''
        if (val === '') missing.push(`${bloc.libelle} — ${q.libelle}`)
        continue
      }

      // Question répétable : ne valider que les nouvelles instances de ce bloc
      const idsNouveaux = (instances.get(bloc.code) ?? []).filter(id => nouvellesInstances.has(id))
      for (const groupeId of idsNouveaux) {
        const val = formState.get(makeFormKey(q.code, q.portee, groupeId)) ?? ''
        if (val === '') missing.push(`${bloc.libelle} — ${q.libelle} (nouvel élément)`)
      }
    }
  }
  return missing
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function QuestionnaireForm({
  structure,
  snapshot,
  perimetre,
  statut,
  versionLibelle,
  kycToken,
}: Props) {
  const [formState, setFormState] = useState<Map<string, string>>(
    () => initFormState(structure, snapshot)
  )
  const [instances, setInstances] = useState<Map<string, string[]>>(
    () => initInstances(structure, snapshot)
  )
  // groupe_instance_id créés localement par "Ajouter un élément" — jamais envoyé
  // tel quel à l'API, sert uniquement à injecter reponse_metadata.nouvelle_instance.
  const [nouvellesInstances, setNouvellesInstances] = useState<Set<string>>(new Set())

  // Autosave
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const debounceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Soumission
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted,  setIsSubmitted]  = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current)  clearTimeout(debounceTimerRef.current)
      if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current)
    }
  }, [])

  // ── Ajout d'une nouvelle instance dans un bloc répétable ─────────────────────

  const PLAFOND_INSTANCES_PAR_BLOC = 20

  const handleAjouterInstance = (blocCode: string) => {
    const actuelles = instances.get(blocCode) ?? []
    if (actuelles.length >= PLAFOND_INSTANCES_PAR_BLOC) return

    const id = crypto.randomUUID()
    setInstances(prev => new Map(prev).set(blocCode, [...(prev.get(blocCode) ?? []), id]))
    setNouvellesInstances(prev => new Set(prev).add(id))
  }

  // ── Autosave ────────────────────────────────────────────────────────────────

  const saveField = async (key: string, value: string) => {
    const meta = resolveMetaFromKey(key, structure)
    if (!meta) return

    setSaveStatus('saving')

    try {
      const res = await fetch('/api/collecte/portail/reponse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kyc_token:          kycToken,
          bloc:               meta.bloc,
          question_code:      meta.question_code,
          portee:             meta.portee,
          groupe_instance_id: meta.groupe_instance_id,
          reponse_type:       meta.reponse_type,
          reponse_valeur:     value !== '' ? value : null,
          reponse_metadata:   meta.groupe_instance_id && nouvellesInstances.has(meta.groupe_instance_id)
            ? { nouvelle_instance: true }
            : {},
        }),
      })

      if (!res.ok) { setSaveStatus('error'); return }

      setSaveStatus('saved')
      if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current)
      savedResetTimerRef.current = setTimeout(
        () => setSaveStatus(s => (s === 'saved' ? 'idle' : s)),
        3000
      )
    } catch {
      setSaveStatus('error')
    }
  }

  const handleChange = (key: string, value: string, immediate = false) => {
    setFormState(prev => new Map(prev).set(key, value))
    setSaveStatus('pending')

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(
      () => saveField(key, value),
      immediate ? 0 : 400
    )
  }

  // ── Soumission ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    // Annuler tout debounce en vol — les valeurs des 400 dernières ms non encore
    // sauvegardées sont perdues ; le client a confirmé qu'il soumettait.
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    setIsSubmitting(true)
    setSubmitError(null)
    setShowConfirm(false)

    try {
      const res = await fetch('/api/collecte/portail/soumettre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kyc_token: kycToken }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubmitError((data as { error?: string }).error ?? 'Erreur lors de la soumission')
        setIsSubmitting(false)
        return
      }

      setIsSubmitted(true)
    } catch {
      setSubmitError('Erreur réseau — veuillez réessayer')
      setIsSubmitting(false)
    }
  }

  // ── Panneau de succès (remplace le formulaire après soumission) ───────────

  if (isSubmitted) {
    return <SuccessPanel />
  }

  const blocsOrdonnes  = [...structure.blocs].sort((a, b) => a.ordre - b.ordre)
  const missingFields  = showConfirm
    ? checkRequiredFields(structure, formState, perimetre, instances, nouvellesInstances)
    : []
  const canSubmit = !isSubmitting && saveStatus !== 'saving'

  return (
    <div>
      <SaveIndicator status={saveStatus} />

      {/* En-tête version */}
      <div style={{ marginBottom: spacing[6], paddingBottom: spacing[3], borderBottom: `1px solid ${colors.border}` }}>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.bold,
            letterSpacing: letterSpacings.label,
            textTransform: 'uppercase',
            color: colors.textLight,
            margin: 0,
          }}
        >
          {versionLibelle}
        </p>
      </div>

      {/* Blocs ordonnés */}
      {blocsOrdonnes.map(bloc => (
        <BlocCard
          key={bloc.code}
          bloc={bloc}
          formState={formState}
          instances={instances.get(bloc.code) ?? []}
          onChange={handleChange}
          perimetre={perimetre}
          onAjouterInstance={
            BLOCS_AVEC_AJOUT.has(bloc.code) ? () => handleAjouterInstance(bloc.code) : undefined
          }
          plafondAtteint={(instances.get(bloc.code) ?? []).length >= PLAFOND_INSTANCES_PAR_BLOC}
        />
      ))}

      {/* Section soumission */}
      <div
        style={{
          borderTop: `2px solid ${colors.border}`,
          paddingTop: spacing[6],
          marginTop: spacing[4],
        }}
      >
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!canSubmit}
            style={{
              fontFamily: fonts.body,
              fontSize: fontSizes.sm,
              fontWeight: fontWeights.medium,
              letterSpacing: letterSpacings.wider,
              textTransform: 'uppercase' as const,
              backgroundColor: canSubmit ? colors.gold : colors.border,
              color: colors.white,
              border: 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              padding: '12px 32px',
            }}
          >
            Soumettre mon questionnaire
          </button>
        ) : (
          <div
            style={{
              backgroundColor: colors.warningBg,
              border: `1px solid ${colors.warningBorder}`,
              padding: spacing[6],
            }}
          >
            <p
              style={{
                fontFamily: fonts.body,
                fontSize: fontSizes.base,
                color: colors.warning,
                fontWeight: fontWeights.medium,
                marginBottom: spacing[4],
                lineHeight: lineHeights.relaxed,
              }}
            >
              Cette action est irréversible. Vos réponses seront transmises définitivement à votre conseiller.
            </p>

            {missingFields.length > 0 && (
              <div
                style={{
                  backgroundColor: colors.dangerBg,
                  border: `1px solid ${colors.dangerBorder}`,
                  padding: spacing[4],
                  marginBottom: spacing[4],
                  fontFamily: fonts.body,
                  fontSize: fontSizes.sm,
                  color: colors.danger,
                }}
              >
                <strong>Champs obligatoires non renseignés :</strong>
                <ul style={{ margin: `${spacing[2]} 0 0`, paddingLeft: spacing[5] }}>
                  {missingFields.map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: spacing[4], flexWrap: 'wrap' as const }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSizes.sm,
                  fontWeight: fontWeights.medium,
                  letterSpacing: letterSpacings.wider,
                  textTransform: 'uppercase' as const,
                  backgroundColor: 'transparent',
                  color: colors.blueDeep,
                  border: `1.5px solid ${colors.blueLight}`,
                  cursor: 'pointer',
                  padding: '10px 24px',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSizes.sm,
                  fontWeight: fontWeights.medium,
                  letterSpacing: letterSpacings.wider,
                  textTransform: 'uppercase' as const,
                  backgroundColor: isSubmitting ? colors.border : colors.blueDeep,
                  color: colors.white,
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  padding: '10px 24px',
                }}
              >
                {isSubmitting ? 'Soumission en cours…' : 'Confirmer la soumission'}
              </button>
            </div>

            {submitError && (
              <p
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSizes.sm,
                  color: colors.danger,
                  marginTop: spacing[4],
                }}
              >
                {submitError}
              </p>
            )}
          </div>
        )}
      </div>

      <p
        style={{
          fontFamily: fonts.body,
          fontSize: fontSizes.xs,
          color: colors.textLight,
          letterSpacing: letterSpacings.wide,
          marginTop: spacing[4],
          fontStyle: 'italic',
        }}
      >
        Les champs marqués * sont obligatoires.
      </p>
    </div>
  )
}

// ── Indicateur de sauvegarde ─────────────────────────────────────────────────

const SAVE_CONFIG: Record<
  Exclude<SaveStatus, 'idle'>,
  { bg: string; border: string; color: string; message: string }
> = {
  pending: { bg: colors.infoBg, border: colors.infoBorder, color: colors.info, message: 'Sauvegarde en cours…' },
  saving:  { bg: colors.infoBg, border: colors.infoBorder, color: colors.info, message: 'Sauvegarde en cours…' },
  saved:   { bg: colors.successBg, border: colors.successBorder, color: colors.success, message: 'Sauvegardé' },
  error:   { bg: colors.warningBg, border: colors.warningBorder, color: colors.warning, message: 'Erreur de sauvegarde — vos modifications sont conservées localement' },
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  const cfg = SAVE_CONFIG[status]
  return (
    <div
      style={{
        backgroundColor: cfg.bg,
        border:          `1px solid ${cfg.border}`,
        color:           cfg.color,
        padding:         `${spacing[3]} ${spacing[5]}`,
        marginBottom:    spacing[6],
        fontFamily:      fonts.body,
        fontSize:        fontSizes.base,
        fontWeight:      fontWeights.medium,
      }}
    >
      {cfg.message}
    </div>
  )
}

// ── Panneau de succès ─────────────────────────────────────────────────────────

function SuccessPanel() {
  return (
    <div
      style={{
        backgroundColor: colors.successBg,
        border:          `1px solid ${colors.successBorder}`,
        padding:         spacing[8],
        textAlign:       'center' as const,
      }}
    >
      <div
        style={{
          width:           '40px',
          height:          '2px',
          backgroundColor: colors.gold,
          margin:          '0 auto',
          marginBottom:    spacing[5],
        }}
      />
      <h2
        style={{
          fontFamily:   fonts.heading,
          fontSize:     '1.4rem',
          fontWeight:   fontWeights.light,
          color:        colors.success,
          marginBottom: spacing[4],
        }}
      >
        Questionnaire transmis avec succès
      </h2>
      <p
        style={{
          fontFamily:   fonts.body,
          fontSize:     fontSizes.base,
          color:        colors.text,
          lineHeight:   lineHeights.relaxed,
          marginBottom: spacing[6],
          maxWidth:     '480px',
          margin:       `0 auto ${spacing[6]}`,
        }}
      >
        Vos réponses ont été transmises à votre conseiller.
        Vous serez contacté prochainement.
      </p>
      <p
        style={{
          fontSize:        fontSizes.xs,
          color:           colors.textLight,
          letterSpacing:   letterSpacings.wide,
        }}
      >
        AMP CONSEIL — 06 82 18 18 45 — contact@ampconseil.com
      </p>
    </div>
  )
}
