'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'
import type { FrequenceRevue } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows, cardBase,
} from '@/lib/design-tokens'

interface Props {
  gouvernanceId: string
  frequenceRevue: FrequenceRevue | null
  dateDerniereRevue: string | null
  dateProchaine: string | null
}

const REVUE_MOIS: Record<FrequenceRevue, number> = {
  trimestrielle: 3,
  semestrielle:  6,
  annuelle:      12,
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export default function MarquerRevu({ gouvernanceId, frequenceRevue, dateDerniereRevue, dateProchaine }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const isEnRetard = !!dateProchaine && dateProchaine < today

  const handleMarquerRevu = async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const dateRevue = now.toISOString().split('T')[0]
      const prochaine = frequenceRevue
        ? addMonths(now, REVUE_MOIS[frequenceRevue]).toISOString().split('T')[0]
        : null

      const supabase = createBrowserSupabase()
      const { error: err } = await supabase
        .from('produits_gouvernance')
        .update({
          date_derniere_revue:  dateRevue,
          date_prochaine_revue: prochaine,
          alerte_revue:         false,
        })
        .eq('id', gouvernanceId)

      if (err) throw err
      setConfirmed(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      ...cardBase,
      padding: spacing[6],
      boxShadow: shadows.sm,
      borderLeft: `3px solid ${isEnRetard ? colors.warning : colors.info}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing[6],
      flexWrap: 'wrap' as const,
    }}>
      <div>
        <p style={{
          fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
          letterSpacing: '0.14em', textTransform: 'uppercase' as const,
          color: colors.textMid, marginBottom: spacing[2],
        }}>
          Revue périodique
        </p>

        {dateDerniereRevue ? (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>
            Dernière revue : {new Intl.DateTimeFormat('fr-FR').format(new Date(dateDerniereRevue))}
          </p>
        ) : (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>
            Aucune revue enregistrée.
          </p>
        )}

        {dateProchaine && (
          <p style={{
            fontFamily: fonts.body, fontSize: fontSizes.sm,
            color: isEnRetard ? colors.warning : colors.textMid,
            fontWeight: isEnRetard ? fontWeights.semibold : fontWeights.regular,
            marginTop: spacing[1],
          }}>
            {isEnRetard ? '⚠ Revue en retard — ' : 'Prochaine revue : '}
            {new Intl.DateTimeFormat('fr-FR').format(new Date(dateProchaine))}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: spacing[2] }}>
        {!frequenceRevue ? (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, fontStyle: 'italic' }}>
            Définir d'abord la fréquence de revue.
          </p>
        ) : (
          <button
            onClick={handleMarquerRevu}
            disabled={loading}
            style={{
              fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
              letterSpacing: '0.06em', textTransform: 'uppercase' as const,
              backgroundColor: colors.blueDeep, color: colors.white,
              border: 'none', padding: `${spacing[3]} ${spacing[5]}`,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
              display: 'flex', alignItems: 'center', gap: spacing[2],
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {loading ? 'Enregistrement…' : 'Marquer comme revu'}
          </button>
        )}

        {confirmed && (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.success }}>
            ✓ Revue enregistrée.
            {frequenceRevue && ' Prochaine date calculée automatiquement.'}
          </p>
        )}
        {error && (
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger }}>{error}</p>
        )}
      </div>
    </div>
  )
}
