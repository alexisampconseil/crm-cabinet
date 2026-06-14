import { Suspense } from 'react'
import { logAccess } from '@/lib/supabase'
import { createServiceSupabase } from '@/lib/supabase-service'
import Link from 'next/link'
import type {
  StatutConformite, StatutValidation, CategorieReglementaire,
} from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, statusBadge,
  tableHeaderCell, tableCell,
} from '@/lib/design-tokens'
import ProduitsFiltres from './_components/ProduitsFiltres'

// ─── Labels ──────────────────────────────────────────────────────────────────

const CONFORMITE_LABELS: Record<StatutConformite, string> = {
  conforme:     'Conforme',
  en_revision:  'En révision',
  suspendu:     'Suspendu',
  non_conforme: 'Non conforme',
}

const VALIDATION_LABELS: Record<StatutValidation, string> = {
  a_valider: 'À valider',
  valide:    'Validé',
  a_revoir:  'À revoir',
}

const CATEGORIE_REG_LABELS: Record<CategorieReglementaire, string> = {
  OPCVM:             'OPCVM',
  FIA:               'FIA',
  assurance_vie:     'Assurance-vie',
  capitalisation:    'Capitalisation',
  per_individuel:    'PER Individuel',
  per_collectif:     'PER Collectif',
  scpi:              'SCPI',
  opci:              'OPCI',
  produit_structure: 'Structuré',
  autre:             'Autre',
}

// ─── Helpers badge ────────────────────────────────────────────────────────────

// Retourne label + style composite en tenant compte conformité ET validation.
// "Conforme" seul est ambigu : un produit peut être conforme mais pas encore validé.
function conformiteCellInfo(g: GouvernanceLite): { label: string; style: React.CSSProperties } {
  const conf  = g.statut_conformite
  const valid = g.statut_validation

  if (conf === 'conforme') {
    if (valid === 'valide')    return { label: 'Conforme · Validé',    style: statusBadge.success }
    if (valid === 'a_valider') return { label: 'Conforme · À valider', style: statusBadge.warning }
    if (valid === 'a_revoir')  return { label: 'Conforme · À revoir',  style: statusBadge.warning }
    return { label: 'Conforme', style: statusBadge.success }
  }

  const labels: Record<StatutConformite, string> = {
    conforme:     'Conforme',
    en_revision:  'En révision',
    suspendu:     'Suspendu',
    non_conforme: 'Non conforme',
  }
  const styles: Record<StatutConformite, React.CSSProperties> = {
    conforme:     statusBadge.success,
    en_revision:  statusBadge.warning,
    suspendu:     statusBadge.neutral,
    non_conforme: statusBadge.danger,
  }
  return { label: labels[conf] ?? conf, style: styles[conf] ?? statusBadge.neutral }
}

function validationBadge(statut: StatutValidation | null | undefined) {
  const map: Record<StatutValidation, React.CSSProperties> = {
    a_valider: statusBadge.info,
    valide:    statusBadge.success,
    a_revoir:  statusBadge.warning,
  }
  return statut ? (map[statut] ?? statusBadge.neutral) : statusBadge.neutral
}

// ─── Composants ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: {
  label: string; value: number; sub: string; accent: string
}) {
  return (
    <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm, borderTop: `3px solid ${accent}` }}>
      <p style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
        letterSpacing: letterSpacings.wider, textTransform: 'uppercase', color: colors.textMid,
        marginBottom: spacing[2],
      }}>{label}</p>
      <p style={{
        fontFamily: fonts.heading, fontSize: '2.4rem', fontWeight: fontWeights.light,
        color: colors.blueDeep, lineHeight: 1,
      }}>{value}</p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: spacing[1] }}>
        {sub}
      </p>
    </div>
  )
}

function SriMini({ sri }: { sri: number | null }) {
  if (sri === null) return (
    <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, fontStyle: 'italic' }}>
      Variable
    </span>
  )
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
      {[1,2,3,4,5,6,7].map(n => (
        <div key={n} style={{
          width: '10px', height: '10px',
          backgroundColor: n <= sri
            ? (sri <= 2 ? colors.success : sri <= 4 ? colors.warning : colors.danger)
            : colors.bluePale,
        }} />
      ))}
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginLeft: '4px' }}>
        {sri}/7
      </span>
    </div>
  )
}

