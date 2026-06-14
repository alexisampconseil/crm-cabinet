'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'
import type { StatutValidation } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows, radii,
  cardBase, inputBase,
} from '@/lib/design-tokens'

interface Props {
  gouvernanceId: string
  statut: StatutValidation
}

export default function ValidationActions({ gouvernanceId, statut }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showSignal, setShowSignal] = useState(false)
  const [motif, setMotif] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleValider = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createBrowserSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase
        .from('produits_gouvernance')
        .update({
          statut_validation: 'valide',
          motif_signalement: null,
          valide_par: user?.id ?? null,
          valide_le: new Date().toISOString(),
        })
        .eq('id', gouvernanceId)
      if (err) throw err
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la validation')
    } finally {
      setLoading(false)
    }
  }

  const handleSignaler = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createBrowserSupabase()
      const { error: err } = await supabase
        .from('produits_gouvernance')
        .update({
          statut_validation: 'a_revoir',
          motif_signalement: motif.trim() || null,
        })
        .eq('id', gouvernanceId)
      if (err) throw err
      setShowSignal(false)
      setMotif('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du signalement')
    } finally {
      setLoading(false)
    }
  }

  const canValider = statut !== 'valide'
  const canSignaler = statut !== 'a_revoir'

  return (
    <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm }}>
      <p style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.textMid,
        marginBottom: spacing[4],
      }}>
        Actions de validation
      </p>

      {error && (
        <p style={{
          fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger,
          marginBottom: spacing[3],
        }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>

        {canValider && !showSignal && (
          <button
            onClick={handleValider}
            disabled={loading}
            style={{
              fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              backgroundColor: colors.success, color: colors.white,
              border: 'none', padding: `${spacing[3]} ${spacing[4]}`, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
              display: 'flex', alignItems: 'center', gap: spacing[2],
            } as React.CSSProperties}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {loading ? 'En cours…' : 'Valider la gouvernance'}
          </button>
        )}

        {canSignaler && !showSignal && (
          <button
            onClick={() => setShowSignal(true)}
            disabled={loading}
            style={{
              fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              backgroundColor: 'transparent', color: colors.warning,
              border: `1px solid ${colors.warningBorder}`,
              padding: `${spacing[3]} ${spacing[4]}`, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: spacing[2],
            } as React.CSSProperties}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
            </svg>
            Signaler à revoir
          </button>
        )}

        {showSignal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
            <textarea
              value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Motif du signalement (optionnel)…"
              rows={3}
              style={{
                ...inputBase,
                resize: 'vertical',
                fontSize: fontSizes.sm,
              } as React.CSSProperties}
            />
            <div style={{ display: 'flex', gap: spacing[3] }}>
              <button
                onClick={handleSignaler}
                disabled={loading}
                style={{
                  fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  backgroundColor: colors.warning, color: colors.white,
                  border: 'none', padding: `${spacing[3]} ${spacing[4]}`, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1, flex: 1,
                } as React.CSSProperties}
              >
                {loading ? 'En cours…' : 'Confirmer le signalement'}
              </button>
              <button
                onClick={() => { setShowSignal(false); setMotif('') }}
                disabled={loading}
                style={{
                  fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
                  backgroundColor: 'transparent', color: colors.textMid,
                  border: `1px solid ${colors.border}`, padding: `${spacing[3]} ${spacing[4]}`,
                  cursor: 'pointer',
                } as React.CSSProperties}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {statut === 'valide' && !showSignal && (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.success }}>
            ✓ Cette gouvernance est validée.
          </p>
        )}
      </div>
    </div>
  )
}
