'use client'

import { useClient } from '@/lib/ClientContext'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, statusBadge, transitions,
  buttonGold, buttonOutline,
} from '@/lib/design-tokens'
import DocumentsKycSection from './_components/DocumentsKycSection'
import AffairesEnCoursBloc from '@/app/(conseiller)/affaires/_components/AffairesEnCoursBloc'

function formatEuros(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

export default function ClientSynthesePage() {
  const { data } = useClient()
  const { client, famille, enfants, objectifs, actifsFinanciers, biensImmobiliers, passifs, budgetPostes, fiscalite, dossiers } = data
  const base = `/clients/${client.id}`

  // Calculs patrimoniaux
  const totalActifsFinanciers = actifsFinanciers.reduce((acc, a) => acc + (a.montant ?? 0), 0)
  const totalImmobilier = biensImmobiliers.reduce((acc, b) => acc + (b.valeur ?? 0), 0)
  const totalPassifs = passifs.reduce((acc, p) => acc + (p.montant ?? 0), 0)
  const patrimoineNet = totalActifsFinanciers + totalImmobilier - totalPassifs
  const revenusAnnuels = budgetPostes.filter(p => p.type === 'revenu').reduce((acc, p) => acc + (p.montant_annuel ?? 0), 0)
  const chargesAnnuelles = budgetPostes.filter(p => p.type === 'charge').reduce((acc, p) => acc + (p.montant_annuel ?? 0), 0)

  const dossiersEnCours = dossiers.filter(d => d.statut === 'en_cours')

  return (
    <div style={s.grid}>
      {/* Colonne principale */}
      <div style={s.mainCol}>

        {/* Synthèse patrimoniale */}
        <Section title="Synthèse patrimoniale" href={`${base}/patrimoine`}>
          <div style={s.patrimoineRow}>
            <PatrimoineKpi label="Actifs financiers" value={formatEuros(totalActifsFinanciers)} color={colors.success} />
            <PatrimoineKpi label="Patrimoine immobilier" value={formatEuros(totalImmobilier)} color={colors.blue} />
            <PatrimoineKpi label="Passifs" value={formatEuros(totalPassifs)} color={colors.danger} />
            <PatrimoineKpi label="Patrimoine net" value={formatEuros(patrimoineNet)} color={colors.gold} bold />
          </div>
        </Section>

        {/* Profil & objectifs */}
        <Section title="Objectifs patrimoniaux" href={`${base}/objectifs`}>
          {objectifs.length === 0 ? (
            <Empty label="Aucun objectif renseigné" />
          ) : (
            <div style={s.objectifsList}>
              {objectifs.map((o, i) => (
                <div key={o.id} style={s.objectifItem}>
                  <div style={s.objectifNum}>{i + 1}</div>
                  <div>
                    <p style={s.objectifLabel}>{o.libelle}</p>
                    <p style={s.objectifMeta}>
                      {o.horizon && <span>{HORIZON_LABELS[o.horizon]}</span>}
                      {o.horizon && o.profil_risque && ' · '}
                      {o.profil_risque && <span>Profil {o.profil_risque}</span>}
                    </p>
                  </div>
                  {o.montant_cible && (
                    <span style={s.objectifMontant}>{formatEuros(o.montant_cible)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Budget */}
        <Section title="Budget annuel" href={`${base}/patrimoine`}>
          <div style={s.budgetRow}>
            <div style={s.budgetCard}>
              <p style={s.budgetLabel}>Revenus</p>
              <p style={{ ...s.budgetValue, color: colors.success }}>{formatEuros(revenusAnnuels)}</p>
            </div>
            <div style={s.budgetCard}>
              <p style={s.budgetLabel}>Charges</p>
              <p style={{ ...s.budgetValue, color: colors.danger }}>{formatEuros(chargesAnnuelles)}</p>
            </div>
            <div style={s.budgetCard}>
              <p style={s.budgetLabel}>Capacité d'épargne</p>
              <p style={{ ...s.budgetValue, color: colors.gold }}>{formatEuros(revenusAnnuels - chargesAnnuelles)}</p>
            </div>
          </div>
        </Section>

      </div>

      {/* Colonne latérale */}
      <div style={s.sideCol}>

        {/* Informations personnelles */}
        <Section title="Informations" href={`${base}/famille`} compact>
          <InfoRow label="Situation" value={famille?.situation ? SITUATION_LABELS[famille.situation] ?? famille.situation : '—'} />
          <InfoRow label="Profession" value={famille?.profession ?? '—'} />
          <InfoRow label="Date de naissance" value={formatDate(famille?.date_naissance ?? null)} />
          <InfoRow label="Nationalité" value={famille?.nationalite ?? '—'} />
          {enfants.length > 0 && (
            <InfoRow label="Enfants" value={`${enfants.length} enfant${enfants.length > 1 ? 's' : ''}`} />
          )}
        </Section>

        {/* Fiscalité */}
        <Section title="Fiscalité" href={`${base}/fiscalite`} compact>
          <InfoRow label="Tranche IR" value={fiscalite?.tranche_ir ? `${fiscalite.tranche_ir} %` : '—'} />
          <InfoRow label="Revenu fiscal" value={formatEuros(fiscalite?.revenu_fiscal ?? null)} />
          <InfoRow label="IFI" value={formatEuros(fiscalite?.ifi ?? null)} />
          {fiscalite?.dispositifs && fiscalite.dispositifs.length > 0 && (
            <InfoRow label="Dispositifs" value={(fiscalite.dispositifs as string[]).join(', ')} />
          )}
        </Section>

        {/* Documents KYC archivés */}
        <DocumentsKycSection clientId={client.id} />

        {/* Affaires en cours */}
        <Section title="Affaires en cours" href={`${base}/affaires`} compact>
          <AffairesEnCoursBloc clientId={client.id} />
        </Section>

        {/* Dossiers en cours */}
        <Section title="Dossiers en cours" href="#" compact>
          {dossiersEnCours.length === 0 ? (
            <Empty label="Aucun dossier actif" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
              {dossiersEnCours.slice(0, 4).map(d => (
                <div key={d.id} style={s.dossierItem}>
                  <div>
                    <p style={s.dossierTitre}>{d.titre}</p>
                    <div style={s.progressBar}>
                      <div style={{ ...s.progressFill, width: `${d.progression}%` }} />
                    </div>
                  </div>
                  <span style={s.dossierPct}>{d.progression} %</span>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function Section({ title, href, children, compact }: { title: string; href: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{ ...cardBase, ...s.section, padding: compact ? spacing[4] : spacing[5] }}>
      <div style={s.sectionHead}>
        <h3 style={s.sectionTitle}>{title}</h3>
        <Link href={href} style={s.sectionLink}>Modifier →</Link>
      </div>
      {children}
    </div>
  )
}

function PatrimoineKpi({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={s.pkpi}>
      <div style={{ ...s.pkpiBar, backgroundColor: color }} />
      <p style={s.pkpiLabel}>{label}</p>
      <p style={{ ...s.pkpiValue, color: bold ? color : colors.blueDeep, fontWeight: bold ? fontWeights.medium : fontWeights.light }}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.infoRow}>
      <span style={s.infoLabel}>{label}</span>
      <span style={s.infoValue}>{value}</span>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <p style={s.empty}>{label}</p>
}

const HORIZON_LABELS: Record<string, string> = {
  court_terme: 'Court terme',
  moyen_terme: 'Moyen terme',
  long_terme: 'Long terme',
  retraite: 'Retraite',
}

const SITUATION_LABELS: Record<string, string> = {
  celibataire: 'Célibataire',
  marie: 'Marié(e)',
  pacse: 'Pacsé(e)',
  concubinage: 'Concubinage',
  divorce: 'Divorcé(e)',
  veuf: 'Veuf/Veuve',
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gap: spacing[5],
    alignItems: 'start',
  },
  mainCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[5],
  },
  sideCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[5],
  },
  section: {
    boxShadow: shadows.sm,
  } as React.CSSProperties,
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.blueDeep,
    letterSpacing: letterSpacings.wide,
  },
  sectionLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.blue,
    textDecoration: 'none',
    letterSpacing: letterSpacings.wide,
  },
  patrimoineRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: spacing[4],
  },
  pkpi: {
    position: 'relative' as const,
    paddingTop: spacing[3],
    borderTop: `2px solid ${colors.border}`,
  },
  pkpiBar: {
    position: 'absolute' as const,
    top: '-2px',
    left: 0,
    width: '32px',
    height: '2px',
  },
  pkpiLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    marginBottom: spacing[1],
  },
  pkpiValue: {
    fontFamily: fonts.heading,
    fontSize: '1.3rem',
    lineHeight: 1,
  },
  objectifsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[3],
  },
  objectifItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[3]} 0`,
    borderBottom: `1px solid ${colors.border}`,
  },
  objectifNum: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: colors.bluePale,
    color: colors.blue,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  objectifLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  objectifMeta: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMid,
    marginTop: '2px',
  },
  objectifMontant: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.gold,
    fontWeight: fontWeights.medium,
    marginLeft: 'auto',
    whiteSpace: 'nowrap' as const,
  },
  budgetRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: spacing[4],
  },
  budgetCard: {
    padding: `${spacing[3]} ${spacing[4]}`,
    backgroundColor: colors.offWhite,
    border: `1px solid ${colors.border}`,
  },
  budgetLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    marginBottom: spacing[1],
  },
  budgetValue: {
    fontFamily: fonts.heading,
    fontSize: '1.3rem',
    fontWeight: fontWeights.light,
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing[3],
    padding: `${spacing[2]} 0`,
    borderBottom: `1px solid ${colors.border}`,
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    flexShrink: 0,
  } as React.CSSProperties,
  infoValue: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: 'right' as const,
  } as React.CSSProperties,
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    fontStyle: 'italic',
    padding: `${spacing[2]} 0`,
  },
  dossierItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
  },
  dossierTitre: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.text,
    marginBottom: spacing[1],
  },
  progressBar: {
    height: '4px',
    backgroundColor: colors.bluePale,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    transition: transitions.card,
  },
  dossierPct: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMid,
    flexShrink: 0,
    width: '36px',
    textAlign: 'right' as const,
  } as React.CSSProperties,
}