// ─── Types locaux ─────────────────────────────────────────────────────────────

type GouvernanceLite = {
  id: string
  statut_conformite: StatutConformite
  statut_validation: StatutValidation
  alerte_revue: boolean
  date_prochaine_revue: string | null
}

type ProduitLigneRow = {
  id: string
  nom: string
  societe_gestion: string | null
  categorie_reglementaire: CategorieReglementaire | null
  sri: number | null
  // PostgREST retourne un objet (pas un tableau) pour les relations 1-to-1 (UNIQUE FK)
  produits_gouvernance: GouvernanceLite | null
}

type ProduitLigne = Omit<ProduitLigneRow, 'produits_gouvernance'> & {
  gouvernance: GouvernanceLite | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    statut_conformite?: string
    statut_validation?: string
    categorie_reglementaire?: string
    alerte?: string
    archives?: string
  }>
}) {
  const sp       = await searchParams
  const archives = sp.archives === 'true'

  await logAccess('produits_view')
  const service = createServiceSupabase()

  const { data } = await service
    .from('produits')
    .select(`
      id, nom, societe_gestion, categorie_reglementaire, sri,
      produits_gouvernance(
        id, statut_conformite, statut_validation,
        alerte_revue, date_prochaine_revue
      )
    `)
    .eq('actif', archives ? false : true)
    .order('nom')

  const today = new Date().toISOString().split('T')[0]

  const isEnAlerte = (g: GouvernanceLite | null): boolean =>
    g?.alerte_revue === true ||
    !!(g?.date_prochaine_revue && g.date_prochaine_revue < today)

  const all: ProduitLigne[] = ((data ?? []) as unknown as ProduitLigneRow[]).map(p => ({
    id:                      p.id,
    nom:                     p.nom,
    societe_gestion:         p.societe_gestion,
    categorie_reglementaire: p.categorie_reglementaire,
    sri:                     p.sri,
    gouvernance:             p.produits_gouvernance ?? null,
  }))

  // Filtres (ignorés en mode archives)
  let filtered = all
  if (!archives) {
    if (sp.statut_conformite)       filtered = filtered.filter(p => p.gouvernance?.statut_conformite === sp.statut_conformite)
    if (sp.statut_validation)       filtered = filtered.filter(p => p.gouvernance?.statut_validation === sp.statut_validation)
    if (sp.categorie_reglementaire) filtered = filtered.filter(p => p.categorie_reglementaire === sp.categorie_reglementaire)
    if (sp.alerte === 'true')       filtered = filtered.filter(p => isEnAlerte(p.gouvernance))
  }

  const hasFilters = !archives && !!(sp.statut_conformite || sp.statut_validation || sp.categorie_reglementaire || sp.alerte)

  // KPIs (catalogue actif uniquement)
  const kpis = {
    total:            all.length,
    valides:          all.filter(p => p.gouvernance?.statut_validation === 'valide').length,
    a_valider:        all.filter(p => p.gouvernance?.statut_validation === 'a_valider').length,
    alertes:          all.filter(p => isEnAlerte(p.gouvernance)).length,
    sans_gouvernance: all.filter(p => !p.gouvernance).length,
  }

  return (
    <div>
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Catalogue · Conformité DDA / MIF2</span></div>
          <h1 style={s.title}>Produits</h1>
        </div>
      </div>

      {/* KPIs (catalogue actif uniquement) ou bannière archives */}
      {archives ? (
        <div style={{
          padding: `${spacing[4]} ${spacing[5]}`,
          backgroundColor: colors.bluePale, border: `1px solid ${colors.border}`,
          marginBottom: spacing[6],
          display: 'flex', alignItems: 'center', gap: spacing[3],
        }}>
          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blueDeep }}>
            Vous consultez les <strong>produits archivés</strong> (retirés du catalogue actif).
            Les filtres de conformité ne s&apos;appliquent pas à cette vue.
          </span>
        </div>
      ) : (
        <div style={s.kpiGrid}>
          <KpiCard
            label="Produits référencés"
            value={filtered.length}
            sub={hasFilters ? `sur ${all.length} actifs au catalogue` : 'Produits actifs au catalogue'}
            accent={colors.blueDeep}
          />
          <KpiCard label="Validés"          value={kpis.valides}          sub={`sur ${kpis.total} produits actifs`} accent={colors.success} />
          <KpiCard label="À valider"        value={kpis.a_valider}        sub="Fiches en attente de validation"     accent={colors.info} />
          <KpiCard label="Alertes de revue" value={kpis.alertes}          sub="Produits à revoir en priorité"       accent={colors.warning} />
          <KpiCard label="Sans gouvernance" value={kpis.sans_gouvernance} sub="Fiches à créer"                      accent={colors.textLight} />
        </div>
      )}

      {/* Filtres */}
      <Suspense fallback={null}>
        <ProduitsFiltres />
      </Suspense>

      {/* Tableau */}
      <div style={{ ...cardBase, boxShadow: shadows.sm, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeaderCell}>Produit</th>
              <th style={tableHeaderCell}>Catégorie réglementaire</th>
              <th style={tableHeaderCell}>SRI</th>
              <th style={tableHeaderCell}>Conformité</th>
              <th style={tableHeaderCell}>Validation</th>
              <th style={tableHeaderCell}>Prochaine revue</th>
              <th style={{ ...tableHeaderCell, textAlign: 'right' as const }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{
                  ...tableCell, textAlign: 'center', fontStyle: 'italic',
                  color: colors.textLight, padding: spacing[10],
                }}>
                  {archives
                    ? 'Aucun produit archivé.'
                    : hasFilters
                      ? 'Aucun produit ne correspond aux filtres sélectionnés.'
                      : 'Aucun produit actif référencé.'}
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id}>
                  <td style={tableCell}>
                    <p style={{
                      fontFamily: fonts.body, fontSize: fontSizes.base,
                      fontWeight: fontWeights.semibold, color: colors.blueDeep,
                    }}>{p.nom}</p>
                    {p.societe_gestion && (
                      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px' }}>
                        {p.societe_gestion}
                      </p>
                    )}
                  </td>
                  <td style={tableCell}>
                    {p.categorie_reglementaire ? (
                      <span style={statusBadge.info}>
                        {CATEGORIE_REG_LABELS[p.categorie_reglementaire]}
                      </span>
                    ) : (
                      <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>—</span>
                    )}
                  </td>
                  <td style={tableCell}>
                    <SriMini sri={p.sri} />
                  </td>
                  <td style={tableCell}>
                    {p.gouvernance ? (() => {
                      const { label, style } = conformiteCellInfo(p.gouvernance)
                      return <span style={style}>{label}</span>
                    })() : (
                      <span style={statusBadge.neutral}>Non configurée</span>
                    )}
                  </td>
                  <td style={tableCell}>
                    {p.gouvernance ? (
                      <span style={validationBadge(p.gouvernance.statut_validation)}>
                        {VALIDATION_LABELS[p.gouvernance.statut_validation]}
                      </span>
                    ) : (
                      <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>—</span>
                    )}
                  </td>
                  <td style={tableCell}>
                    {isEnAlerte(p.gouvernance) ? (
                      <span style={{ ...statusBadge.warning, whiteSpace: 'nowrap' as const }}>⚠ Alerte</span>
                    ) : p.gouvernance?.date_prochaine_revue ? (
                      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>
                        {new Intl.DateTimeFormat('fr-FR').format(new Date(p.gouvernance.date_prochaine_revue))}
                      </span>
                    ) : (
                      <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>—</span>
                    )}
                  </td>
                  <td style={{ ...tableCell, textAlign: 'right' as const }}>
                    <Link href={`/produits/${p.id}`} style={{
                      fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue,
                      fontWeight: fontWeights.medium, textDecoration: 'none',
                    }}>
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  pageHeader: {
    marginBottom: spacing[8],
  },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em',
  },
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: spacing[5],
    marginBottom: spacing[6],
  },
}
