import type { SnapshotPrefill } from '@/lib/collecte'
import { fmtDate, fmtMontant } from '@/lib/pdf/shared/format'
import {
  translate,
  SITUATION_FAMILIALE,
  CATEGORIE_PROFESSIONNELLE,
  NATURE_FINANCIER,
  NATURE_IMMOBILIER,
  NATURE_PASSIF,
  HORIZON_OBJECTIF,
} from '@/lib/pdf/shared/labels'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

// Affichage en lecture seule de la situation actuelle du client, par groupe,
// pour le parcours de mise à jour annuelle. Le client peut valider d'un coup
// sans re-saisir ce qu'il reconnaît comme exact.
// Catégories vides non affichées (ex : aucun actif financier → section masquée).

export function SituationReadonly({
  groupe,
  snapshot,
}: {
  groupe: 0 | 1 | 2
  snapshot: SnapshotPrefill
}) {
  if (groupe === 0) return <SituationFamilialeReadonly snapshot={snapshot} />
  if (groupe === 1) return <PatrimoineReadonly snapshot={snapshot} />
  return <ObjectifsReadonly snapshot={snapshot} />
}

// ── Groupe 0 — Situation familiale et professionnelle ─────────────────────────

function SituationFamilialeReadonly({ snapshot }: { snapshot: SnapshotPrefill }) {
  const { identite, foyer, situation_professionnelle: pro } = snapshot

  return (
    <div style={s.readonly}>
      <Row label="Nom · Prénom" value={[identite.prenom, identite.nom].filter(Boolean).join(' ')} />
      <Row label="Né(e) le" value={fmtDate(identite.date_naissance)} />
      {identite.nationalite && <Row label="Nationalité" value={identite.nationalite} />}
      <Row label="Situation" value={translate(SITUATION_FAMILIALE, foyer.situation)} />
      {foyer.regime_matrimonial && <Row label="Régime matrimonial" value={foyer.regime_matrimonial} />}
      {identite.ville && <Row label="Ville" value={identite.ville} />}
      {pro.client.profession && (
        <Row
          label="Profession"
          value={[
            translate(CATEGORIE_PROFESSIONNELLE, pro.client.categorie),
            pro.client.profession,
            pro.client.employeur,
          ].filter(Boolean).join(' — ')}
        />
      )}
      {foyer.conjoint && (
        <Row
          label="Conjoint(e)"
          value={[foyer.conjoint.prenom, foyer.conjoint.nom, foyer.conjoint.profession].filter(Boolean).join(' — ')}
        />
      )}
      {foyer.enfants.length > 0 && (
        <Row
          label="Enfants"
          value={`${foyer.enfants.length} enfant${foyer.enfants.length > 1 ? 's' : ''} (${foyer.enfants.filter(e => e.a_charge).length} à charge)`}
        />
      )}
    </div>
  )
}

// ── Groupe 1 — Patrimoine ─────────────────────────────────────────────────────

function PatrimoineReadonly({ snapshot }: { snapshot: SnapshotPrefill }) {
  const fin   = snapshot.patrimoine_financier
  const immo  = snapshot.patrimoine_immobilier
  const pass  = snapshot.passifs
  const prev  = snapshot.prevoyance
  const bud   = snapshot.budget
  const fisc  = snapshot.fiscalite

  const hasContent = fin.length > 0 || immo.length > 0 || pass.length > 0 ||
    bud.revenus.length > 0 || bud.charges.length > 0 ||
    fisc.tranche_ir || prev.testament || prev.contrats.length > 0

  if (!hasContent) {
    return <p style={s.empty}>Aucune donnée patrimoniale enregistrée.</p>
  }

  return (
    <div style={s.readonly}>
      {fin.length > 0 && (
        <SubSection title="Épargne">
          {fin.map(a => (
            <Row
              key={a.id}
              label={translate(NATURE_FINANCIER, a.nature) ?? a.nature}
              value={[a.libelle, fmtMontant(a.montant)].filter(Boolean).join(' — ')}
            />
          ))}
        </SubSection>
      )}

      {immo.length > 0 && (
        <SubSection title="Immobilier">
          {immo.map(b => (
            <Row
              key={b.id}
              label={translate(NATURE_IMMOBILIER, b.nature) ?? b.nature}
              value={[b.detenu_par, fmtMontant(b.valeur)].filter(Boolean).join(' — ')}
            />
          ))}
        </SubSection>
      )}

      {pass.length > 0 && (
        <SubSection title="Crédits">
          {pass.map(p => (
            <Row
              key={p.id}
              label={translate(NATURE_PASSIF, p.nature) ?? p.nature}
              value={[p.banque, `CRD : ${fmtMontant(p.capital_restant_du ?? p.montant)}`].filter(Boolean).join(' — ')}
            />
          ))}
        </SubSection>
      )}

      {bud.revenus.length > 0 && (
        <Row
          label="Revenus annuels"
          value={fmtMontant(bud.revenus.reduce((t, r) => t + (r.montant_annuel ?? 0), 0))}
        />
      )}
      {bud.charges.length > 0 && (
        <Row
          label="Charges annuelles"
          value={fmtMontant(bud.charges.reduce((t, c) => t + (c.montant_annuel ?? 0), 0))}
        />
      )}

      {fisc.tranche_ir && (
        <Row label="Tranche IR" value={`${fisc.tranche_ir} %`} />
      )}

      {(prev.testament || prev.contrats.length > 0 || prev.droits_retraite_estimes) && (
        <SubSection title="Prévoyance">
          {prev.testament && <Row label="Testament" value="Oui" />}
          {prev.droits_retraite_estimes && (
            <Row label="Droits retraite estimés" value={`${prev.droits_retraite_estimes} €/mois`} />
          )}
          {prev.contrats.map(c => (
            <Row key={c.id} label={c.nature} value={[c.compagnie, fmtMontant(c.montant)].filter(Boolean).join(' — ')} />
          ))}
        </SubSection>
      )}
    </div>
  )
}

// ── Groupe 2 — Objectifs ──────────────────────────────────────────────────────

function ObjectifsReadonly({ snapshot }: { snapshot: SnapshotPrefill }) {
  const objectifs = [...snapshot.objectifs].sort((a, b) => a.priorite - b.priorite)

  if (objectifs.length === 0) {
    return <p style={s.empty}>Aucun objectif patrimonial enregistré.</p>
  }

  return (
    <div style={s.readonly}>
      {objectifs.map(o => (
        <Row
          key={o.id}
          label={o.libelle}
          value={[translate(HORIZON_OBJECTIF, o.horizon), fmtMontant(o.montant_cible)].filter(v => v && v !== '—').join(' — ')}
        />
      ))}
    </div>
  )
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: spacing[3] }}>
      <p style={s.subTitle}>{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value || value === '—') return null
  return (
    <div style={s.row}>
      <span style={s.label}>{label}</span>
      <span style={s.value}>{value}</span>
    </div>
  )
}

const s = {
  readonly: {
    padding: `${spacing[3]} 0`,
  },
  row: {
    display: 'flex',
    gap: spacing[4],
    paddingBottom: spacing[2],
    marginBottom: spacing[1],
    borderBottom: `1px solid ${colors.border}`,
  } as React.CSSProperties,
  label: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMid,
    minWidth: 160,
    flexShrink: 0,
  } as React.CSSProperties,
  value: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: fontWeights.medium,
  } as React.CSSProperties,
  subTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.gold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: spacing[2],
    marginTop: spacing[3],
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    fontStyle: 'italic',
    padding: `${spacing[2]} 0`,
  },
}
