'use client'

import { useEffect, useState } from 'react'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows, cardBase, buttonGold,
  inputBase, labelBase, buttonGhost,
} from '@/lib/design-tokens'

interface DocumentKyc {
  id: string
  numero_sequence: number
  genere_le: string
  statut: 'actif' | 'annule'
  annule_le: string | null
  motif_annulation: string | null
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(d))
}

export default function DocumentsKycSection({ clientId }: { clientId: string }) {
  const [documents, setDocuments] = useState<DocumentKyc[]>([])
  const [loaded, setLoaded]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // État du modal d'annulation
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelMotif, setCancelMotif]   = useState('')
  const [cancelling, setCancelling]     = useState(false)
  const [cancelError, setCancelError]   = useState('')

  function loadDocuments() {
    return fetch(`/api/clients/${clientId}/documents-generes?template_code=kyc_particulier`)
      .then(res => res.json())
      .then(data => { setDocuments(data.documents ?? []) })
      .catch(() => { setDocuments([]) })
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/clients/${clientId}/documents-generes?template_code=kyc_particulier`)
      .then(res => res.json())
      .then(data => { if (!cancelled) { setDocuments(data.documents ?? []); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [clientId])

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch(`/api/clients/${clientId}/generer-kyc-pdf`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error ?? 'Erreur lors de la génération')
      } else {
        await loadDocuments()
      }
    } catch {
      setGenerateError('Erreur réseau — réessayez')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(archiveId: string) {
    const res = await fetch(`/api/documents-generes/${archiveId}/signed-url`)
    const data = await res.json()
    if (res.ok && data.url) window.open(data.url, '_blank')
  }

  function openCancelModal(archiveId: string) {
    setCancelTarget(archiveId)
    setCancelMotif('')
    setCancelError('')
  }

  function closeCancelModal() {
    setCancelTarget(null)
    setCancelMotif('')
    setCancelError('')
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    setCancelError('')
    try {
      const res = await fetch(`/api/documents-generes/${cancelTarget}/annuler`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif: cancelMotif || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCancelError(data.error ?? 'Erreur lors de l\'annulation')
      } else {
        closeCancelModal()
        await loadDocuments()
      }
    } catch {
      setCancelError('Erreur réseau — réessayez')
    } finally {
      setCancelling(false)
    }
  }

  if (!loaded) return null

  return (
    <>
      <div style={{ ...cardBase, ...s.section }}>
        <div style={s.sectionHead}>
          <h3 style={s.sectionTitle}>Documents KYC</h3>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              ...buttonGold,
              fontSize: fontSizes.xs,
              padding: '6px 14px',
              opacity: generating ? 0.6 : 1,
              cursor: generating ? 'not-allowed' : 'pointer',
            } as React.CSSProperties}
          >
            {generating ? 'Génération…' : 'Générer un PDF KYC'}
          </button>
        </div>

        {generateError && (
          <p style={s.error}>{generateError}</p>
        )}

        {documents.length === 0 ? (
          <p style={s.empty}>Aucun document généré pour ce client.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
            {documents.map(doc => (
              <div key={doc.id} style={s.row}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                    <p style={s.label}>KYC n°{doc.numero_sequence}</p>
                    {doc.statut === 'annule' && (
                      <span style={s.badgeAnnule}>Annulé</span>
                    )}
                  </div>
                  <p style={s.date}>Généré le {formatDate(doc.genere_le)}</p>
                  {doc.statut === 'annule' && doc.annule_le && (
                    <p style={s.dateAnnule}>
                      Annulé le {formatDate(doc.annule_le)}
                      {doc.motif_annulation ? ` — ${doc.motif_annulation}` : ''}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: spacing[2], alignItems: 'center' }}>
                  <button onClick={() => handleDownload(doc.id)} style={s.downloadButton}>
                    Télécharger
                  </button>
                  {doc.statut === 'actif' && (
                    <button onClick={() => openCancelModal(doc.id)} style={s.annulerButton}>
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal d'annulation */}
      {cancelTarget && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) closeCancelModal() }}>
          <div style={s.modal}>
            <p style={s.modalTitle}>Annuler ce document KYC ?</p>
            <p style={s.modalDesc}>
              Le document sera conservé pour la traçabilité réglementaire mais ne sera plus
              visible par le client. Cette action est irréversible.
            </p>
            <div style={{ marginBottom: spacing[4] }}>
              <label style={{ ...labelBase, display: 'block', marginBottom: spacing[1] }}>
                Motif (optionnel)
              </label>
              <input
                type="text"
                value={cancelMotif}
                onChange={e => setCancelMotif(e.target.value)}
                placeholder="Ex : erreur de rendu PDF"
                style={{ ...inputBase, width: '100%' }}
                onFocus={e => Object.assign(e.target.style, { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' })}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
            {cancelError && (
              <p style={{ ...s.error, marginBottom: spacing[3] }}>{cancelError}</p>
            )}
            <div style={s.modalActions}>
              <button onClick={closeCancelModal} style={{ ...buttonGhost, fontSize: fontSizes.sm }}>
                Retour
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                style={{
                  ...s.confirmAnnulerButton,
                  opacity: cancelling ? 0.6 : 1,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                } as React.CSSProperties}
              >
                {cancelling ? 'Annulation…' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const s = {
  section: { boxShadow: shadows.sm, padding: spacing[4] } as React.CSSProperties,
  sectionHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep,
  },
  row: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: spacing[3], padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}`,
  },
  label:  { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.text },
  date:   { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px' },
  dateAnnule: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: '2px', fontStyle: 'italic' } as React.CSSProperties,
  badgeAnnule: {
    fontFamily: fonts.body, fontSize: '0.65rem', fontWeight: fontWeights.bold,
    color: '#fff', backgroundColor: colors.danger,
    borderRadius: 3, padding: '1px 6px', textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  downloadButton: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
    color: colors.blue, background: 'none', border: `1px solid ${colors.blue}`,
    borderRadius: 2, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  annulerButton: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
    color: colors.danger, background: 'none', border: `1px solid ${colors.danger}`,
    borderRadius: 2, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger },
  // Modal
  overlay: {
    position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 6, padding: spacing[6],
    maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  modalTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep, marginBottom: spacing[2],
  },
  modalDesc: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid,
    marginBottom: spacing[4], lineHeight: 1.5,
  },
  modalActions: {
    display: 'flex', gap: spacing[3], justifyContent: 'flex-end', marginTop: spacing[2],
  },
  confirmAnnulerButton: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
    color: '#fff', backgroundColor: colors.danger, border: 'none',
    borderRadius: 3, padding: '8px 18px',
  },
}
