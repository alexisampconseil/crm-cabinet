import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, transitions,
} from '@/lib/design-tokens'

const TABS = [
  { key: 'produit',      label: 'Produit' },
  { key: 'documents',   label: 'Documents' },
  { key: 'gouvernance', label: 'Gouvernance' },
  { key: 'historique',  label: 'Historique' },
]

interface Props {
  activeTab: string
  produitId: string
}

export default function ProduitTabs({ activeTab, produitId }: Props) {
  return (
    <nav style={s.nav}>
      <div style={s.tabBar}>
        {TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <Link
              key={tab.key}
              href={`/produits/${produitId}?tab=${tab.key}`}
              style={{ ...s.tab, ...(active ? s.tabActive : {}) }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

const s = {
  nav: {
    borderBottom: `2px solid ${colors.border}`,
    marginBottom: spacing[6],
  },
  tabBar: {
    display: 'flex',
    gap: '0',
  },
  tab: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    letterSpacing: '0.04em',
    color: colors.textMid,
    textDecoration: 'none',
    padding: `${spacing[3]} ${spacing[5]}`,
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    transition: transitions.fast,
    display: 'inline-block',
  } as React.CSSProperties,
  tabActive: {
    color: colors.blueDeep,
    fontWeight: fontWeights.semibold,
    borderBottom: `2px solid ${colors.gold}`,
  } as React.CSSProperties,
}
