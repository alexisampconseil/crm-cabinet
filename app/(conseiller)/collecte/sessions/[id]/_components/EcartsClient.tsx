'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionEcart, CollecteSessionStatut } from '@/lib/collecte'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows, transitions,
  cardBase, tableHeaderCell, tableCell, badgeBase, statusBadge,
  inputBase, labelBase, buttonGold, buttonGhost, buttonDanger,
} from '@/lib/design-tokens'

// ── Constantes ─────────────────────────────────────────────────────────────────

const IMPACT_PRIORITY: Record<string, number> = { critique: 0, fort: 1, moyen: 2, faible: 3 }
const STATUT_PRIORITY: Record<string, number> = { a_revoir: 0, accepte: 1, rejete: 2, traite: 3 }

const IMPACT_LABELS: Record<string, string> = {
  critique: 'Critique', fort: 'Fort', moyen: 'Moyen', faible: 'Faible',
}

const STATUT_LABELS: Record<string, string> = {
  a_revoir: 'À décider', accepte: 'Accepté', rejete: 'Refusé', traite: 'Traité',
}

const BLOC_LABELS: Record<string, string> = {
  identite:         'Identité',
  foyer:            'Foyer',
  situation_pro:    'Situation pro.',
  revenus:          'Revenus',
  charges:          'Charges',
  actifs_financiers: 'Actifs financiers',
  immobilier:       'Immobilier',
  passifs:          'Passifs',
  fiscalite:        'Fiscalité',
  prevoyance:       'Prévoyance',
  objectifs:        'Objectifs',
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getValeur(v: Record<string, unknown> | null): string {
  if (!v) return '—'
  const val = (v as { valeur: string | null }).valeur
  if (val === null || val === '') return '(vide)'
  return val
}

function impactStyle(impact: string): React.CSSProperties {
  switch (impact) {
    case 'critique': return { ...badgeBase, backgroundColor: colors.dangerBg,  color: colors.danger,  border: `1px solid ${colors.dangerBorder}` }
    case 'fort':     return { ...badgeBase, backgroundColor: colors.warningBg, color: colors.warning, border: `1px solid ${colors.warningBorder}` }
    case 'moyen':    return { ...badgeBase, backgroundColor: colors.infoBg,    color: colors.info,    border: `1px solid ${colors.infoBorder}` }
    default:         return statusBadge.neutral
  }
}

function statutStyle(statut: string): React.CSSProperties {
  switch (statut) {
    case 'accepte': return statusBadge.success
    case 'rejete':  return statusBadge.danger
    case 'traite':  return statusBadge.neutral
    default:        return statusBadge.warning  // a_revoir
  }
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface Props {
  initialEcarts:  SessionEcart[]
  sessionId:      string
  initialStatut:  'en_revue' | 'valide'
}

// ── Composant ───────────────────────────────────────────────────────────────────

export default function EcartsClient({ initialEcarts, sessionId, initialStatut }: Props) {
  const router = useRouter()

  const [ecarts,            setEcarts]           = useState<SessionEcart[]>(initialEcarts)
  const [statut,            setStatut]           = useState<CollecteSessionStatut>(initialStatut)
  const [loadingEcartId,    setLoadingEcartId]   = useState<string | null>(null)
  const [modal,             setModal]            = useState<{ ecartId: string; libelle: string } | null>(null)
  const [motif,             setMotif]            = useState('')
  const [isSubmittingModal, setIsSubmittingModal] = useState(false)
  const [modalError,        setModalError]       = useState('')
  const [isValidating,      setIsValidating]     = useState(false)
  const [isApplying,        setIsApplying]       = useState(false)
  const [globalError,       setGlobalError]      = useState('')

  const sortedEcarts = useMemo(() => {
    return [...ecarts].sort((a, b) => {
      const sp = (STATUT_PRIORITY[a.statut] ?? 99) - (STATUT_PRIORITY[b.statut] ?? 99)
      if (sp !== 0) return sp
      return (IMPACT_PRIORITY[a.niveau_impact] ?? 99) - (IMPACT_PRIORITY[b.niveau_impact] ?? 99)
    })
  }, [ecarts])

  const nbARevoir = useMemo(() => ecarts.filter(e => e.statut === 'a_revoir').length, [ecarts])
  const nbAccepte = useMemo(() => ecarts.filter(e => e.statut === 'accepte').length, [ecarts])
  const nbRejete  = useMemo(() => ecarts.filter(e => e.statut === 'rejete').length,  [ecarts])
  const nbTotal   = ecarts.length

  function replaceEcart(updated: SessionEcart) {
    setEcarts(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  // ── Accepter ────────────────────────────────────────────────────────────────

  async function handleAccepter(ecart: SessionEcart) {
    setLoadingEcartId(ecart.id)
    setGlobalError('')
    replaceEcart({ ...ecart, statut: 'accepte' })  // optimiste
    try {
      const res = await fetch(
        `/api/collecte/sessions/${sessionId}/ecarts/${ecart.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'accepte' }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        replaceEcart(ecart)  // revert
        setGlobalError(data.error ?? 'Erreur lors de la validation')
      } else {
        replaceEcart(data as SessionEcart)
      }
    } catch {
      replaceEcart(ecart)  // revert
      setGlobalError('Erreur réseau — réessayez')
    } finally {
      setLoadingEcartId(null)
    }
  }

  // ── Modal refus ─────────────────────────────────────────────────────────────

  function openModal(ecart: SessionEcart) {
    setModal({ ecartId: ecart.id, libelle: ecart.libelle_lisible })
    setMotif('')
    setModalError('')
  }

  function closeModal() {
    setModal(null)
    setMotif('')
    setModalError('')
  }

  async function handleRejeter() {
    if (!modal) return
    if (!motif.trim()) { setModalError('Le motif est obligatoire'); return }
    setIsSubmittingModal(true)
    setModalError('')
    try {
      const res = await fetch(
        `/api/collecte/sessions/${sessionId}/ecarts/${modal.ecartId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rejete', motif: motif.trim() }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error ?? 'Erreur lors du refus')
      } else {
        replaceEcart(data as SessionEcart)
        closeModal()
      }
    } catch {
      setModalError('Erreur réseau — réessayez')
    } finally {
      setIsSubmittingModal(false)
    }
  }

  // ── Valider la session (en_revue → valide) ──────────────────────────────────

  async function handleValider() {
    setIsValidating(true)
    setGlobalError('')
    try {
      const res = await fetch(`/api/collecte/sessions/${sessionId}/valider`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setGlobalError(data.error ?? 'Erreur lors de la validation')
        setIsValidating(false)
      } else {
        // Transition vers la phase Application sans navigation — le bouton "Appliquer" apparaît
        setStatut('valide')
        setIsValidating(false)
      }
    } catch {
      setGlobalError('Erreur réseau — réessayez')
      setIsValidating(false)
    }
  }

  // ── Appliquer les écarts acceptés au référentiel (valide → archive) ──────────

  async function handleAppliquer() {
    setIsApplying(true)
    setGlobalError('')
    try {
      const res = await fetch(`/api/collecte/sessions/${sessionId}/appliquer-ecarts`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.archived) {
        router.push('/collecte')
      } else if (res.status === 207) {
        setGlobalError(
          `Application partielle : ${data.applied} écart(s) appliqué(s), ${data.errors?.length ?? 0} erreur(s). Relancez pour compléter.`
        )
        setIsApplying(false)
      } else if (data.snapshot_error) {
        setGlobalError(`Écarts appliqués — snapshot non généré : ${data.snapshot_error}. Relancez l'application.`)
        setIsApplying(false)
      } else {
        setGlobalError(data.archive_error ?? data.error ?? 'Erreur lors de l\'application')
        setIsApplying(false)
      }
    } catch {
      setGlobalError('Erreur réseau — réessayez')
      setIsApplying(false)
    }
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  const canValider = nbARevoir === 0 && !isValidating

  return (
    <>
      {globalError && (
        <div style={s.errorBanner}>{globalError}</div>
      )}

      {/* Table des écarts */}
      {nbTotal === 0 ? (
        <div style={{ ...cardBase, ...s.emptyCard }}>
          <p style={s.emptyText}>Aucun écart détecté — cette session peut être validée directement.</p>
        </div>
      ) : (
        <div style={{ ...cardBase, boxShadow: shadows.sm, marginBottom: spacing[6] }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderCell, width: '110px' }}>Bloc</th>
                <th style={tableHeaderCell}>Modification</th>
                <th style={{ ...tableHeaderCell, width: '140px' }}>Référence</th>
                <th style={{ ...tableHeaderCell, width: '140px' }}>Proposé</th>
                <th style={{ ...tableHeaderCell, width: '88px' }}>Impact</th>
                <th style={{ ...tableHeaderCell, width: '88px' }}>Statut</th>
                <th style={{ ...tableHeaderCell, width: '190px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedEcarts.map(ecart => {
                const isLoading = loadingEcartId === ecart.id
                const decided   = ecart.statut !== 'a_revoir'
                return (
                  <tr
                    key={ecart.id}
                    style={decided ? s.rowDecided : s.rowPending}
                  >
                    <td style={tableCell}>
                      <span style={s.blocBadge}>
                        {BLOC_LABELS[ecart.bloc] ?? ecart.bloc}
                      </span>
                    </td>
                    <td style={{ ...tableCell, maxWidth: '260px' }}>
                      <span style={s.libelleText} title={ecart.libelle_lisible}>
                        {ecart.libelle_lisible}
                      </span>
                    </td>
                    <td style={{ ...tableCell, ...s.valeurCell }}>
                      {getValeur(ecart.valeur_reference)}
                    </td>
                    <td style={{ ...tableCell, ...s.valeurCell, ...s.valeurProposee }}>
                      {getValeur(ecart.valeur_proposee)}
                    </td>
                    <td style={tableCell}>
                      <span style={impactStyle(ecart.niveau_impact)}>
                        {IMPACT_LABELS[ecart.niveau_impact] ?? ecart.niveau_impact}
                      </span>
                    </td>
                    <td style={tableCell}>
                      <span style={statutStyle(ecart.statut)}>
                        {STATUT_LABELS[ecart.statut] ?? ecart.statut}
                      </span>
                    </td>
                    <td style={tableCell}>
                      {ecart.statut === 'a_revoir' && (
                        <div style={s.actions}>
                          <button
                            onClick={() => handleAccepter(ecart)}
                            disabled={isLoading}
                            style={{
                              ...s.btnAccept,
                              opacity: isLoading ? 0.5 : 1,
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isLoading ? '…' : 'Accepter'}
                          </button>
                          <button
                            onClick={() => openModal(ecart)}
                            disabled={isLoading}
                            style={{
                              ...s.btnReject,
                              opacity: isLoading ? 0.5 : 1,
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Refuser
                          </button>
                        </div>
                      )}
                      {ecart.statut === 'rejete' && ecart.motif_rejet && (
                        <span style={s.motifText} title={ecart.motif_rejet}>
                          {ecart.motif_rejet.length > 48
                            ? ecart.motif_rejet.slice(0, 48) + '…'
                            : ecart.motif_rejet}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Phase En revue : validation de la revue */}
      {statut === 'en_revue' && (
        <div style={s.validateSection}>
          {nbARevoir > 0 && (
            <p style={s.validateHint}>
              {nbARevoir} écart{nbARevoir > 1 ? 's' : ''} rest{nbARevoir > 1 ? 'ent' : 'e'} à décider avant de pouvoir valider.
            </p>
          )}
          <button
            onClick={handleValider}
            disabled={!canValider}
            style={{
              ...buttonGold,
              opacity: canValider ? 1 : 0.4,
              cursor: canValider ? 'pointer' : 'not-allowed',
            } as React.CSSProperties}
          >
            {isValidating ? 'Validation en cours…' : 'Valider la session'}
          </button>
        </div>
      )}

      {/* Phase Valide : application au référentiel */}
      {statut === 'valide' && (
        <div style={s.applySection}>
          <div style={s.applyMeta}>
            <p style={s.applyLabel}>Revue terminée</p>
            <p style={s.applyDetail}>
              <strong>{nbAccepte}</strong> écart{nbAccepte !== 1 ? 's' : ''} à appliquer au référentiel
              {nbRejete > 0 && (
                <> · <strong>{nbRejete}</strong> refusé{nbRejete !== 1 ? 's' : ''} (valeur de référence conservée)</>
              )}
            </p>
          </div>
          <button
            onClick={handleAppliquer}
            disabled={isApplying}
            style={{
              ...buttonGold,
              opacity: isApplying ? 0.6 : 1,
              cursor: isApplying ? 'not-allowed' : 'pointer',
            } as React.CSSProperties}
          >
            {isApplying ? 'Application en cours…' : 'Appliquer les écarts acceptés'}
          </button>
        </div>
      )}

      {/* Modal de refus */}
      {modal && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Refuser cet écart</h2>
            <p style={s.modalLibelle}>{modal.libelle}</p>
            <div style={s.modalField}>
              <label style={labelBase}>Motif du refus *</label>
              <textarea
                value={motif}
                onChange={e => setMotif(e.target.value)}
                placeholder="Expliquer pourquoi ce changement est refusé…"
                rows={4}
                style={{ ...inputBase, resize: 'vertical' as const }}
              />
            </div>
            {modalError && <p style={s.modalError}>{modalError}</p>}
            <div style={s.modalActions}>
              <button
                onClick={closeModal}
                disabled={isSubmittingModal}
                style={{ ...buttonGhost, fontSize: fontSizes.xs } as React.CSSProperties}
              >
                Annuler
              </button>
              <button
                onClick={handleRejeter}
                disabled={isSubmittingModal}
                style={{
                  ...buttonDanger,
                  fontSize: fontSizes.xs,
                  opacity: isSubmittingModal ? 0.6 : 1,
                  cursor: isSubmittingModal ? 'not-allowed' : 'pointer',
                } as React.CSSProperties}
              >
                {isSubmittingModal ? 'Envoi…' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────────

const s = {
  table: { width: '100%', borderCollapse: 'collapse' as const },

  rowPending: { backgroundColor: colors.white } as React.CSSProperties,
  rowDecided: { backgroundColor: colors.offWhite } as React.CSSProperties,

  blocBadge: {
    ...badgeBase,
    backgroundColor: colors.bluePale,
    color: colors.blue,
    border: `1px solid ${colors.blueLight}`,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  libelleText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.text,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: '260px',
  } as React.CSSProperties,

  valeurCell: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  valeurProposee: {
    color: colors.blueDeep,
    fontWeight: fontWeights.medium,
  },

  actions: { display: 'flex', gap: spacing[2] },

  btnAccept: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '4px 10px',
    backgroundColor: colors.successBg,
    color: colors.success,
    border: `1px solid ${colors.successBorder}`,
    transition: transitions.fast,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  btnReject: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: colors.danger,
    border: `1px solid ${colors.dangerBorder}`,
    cursor: 'pointer',
    transition: transitions.fast,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  motifText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMid,
    fontStyle: 'italic' as const,
  },

  emptyCard: {
    padding: spacing[8],
    textAlign: 'center' as const,
    boxShadow: shadows.sm,
    marginBottom: spacing[6],
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textMid,
    fontStyle: 'italic' as const,
  },

  validateSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: spacing[3],
    padding: `${spacing[6]} 0`,
    borderTop: `1px solid ${colors.border}`,
  },
  validateHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    fontStyle: 'italic' as const,
  },

  applySection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[6],
    padding: `${spacing[6]} 0`,
    borderTop: `1px solid ${colors.border}`,
  },
  applyMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[1],
  },
  applyLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.blueDeep,
  },
  applyDetail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
  },

  errorBanner: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    padding: `${spacing[3]} ${spacing[4]}`,
    marginBottom: spacing[4],
  },

  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(45,68,98,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalBox: {
    ...cardBase,
    padding: spacing[8],
    maxWidth: '520px',
    width: '90%',
    boxShadow: shadows.xl,
  } as React.CSSProperties,
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    marginBottom: spacing[3],
  },
  modalLibelle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    fontStyle: 'italic' as const,
    padding: `${spacing[3]} ${spacing[4]}`,
    backgroundColor: colors.offWhite,
    borderLeft: `3px solid ${colors.blueLight}`,
    marginBottom: spacing[5],
  },
  modalField: { marginBottom: spacing[4] },
  modalError: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginBottom: spacing[3],
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[3],
    marginTop: spacing[5],
  },
}
