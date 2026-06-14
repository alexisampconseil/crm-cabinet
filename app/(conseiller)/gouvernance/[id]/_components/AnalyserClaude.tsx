'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  colors, fonts, fontSizes, fontWeights, spacing, radii,
  statusBadge,
} from '@/lib/design-tokens'

type Etat      = 'idle' | 'en_cours' | 'done' | 'erreur'
type ErrorCode = 'OVERLOAD' | 'TIMEOUT' | 'API_ERROR'

interface ResultatAnalyse {
  score_confiance:   number
  modele:            string
  date_analyse:      string
  statut_validation: string
}

const ERROR_MESSAGES: Record<ErrorCode, { titre: string; conseil: string }> = {
  OVERLOAD:  {
    titre:  'Serveur Claude surchargé',
    conseil: 'La capacité maximale est atteinte. Attendez quelques secondes puis réessayez.',
  },
  TIMEOUT:   {
    titre:  'Délai d\'attente dépassé',
    conseil: 'La réponse a pris trop de temps. Réessayez — le document sera ré-analysé.',
  },
  API_ERROR: {
    titre:  'Erreur API Claude',
    conseil: 'Une erreur inattendue s\'est produite. Consultez les logs si le problème persiste.',
  },
}

export default function AnalyserClaude({
  extraitId,
  produitId,
}: {
  extraitId: string
  produitId: string
}) {
  const router = useRouter()
  const [etat,       setEtat]      = useState<Etat>('idle')
  const [erreur,     setErreur]    = useState<string | null>(null)
  const [errorCode,  setErrorCode] = useState<ErrorCode | null>(null)
  const [resultat,   setResultat]  = useState<ResultatAnalyse | null>(null)

  const handleAnalyse = async () => {
    setEtat('en_cours')
    setErreur(null)
    setErrorCode(null)

    try {
      const res  = await fetch('/api/documents/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ extrait_id: extraitId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErreur(data.error ?? 'Erreur inconnue')
        setErrorCode((data.error_code as ErrorCode) ?? 'API_ERROR')
        setEtat('erreur')
        router.refresh()
        return
      }

      setResultat(data as ResultatAnalyse)
      setEtat('done')
      router.refresh()

    } catch (e) {
      // Erreur réseau (pas de réponse du serveur)
      setErreur(e instanceof Error ? e.message : 'Erreur réseau')
      setErrorCode('TIMEOUT')
      setEtat('erreur')
    }
  }

  // ── Résultat succès ─────────────────────────────────────────────────────────

  if (etat === 'done' && resultat) {
    const score   = Math.round(resultat.score_confiance * 100)
    const dateStr = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(resultat.date_analyse))

    return (
      <div style={{
        marginTop: spacing[2],
        padding: `${spacing[3]} ${spacing[4]}`,
        backgroundColor: colors.successBg,
        border: `1px solid ${colors.successBorder}`,
        display: 'flex', flexWrap: 'wrap' as const,
        alignItems: 'center', gap: spacing[3],
      }}>
        <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.success, fontWeight: fontWeights.semibold }}>
          ✓ Analyse terminée
        </span>
        <span style={{ ...statusBadge.success }}>
          Confiance {score} %
        </span>
        <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>
          {resultat.modele} · {dateStr}
        </span>
        <span style={{ ...statusBadge.info }}>
          À valider
        </span>
        <a
          href={`/gouvernance/${produitId}?tab=marche-cible`}
          style={{
            fontFamily: fonts.body, fontSize: fontSizes.xs,
            color: colors.blue, fontWeight: fontWeights.medium,
            textDecoration: 'none', marginLeft: 'auto',
          }}
        >
          Voir le marché cible →
        </a>
      </div>
    )
  }

  // ── Erreur avec retry ───────────────────────────────────────────────────────

  if (etat === 'erreur') {
    const code    = errorCode ?? 'API_ERROR'
    const meta    = ERROR_MESSAGES[code]
    const isRetry = code === 'OVERLOAD' || code === 'TIMEOUT'

    return (
      <div style={{
        marginTop: spacing[2],
        padding: `${spacing[3]} ${spacing[4]}`,
        backgroundColor: isRetry ? colors.warningBg : colors.dangerBg,
        border: `1px solid ${isRetry ? colors.warningBorder : colors.dangerBorder}`,
        display: 'flex', flexDirection: 'column' as const, gap: spacing[2],
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] }}>
          <div>
            <p style={{
              fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
              color: isRetry ? colors.warning : colors.danger, marginBottom: spacing[1],
            }}>
              {meta.titre}
            </p>
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>
              {meta.conseil}
            </p>
          </div>
          <button onClick={handleAnalyse} style={{
            ...s.retryBtn,
            color:       isRetry ? colors.warning : colors.danger,
            borderColor: isRetry ? colors.warningBorder : colors.dangerBorder,
          }}>
            ↺ Réessayer
          </button>
        </div>
        {/* Détail technique en petit pour les erreurs API non retryables */}
        {code === 'API_ERROR' && erreur && (
          <p style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: colors.textLight, wordBreak: 'break-word' as const }}>
            {erreur}
          </p>
        )}
      </div>
    )
  }

  // ── Analyse en cours ────────────────────────────────────────────────────────

  if (etat === 'en_cours') {
    return (
      <div style={{ marginTop: spacing[2], display: 'flex', alignItems: 'center', gap: spacing[3] }}>
        <div style={s.spinner} />
        <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>
          Analyse en cours… (30–60 s)
        </span>
      </div>
    )
  }

  // ── Bouton initial ──────────────────────────────────────────────────────────

  return (
    <button onClick={handleAnalyse} style={s.analyseBtn}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      Analyser avec Claude
    </button>
  )
}

const s = {
  analyseBtn: {
    marginTop: spacing[2],
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    backgroundColor: 'transparent', color: colors.gold,
    border: `1px solid ${colors.gold}`,
    padding: `${spacing[2]} ${spacing[4]}`,
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: spacing[2],
  } as React.CSSProperties,
  retryBtn: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
    backgroundColor: 'transparent',
    padding: `${spacing[2]} ${spacing[3]}`,
    cursor: 'pointer', flexShrink: 0,
    border: '1px solid',
  } as React.CSSProperties,
  spinner: {
    width: '14px', height: '14px',
    border: `2px solid ${colors.border}`,
    borderTopColor: colors.gold,
    borderRadius: radii.full,
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,
}
