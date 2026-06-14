'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  colors, fonts, fontSizes, fontWeights, spacing, inputBase,
} from '@/lib/design-tokens'

export default function ProduitsFiltres() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const archives     = searchParams.get('archives') === 'true'

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/produits?${params.toString()}`)
  }

  const v = {
    conformite: searchParams.get('statut_conformite') ?? '',
    validation: searchParams.get('statut_validation') ?? '',
    cat_reg:    searchParams.get('categorie_reglementaire') ?? '',
    alerte:     searchParams.get('alerte') ?? '',
  }

  const hasFilters = !archives && Object.values(v).some(Boolean)

  return (
    <div style={s.wrap}>
      {/* Barre d'actions : Nouveau produit | Produits archivés | Gouvernance des produits */}
      <div style={s.actionBar}>
        <Link href="/produits/nouveau" style={s.btnPrimary}>
          + Nouveau produit
        </Link>

        {archives ? (
          <button style={s.btnSecondary} onClick={() => router.push('/produits')}>
            ← Retour au catalogue actif
          </button>
        ) : (
          <button style={s.btnSecondary} onClick={() => router.push('/produits?archives=true')}>
            Produits archivés
          </button>
        )}

        <a href="/api/gouvernance-produits/pdf" download style={s.btnGold}>
          Gouvernance des produits ↓
        </a>
      </div>

      {/* Filtres (catalogue actif uniquement) */}
      {!archives && (
        <div style={s.filterBar}>
          <select
            style={s.select}
            value={v.conformite}
            onChange={e => update('statut_conformite', e.target.value)}
          >
            <option value="">Conformité — tous</option>
            <option value="conforme">Conforme</option>
            <option value="en_revision">En révision</option>
            <option value="suspendu">Suspendu</option>
            <option value="non_conforme">Non conforme</option>
          </select>

          <select
            style={s.select}
            value={v.validation}
            onChange={e => update('statut_validation', e.target.value)}
          >
            <option value="">Validation — tous</option>
            <option value="a_valider">À valider</option>
            <option value="valide">Validé</option>
            <option value="a_revoir">À revoir</option>
          </select>

          <select
            style={s.select}
            value={v.cat_reg}
            onChange={e => update('categorie_reglementaire', e.target.value)}
          >
            <option value="">Catégorie réglementaire — toutes</option>
            <option value="OPCVM">OPCVM</option>
            <option value="FIA">FIA</option>
            <option value="assurance_vie">Assurance-vie</option>
            <option value="capitalisation">Capitalisation</option>
            <option value="per_individuel">PER Individuel</option>
            <option value="per_collectif">PER Collectif</option>
            <option value="scpi">SCPI</option>
            <option value="opci">OPCI</option>
            <option value="produit_structure">Produit structuré</option>
            <option value="autre">Autre</option>
          </select>

          <select
            style={s.select}
            value={v.alerte}
            onChange={e => update('alerte', e.target.value)}
          >
            <option value="">Alertes — toutes</option>
            <option value="true">Avec alerte de revue</option>
          </select>

          {hasFilters && (
            <button style={s.btnReset} onClick={() => router.push('/produits')}>
              Réinitialiser
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    flexWrap: 'wrap' as const,
  },
  btnPrimary: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    backgroundColor: colors.blue,
    color: colors.white,
    padding: `${spacing[2]} ${spacing[5]}`,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  } as React.CSSProperties,
  btnSecondary: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textMid,
    background: 'none',
    border: `1px solid ${colors.border}`,
    padding: `${spacing[2]} ${spacing[4]}`,
    cursor: 'pointer',
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  btnGold: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.gold,
    border: `1px solid ${colors.gold}`,
    padding: `${spacing[2]} ${spacing[4]}`,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  btnReset: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textMid,
    background: 'none',
    border: `1px solid ${colors.border}`,
    padding: `${spacing[2]} ${spacing[4]}`,
    cursor: 'pointer',
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  select: {
    ...inputBase,
    width: 'auto',
    minWidth: '200px',
    cursor: 'pointer',
    fontSize: fontSizes.sm,
    padding: `${spacing[2]} ${spacing[3]}`,
  } as React.CSSProperties,
}
