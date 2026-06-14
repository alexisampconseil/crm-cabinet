import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows, cardBase, sectionLabel,
} from '@/lib/design-tokens'
import CreerDepuisDIC from './_components/CreerDepuisDIC'

export default function NouveauProduitPage() {
  return (
    <div>
      {/* Fil d'Ariane */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[6] }}>
        <Link href="/produits" style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue, textDecoration: 'none' }}>
          ← Produits
        </Link>
        <span style={{ color: colors.textLight, fontSize: fontSizes.sm }}>/</span>
        <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>Nouveau produit</span>
      </div>

      {/* En-tête */}
      <div style={{ marginBottom: spacing[8] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] }}>
          <div style={{ width: '32px', height: '2px', backgroundColor: colors.gold }} />
          <span style={{ ...sectionLabel }}>Création · Depuis un dossier documentaire</span>
        </div>
        <h1 style={{
          fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
          fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em',
          marginBottom: spacing[2],
        }}>
          Nouveau produit depuis un dossier documentaire
        </h1>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid, maxWidth: '620px' }}>
          Uploadez un ou plusieurs documents (DICI, marché cible émetteur, transparence des frais, brochure…).
          Claude analyse l&apos;ensemble du dossier et crée automatiquement la fiche produit avec sa gouvernance.
          Vérifiez l&apos;analyse puis confirmez la création.
        </p>
      </div>

      {/* Processus */}
      <div style={{ display: 'flex', gap: spacing[4], marginBottom: spacing[8], flexWrap: 'wrap' as const }}>
        {[
          { n: '1', label: 'Upload du dossier' },
          { n: '2', label: 'Qualification des docs' },
          { n: '3', label: 'Extraction texte' },
          { n: '4', label: 'Analyse Claude' },
          { n: '5', label: 'Création fiche' },
        ].map((step, i, arr) => (
          <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: colors.bluePale, border: `2px solid ${colors.blueLight}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
                color: colors.blueDeep, flexShrink: 0,
              }}>{step.n}</div>
              <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, whiteSpace: 'nowrap' as const }}>
                {step.label}
              </span>
            </div>
            {i < arr.length - 1 && (
              <div style={{ width: '20px', height: '1px', backgroundColor: colors.blueLight, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Carte principale */}
      <div style={{ ...cardBase, padding: spacing[8], boxShadow: shadows.sm, maxWidth: '900px' }}>
        <CreerDepuisDIC />
      </div>

      {/* Lien création manuelle */}
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, marginTop: spacing[6] }}>
        Vous préférez saisir manuellement ?{' '}
        <Link href="/catalogue/nouveau" style={{ color: colors.blue, textDecoration: 'none' }}>
          Créer une fiche vierge
        </Link>
      </p>
    </div>
  )
}
