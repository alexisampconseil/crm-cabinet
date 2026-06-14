'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  cardBase, buttonPrimary,
} from '@/lib/design-tokens'

export default function InitGouvernance({ produitId }: { produitId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInit = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createBrowserSupabase()
      const { error: err } = await supabase
        .from('produits_gouvernance')
        .insert({
          produit_id: produitId,
          statut_conformite: 'conforme',
          statut_validation: 'a_valider',
          source_marche_cible: 'manuel',
          alerte_revue: false,
        })
      if (err) throw err
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ ...cardBase, padding: spacing[10], boxShadow: shadows.sm, textAlign: 'center' }}>
      <div style={{ marginBottom: spacing[6] }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          backgroundColor: colors.bluePale, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: spacing[4],
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={colors.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <p style={{
          fontFamily: fonts.heading, fontSize: fontSizes.lg,
          fontWeight: fontWeights.light, color: colors.blueDeep,
          marginBottom: spacing[2],
        }}>
          Aucune fiche de gouvernance
        </p>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid, lineHeight: 1.6 }}>
          Ce produit n'a pas encore de fiche de gouvernance DDA.<br />
          Initialisez-la pour commencer à renseigner le marché cible et les données de conformité.
        </p>
      </div>

      {error && (
        <p style={{
          fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger,
          marginBottom: spacing[4],
        }}>
          {error}
        </p>
      )}

      <button
        style={{ ...buttonPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        onClick={handleInit}
        disabled={loading}
      >
        {loading ? 'Création…' : 'Créer la fiche de gouvernance'}
      </button>
    </div>
  )
}
