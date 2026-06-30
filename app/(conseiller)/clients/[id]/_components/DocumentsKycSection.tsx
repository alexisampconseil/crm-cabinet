'use client'

import { useEffect, useState } from 'react'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows, cardBase, buttonGold,
} from '@/lib/design-tokens'

interface DocumentKyc {
  id: string
  numero_sequence: number
  genere_le: string
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(d))
}

export default function DocumentsKycSection({ clientId }: { clientId: string }) {
  const [documents, setDocuments] = useState<DocumentKyc[]>([])
  const [loaded, setLoaded]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

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

  if (!loaded) return null

  return (
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
                <p style={s.label}>KYC n°{doc.numero_sequence}</p>
                <p style={s.date}>Généré le {formatDate(doc.genere_le)}</p>
              </div>
              <button onClick={() => handleDownload(doc.id)} style={s.downloadButton}>
                Télécharger
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing[3], padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}`,
  },
  label: { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.text },
  date:  { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px' },
  downloadButton: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
    color: colors.blue, background: 'none', border: `1px solid ${colors.blue}`,
    borderRadius: 2, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginBottom: spacing[3] },
}
