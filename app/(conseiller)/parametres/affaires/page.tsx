import ParametrageAffairesClient from '@/app/(conseiller)/affaires/_components/ParametrageAffairesClient'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

export default function ParametresAffairesPage() {
  return (
    <div>
      <div style={{ marginBottom: spacing[6] }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 'clamp(1.6rem, 2.2vw, 2.2rem)', fontWeight: fontWeights.light, color: colors.blueDeep }}>
          Paramétrage — Affaires
        </h1>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>
          Familles, types, partenaires, motifs d’archivage et frises réglementaires versionnées.
        </p>
      </div>
      <ParametrageAffairesClient />
    </div>
  )
}
