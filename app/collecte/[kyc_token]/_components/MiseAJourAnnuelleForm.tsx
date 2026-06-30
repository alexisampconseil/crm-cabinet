'use client'
// Logique identique à QuestionnaireForm pour la gestion du state (formState,
// instances, debounce autosave) — mais rendu différent : les 11 blocs sont
// groupés en 3 méga-catégories avec une question "rien n'a changé / modifier".
// Les groupes "inchangés" sont auto-soumis via /reponses-bulk avant la
// soumission finale, ce qui satisfait la contrainte "au moins une réponse"
// de /portail/soumettre tout en produisant 0 écart dans la détection (les
// valeurs soumises = les valeurs du snapshot_prefill = état connu du conseiller).
import { useState, useRef, useEffect } from 'react'
import type {
  QuestionnaireStructure,
  QuestionnaireReponseBloc,
  QuestionnaireReponsePortee,
  QuestionnaireReponseType,
  SnapshotPrefill,
  CollecteSessionPerimetre,
} from '@/lib/collecte'
import { colors, fonts, fontSizes, fontWeights, letterSpacings, lineHeights, spacing } from '@/lib/design-tokens'
import {
  makeFormKey,
  resolvePrefillAbsolute,
  resolvePrefillItem,
  getRepeatableItems,
} from './prefillResolver'
import BlocCard from './BlocCard'
import { SituationReadonly } from './SituationReadonly'

// ── Constantes ────────────────────────────────────────────────────────────────

const GROUPES: Array<{ titre: string; blocs: string[] }> = [
  {
    titre: 'Votre situation familiale et professionnelle',
    blocs: ['identite', 'foyer', 'situation_pro'],
  },
  {
    titre: 'Votre patrimoine',
    blocs: ['revenus', 'charges', 'actifs_financiers', 'immobilier', 'passifs', 'fiscalite', 'prevoyance'],
  },
  {
    titre: 'Vos objectifs patrimoniaux',
    blocs: ['objectifs'],
  },
]

const BLOCS_AVEC_AJOUT = new Set([
  'revenus', 'charges', 'actifs_financiers', 'immobilier', 'passifs', 'objectifs',
])

const SUPPRIME_QUESTION: Record<string, { code: string; portee: QuestionnaireReponsePortee }> = {
  actifs_financiers: { code: 'af_supprime',     portee: 'client' },
  immobilier:        { code: 'immo_supprime',   portee: 'client' },
  passifs:           { code: 'passif_supprime', portee: 'foyer'  },
  revenus:           { code: 'rev_supprime',    portee: 'foyer'  },
  charges:           { code: 'chg_supprime',    portee: 'foyer'  },
  objectifs:         { code: 'obj_supprime',    portee: 'client' },
}

// ── Helpers d'initialisation (miroir de QuestionnaireForm) ────────────────────

function initFormState(
  structure: QuestionnaireStructure,
  snapshot: SnapshotPrefill
): Map<string, string> {
  const map = new Map<string, string>()
  for (const bloc of structure.blocs) {
    for (const q of bloc.questions) {
      if (!q.repete && q.prefill_path) {
        map.set(makeFormKey(q.code, q.portee, null), resolvePrefillAbsolute(snapshot, q.prefill_path))
      }
    }
    if (bloc.repete_source) {
      const items = getRepeatableItems(snapshot, bloc.repete_source)
      for (const item of items) {
        for (const q of bloc.questions) {
          if (q.repete && q.prefill_path) {
            map.set(makeFormKey(q.code, q.portee, item.id), resolvePrefillItem(item, q.prefill_path))
          }
        }
      }
    }
  }
  return map
}

function initInstances(
  structure: QuestionnaireStructure,
  snapshot: SnapshotPrefill
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const bloc of structure.blocs) {
    if (bloc.repete_source) {
      const items = getRepeatableItems(snapshot, bloc.repete_source)
      map.set(bloc.code, items.map(item => item.id))
    }
  }
  return map
}

