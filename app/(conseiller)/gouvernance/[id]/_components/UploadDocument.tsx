'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows, radii,
  cardBase, inputBase,
} from '@/lib/design-tokens'

type Etape = 'idle' | 'uploading' | 'extracting' | 'done' | 'erreur'

interface Resultat {
  document_id: string
  extrait_id?: string
  nb_pages?: number
  deduplique?: boolean
  extraction_warning?: string
}

const TYPES = ['DICI', 'Brochure', 'Rapport', 'Autre'] as const
const MAX_SIZE_MB = 20

async function safeJson<T>(res: Response, label: string): Promise<T> {
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    const text = await res.text()
    console.error(`[UploadDocument] Réponse non-JSON (${res.status}) depuis ${label}:`, text.slice(0, 800))
    throw new Error(`Erreur serveur ${res.status} — consulter les logs du terminal Next.js`)
  }
  return res.json() as Promise<T>
}

export default function UploadDocument({ produitId }: { produitId: string }) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [etape,        setEtape]        = useState<Etape>('idle')
  const [type,         setType]         = useState<string>('DICI')
  const [dateDoc,      setDateDoc]      = useState<string>('')
  const [erreur,       setErreur]       = useState<string | null>(null)
  const [resultat,     setResultat]     = useState<Resultat | null>(null)
  const [showForm,     setShowForm]     = useState(false)

  const reset = () => {
    setEtape('idle')
    setErreur(null)
    setResultat(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setErreur(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo)`)
      return
    }

    setEtape('uploading')
    setErreur(null)
    setResultat(null)

    try {
      // ── Étape 1 : upload ─────────────────────────────────────────────────
      const fd = new FormData()
      fd.append('file', file)
      fd.append('produit_id', produitId)
      fd.append('type', type)
      if (dateDoc) fd.append('date_document', dateDoc)

      const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      const uploadData = await safeJson<{ document_id: string; storage_path: string; error?: string }>(uploadRes, '/api/documents/upload')
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Erreur upload')

      const { document_id } = uploadData as { document_id: string }

      // ── Étape 2 : extraction texte ────────────────────────────────────────
      setEtape('extracting')
      const extractRes = await fetch('/api/documents/extract', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ document_id }),
      })
      const extractData = await safeJson<{ extrait_id?: string; nb_pages?: number; deduplique?: boolean; error?: string }>(extractRes, '/api/documents/extract')

      if (!extractRes.ok) {
        // Upload OK, extraction échouée — document enregistré
        setResultat({ document_id, extraction_warning: extractData.error ?? 'Erreur extraction inconnue' })
        setEtape('done')
        router.refresh()
        return
      }

      setResultat({
        document_id,
        extrait_id:  extractData.extrait_id,
        nb_pages:    extractData.nb_pages,
        deduplique:  extractData.deduplique,
      })
      setEtape('done')
      router.refresh()

    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue')
      setEtape('erreur')
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        style={s.addBtn}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Ajouter un document
      </button>
    )
  }

  return (
    <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm, marginBottom: spacing[5], borderTop: `3px solid ${colors.info}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[5] }}>
        <p style={s.sectionLabel}>Ajouter un document</p>
        <button
          onClick={() => { setShowForm(false); reset() }}
          style={s.closeBtn}
          aria-label="Fermer"
        >✕</button>
      </div>

      {etape === 'done' && resultat ? (
        <div>
          {resultat.extraction_warning ? (
            <div style={{ backgroundColor: colors.warningBg, border: `1px solid ${colors.warningBorder}`, padding: spacing[4], marginBottom: spacing[4] }}>
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.warning }}>
                Document enregistré — extraction incomplète
              </p>
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.warning, marginTop: spacing[1] }}>
                {resultat.extraction_warning}
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: colors.successBg, border: `1px solid ${colors.successBorder}`, padding: spacing[4], marginBottom: spacing[4] }}>
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.success }}>
                ✓ Document ajouté et texte extrait
                {resultat.nb_pages ? ` (${resultat.nb_pages} page${resultat.nb_pages > 1 ? 's' : ''})` : ''}
              </p>
              {resultat.deduplique && (
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.success, marginTop: spacing[1] }}>
                  Texte identique à une extraction précédente — version réutilisée.
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => { reset(); setShowForm(true) }}
            style={s.secondaryBtn}
          >
            Ajouter un autre document
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>

          {/* Type + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[4] }}>
            <div>
              <label style={s.fieldLabel}>Type de document *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                disabled={etape !== 'idle'}
                style={{ ...inputBase, width: '100%' } as React.CSSProperties}
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={s.fieldLabel}>Date du document</label>
              <input
                type="date"
                value={dateDoc}
                onChange={e => setDateDoc(e.target.value)}
                disabled={etape !== 'idle'}
                style={{ ...inputBase, width: '100%' } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Fichier */}
          <div>
            <label style={s.fieldLabel}>Fichier PDF * <span style={{ fontWeight: fontWeights.regular, color: colors.textLight }}>(max {MAX_SIZE_MB} Mo)</span></label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              required
              disabled={etape !== 'idle'}
              style={{
                fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text,
                width: '100%', padding: spacing[3],
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.white,
                cursor: etape !== 'idle' ? 'not-allowed' : 'pointer',
              } as React.CSSProperties}
            />
          </div>

          {/* Erreur */}
          {erreur && (
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger }}>
              {erreur}
            </p>
          )}

          {/* Indicateur de progression */}
          {(etape === 'uploading' || etape === 'extracting') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
              <div style={s.spinner} />
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>
                {etape === 'uploading'   ? 'Upload en cours…' : 'Extraction du texte PDF…'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: spacing[3], justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setShowForm(false); reset() }}
              disabled={etape !== 'idle'}
              style={s.secondaryBtn}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={etape !== 'idle'}
              style={{
                fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
                letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                backgroundColor: etape !== 'idle' ? colors.textLight : colors.blueDeep,
                color: colors.white, border: 'none',
                padding: `${spacing[3]} ${spacing[6]}`,
                cursor: etape !== 'idle' ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const s = {
  sectionLabel: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
    letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: colors.textMid,
  } as React.CSSProperties,
  fieldLabel: {
    display: 'block', fontFamily: fonts.body, fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium, color: colors.textMid,
    marginBottom: spacing[2], letterSpacing: '0.04em',
  } as React.CSSProperties,
  addBtn: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    backgroundColor: 'transparent', color: colors.blue,
    border: `1px solid ${colors.blue}`,
    padding: `${spacing[3]} ${spacing[5]}`,
    cursor: 'pointer', marginBottom: spacing[5],
    display: 'flex', alignItems: 'center', gap: spacing[2],
  } as React.CSSProperties,
  secondaryBtn: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
    backgroundColor: 'transparent', color: colors.textMid,
    border: `1px solid ${colors.border}`,
    padding: `${spacing[3]} ${spacing[5]}`,
    cursor: 'pointer',
  } as React.CSSProperties,
  closeBtn: {
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textLight,
    background: 'none', border: 'none', cursor: 'pointer', padding: spacing[1],
    lineHeight: 1,
  } as React.CSSProperties,
  spinner: {
    width: '16px', height: '16px',
    border: `2px solid ${colors.border}`,
    borderTopColor: colors.blue,
    borderRadius: radii.full,
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,
}