function resolveMetaFromKey(
  key: string,
  structure: QuestionnaireStructure
): { bloc: QuestionnaireReponseBloc; question_code: string; portee: QuestionnaireReponsePortee; groupe_instance_id: string | null; reponse_type: QuestionnaireReponseType } | null {
  const parts = key.split('|')
  if (parts.length !== 3) return null
  const [code, portee, groupeId] = parts
  for (const bloc of structure.blocs) {
    const q = bloc.questions.find(q => q.code === code && q.portee === portee)
    if (q) {
      return {
        bloc: bloc.code as QuestionnaireReponseBloc,
        question_code: code,
        portee: portee as QuestionnaireReponsePortee,
        groupe_instance_id: groupeId || null,
        reponse_type: q.type,
      }
    }
  }
  return null
}

// Construit tous les payloads de réponse pour les blocs d'un groupe "inchangé".
function buildPrefillPayloads(
  structure: QuestionnaireStructure,
  formState: Map<string, string>,
  instances: Map<string, string[]>,
  groupeIndex: number
): Array<{ bloc: string; question_code: string; portee: string; groupe_instance_id: string | null; reponse_type: string; reponse_valeur: string | null; reponse_metadata: Record<string, unknown> }> {
  const targetBlocs = new Set(GROUPES[groupeIndex].blocs)
  const payloads: ReturnType<typeof buildPrefillPayloads> = []

  for (const bloc of structure.blocs) {
    if (!targetBlocs.has(bloc.code)) continue
    for (const q of bloc.questions) {
      if (q.repete || !q.prefill_path) continue
      const val = formState.get(makeFormKey(q.code, q.portee, null)) ?? ''
      payloads.push({ bloc: bloc.code, question_code: q.code, portee: q.portee, groupe_instance_id: null, reponse_type: q.type, reponse_valeur: val !== '' ? val : null, reponse_metadata: {} })
    }
    if (bloc.repete_source) {
      const ids = instances.get(bloc.code) ?? []
      for (const id of ids) {
        for (const q of bloc.questions) {
          if (!q.repete || !q.prefill_path) continue
          const val = formState.get(makeFormKey(q.code, q.portee, id)) ?? ''
          payloads.push({ bloc: bloc.code, question_code: q.code, portee: q.portee, groupe_instance_id: id, reponse_type: q.type, reponse_valeur: val !== '' ? val : null, reponse_metadata: {} })
        }
      }
    }
  }
  return payloads
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  structure: QuestionnaireStructure
  snapshot: SnapshotPrefill
  perimetre: CollecteSessionPerimetre
  versionLibelle: string
  kycToken: string
}

type GroupeDecision = 'unchanged' | 'changed' | null

export default function MiseAJourAnnuelleForm({
  structure, snapshot, perimetre, kycToken,
}: Props) {
  const [decisions, setDecisions] = useState<[GroupeDecision, GroupeDecision, GroupeDecision]>([null, null, null])
  const [formState, setFormState] = useState<Map<string, string>>(
    () => initFormState(structure, snapshot)
  )
  const [instances, setInstances] = useState<Map<string, string[]>>(
    () => initInstances(structure, snapshot)
  )
  const [nouvellesInstances, setNouvellesInstances] = useState<Set<string>>(new Set())

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const allDecided = decisions.every(d => d !== null)

  // ── Autosave (pour les groupes "changed") ─────────────────────────────────

  const saveField = async (key: string, value: string) => {
    const meta = resolveMetaFromKey(key, structure)
    if (!meta) return
    await fetch('/api/collecte/portail/reponse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kyc_token: kycToken,
        bloc: meta.bloc,
        question_code: meta.question_code,
        portee: meta.portee,
        groupe_instance_id: meta.groupe_instance_id,
        reponse_type: meta.reponse_type,
        reponse_valeur: value !== '' ? value : null,
        reponse_metadata: meta.groupe_instance_id && nouvellesInstances.has(meta.groupe_instance_id)
          ? { nouvelle_instance: true } : {},
      }),
    })
  }

  const handleChange = (key: string, value: string, immediate = false) => {
    setFormState(prev => new Map(prev).set(key, value))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveField(key, value), immediate ? 0 : 400)
  }

  // ── Gestion des instances répétables (miroir de QuestionnaireForm) ─────────

  const handleAjouterInstance = (blocCode: string) => {
    const id = crypto.randomUUID()
    setInstances(prev => new Map(prev).set(blocCode, [...(prev.get(blocCode) ?? []), id]))
    setNouvellesInstances(prev => new Set(prev).add(id))
  }

  const handleSupprimerInstance = async (blocCode: string, groupeId: string) => {
    setInstances(prev => new Map(prev).set(blocCode, (prev.get(blocCode) ?? []).filter(id => id !== groupeId)))
    if (nouvellesInstances.has(groupeId)) {
      setNouvellesInstances(prev => { const n = new Set(prev); n.delete(groupeId); return n })
      await fetch('/api/collecte/portail/reponse', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kyc_token: kycToken, groupe_instance_id: groupeId }),
      })
      return
    }
    const marker = SUPPRIME_QUESTION[blocCode]
    if (!marker) return
    const key = makeFormKey(marker.code, marker.portee, groupeId)
    setFormState(prev => new Map(prev).set(key, 'true'))
    await fetch('/api/collecte/portail/reponse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kyc_token: kycToken, bloc: blocCode, question_code: marker.code, portee: marker.portee, groupe_instance_id: groupeId, reponse_type: 'booleen', reponse_valeur: 'true', reponse_metadata: {} }),
    })
  }

  // ── Validation finale ─────────────────────────────────────────────────────

  const handleValider = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSubmitting(true)
    setError(null)

    // 1. Auto-soumettre les réponses prefill pour les groupes "inchangés"
    const payloads = [0, 1, 2].flatMap(i =>
      decisions[i as 0|1|2] === 'unchanged'
        ? buildPrefillPayloads(structure, formState, instances, i)
        : []
    )

    if (payloads.length > 0) {
      const bulkRes = await fetch('/api/collecte/portail/reponses-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kyc_token: kycToken, reponses: payloads }),
      })
      if (!bulkRes.ok && bulkRes.status !== 207) {
        setError('Erreur lors de la transmission des informations confirmées. Réessayez.')
        setSubmitting(false)
        return
      }
    }

    // 2. Soumettre la collecte
    const res = await fetch('/api/collecte/portail/soumettre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kyc_token: kycToken }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Erreur lors de la soumission. Réessayez.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
  }

  // ── Succès ────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ backgroundColor: colors.successBg, border: `1px solid ${colors.successBorder}`, padding: spacing[8], textAlign: 'center' as const }}>
        <div style={{ width: 40, height: 2, backgroundColor: colors.gold, margin: '0 auto', marginBottom: spacing[5] }} />
        <h2 style={{ fontFamily: fonts.heading, fontSize: '1.4rem', fontWeight: fontWeights.light, color: colors.success, marginBottom: spacing[4] }}>
          Mise à jour transmise avec succès
        </h2>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, lineHeight: lineHeights.relaxed, maxWidth: 480, margin: `0 auto ${spacing[4]}` }}>
          Votre conseiller a bien reçu votre confirmation. Vous serez contacté si une validation supplémentaire est nécessaire.
        </p>
        <p style={{ fontSize: fontSizes.xs, color: colors.textLight, letterSpacing: letterSpacings.wide }}>
          AMP CONSEIL — 06 82 18 18 45 — contact@ampconseil.com
        </p>
      </div>
    )
  }

  // ── Rendu des 3 groupes ───────────────────────────────────────────────────

  return (
    <div>
      {/* Intro */}
      <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: spacing[5], marginBottom: spacing[6] }}>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid, lineHeight: lineHeights.relaxed }}>
          Vérifiez que les informations ci-dessous sont toujours exactes.
          Pour chaque rubrique, indiquez si votre situation a changé.
        </p>
      </div>

      {GROUPES.map((groupe, gi) => {
        const decision = decisions[gi as 0|1|2]
        const blocs = structure.blocs
          .filter(b => groupe.blocs.includes(b.code))
          .sort((a, b) => a.ordre - b.ordre)

        return (
          <div key={gi} style={s.groupCard}>
            {/* Titre du groupe */}
            <div style={s.groupHeader}>
              <span style={s.groupNum}>{String(gi + 1).padStart(2, '0')}</span>
              <h3 style={s.groupTitle}>{groupe.titre}</h3>
              {decision && (
                <span style={decision === 'unchanged' ? s.badgeOk : s.badgeChanged}>
                  {decision === 'unchanged' ? '✓ Confirmé inchangé' : '✎ À modifier'}
                </span>
              )}
            </div>

            {/* Situation actuelle en lecture seule */}
            <SituationReadonly groupe={gi as 0|1|2} snapshot={snapshot} />

            {/* Boutons Y/N — toujours visibles pour permettre de changer d'avis */}
            <div style={s.ynRow}>
              <button
                onClick={() => setDecisions(prev => { const n = [...prev] as typeof prev; n[gi as 0|1|2] = 'unchanged'; return n })}
                style={{ ...s.ynBtn, ...(decision === 'unchanged' ? s.ynBtnSelected : {}) }}
              >
                Rien n&apos;a changé
              </button>
              <button
                onClick={() => setDecisions(prev => { const n = [...prev] as typeof prev; n[gi as 0|1|2] = 'changed'; return n })}
                style={{ ...s.ynBtn, ...(decision === 'changed' ? s.ynBtnAlt : {}) }}
              >
                Des modifications à apporter
              </button>
            </div>

            {/* Formulaire de modification — uniquement si décision = changed */}
            {decision === 'changed' && (
              <div style={s.editZone}>
                <p style={s.editIntro}>
                  Apportez vos corrections ci-dessous. Chaque modification est sauvegardée automatiquement.
                </p>
                {blocs.map(bloc => (
                  <BlocCard
                    key={bloc.code}
                    bloc={bloc}
                    formState={formState}
                    instances={instances.get(bloc.code) ?? []}
                    onChange={handleChange}
                    perimetre={perimetre}
                    onAjouterInstance={BLOCS_AVEC_AJOUT.has(bloc.code) ? () => handleAjouterInstance(bloc.code) : undefined}
                    plafondAtteint={(instances.get(bloc.code) ?? []).length >= 20}
                    onSupprimerInstance={BLOCS_AVEC_AJOUT.has(bloc.code) ? (id) => handleSupprimerInstance(bloc.code, id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Validation finale */}
      <div style={{ borderTop: `2px solid ${colors.border}`, paddingTop: spacing[6], marginTop: spacing[4] }}>
        {!allDecided && (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, marginBottom: spacing[4] }}>
            Répondez aux 3 rubriques pour pouvoir valider.
          </p>
        )}
        {error && (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginBottom: spacing[4] }}>
            {error}
          </p>
        )}
        <button
          onClick={handleValider}
          disabled={!allDecided || submitting}
          style={{
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.medium,
            letterSpacing: letterSpacings.wider,
            textTransform: 'uppercase' as const,
            backgroundColor: allDecided && !submitting ? colors.gold : colors.border,
            color: colors.white,
            border: 'none',
            cursor: allDecided && !submitting ? 'pointer' : 'not-allowed',
            padding: '12px 32px',
          }}
        >
          {submitting ? 'Transmission en cours…' : 'Valider ma situation'}
        </button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  groupCard: {
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    marginBottom: spacing[5],
    padding: spacing[6],
    overflow: 'hidden',
  } as React.CSSProperties,
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  } as React.CSSProperties,
  groupNum: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    flexShrink: 0,
  } as React.CSSProperties,
  groupTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.blueDeep,
    flex: 1,
  } as React.CSSProperties,
  badgeOk: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.success,
    backgroundColor: colors.successBg,
    padding: `2px 8px`,
    flexShrink: 0,
  } as React.CSSProperties,
  badgeChanged: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    padding: `2px 8px`,
    flexShrink: 0,
  } as React.CSSProperties,
  ynRow: {
    display: 'flex',
    gap: spacing[3],
    marginTop: spacing[5],
    flexWrap: 'wrap' as const,
  },
  ynBtn: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.blueDeep,
    backgroundColor: 'transparent',
    border: `1.5px solid ${colors.blueLight}`,
    cursor: 'pointer',
    padding: '10px 20px',
  } as React.CSSProperties,
  ynBtnSelected: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    color: colors.success,
  } as React.CSSProperties,
  ynBtnAlt: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    color: colors.warning,
  } as React.CSSProperties,
  editZone: {
    marginTop: spacing[5],
    paddingTop: spacing[5],
    borderTop: `1px solid ${colors.border}`,
  } as React.CSSProperties,
  editIntro: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    marginBottom: spacing[5],
    lineHeight: lineHeights.relaxed,
  } as React.CSSProperties,
}
