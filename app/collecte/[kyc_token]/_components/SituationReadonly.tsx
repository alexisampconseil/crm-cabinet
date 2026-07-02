import type {
  SnapshotPrefill,
  SnapshotPrefillEnfant,
  SnapshotPrefillActif,
  SnapshotPrefillImmobilier,
  SnapshotPrefillPassif,
  SnapshotPrefillBudgetPoste,
  SnapshotPrefillContratPrevoyance,
  SnapshotPrefillObjectif,
} from '@/lib/collecte'
import { fmtDate, fmtMontant, fmtBool, fmtPct } from '@/lib/pdf/shared/format'
import {
  translate,
  detailString,
  SITUATION_FAMILIALE,
  REGIME_MATRIMONIAL,
  REGIME_PACS,
  CATEGORIE_PROFESSIONNELLE,
  FILIATION,
  NATURE_FINANCIER,
  NATURE_IMMOBILIER,
  DETENU_PAR,
  MODE_DETENTION,
  NATURE_PASSIF,
  NATURE_REVENU,
  NATURE_PREVOYANCE,
  HORIZON_OBJECTIF,
} from '@/lib/pdf/shared/labels'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

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
  const conjoint = foyer.conjoint

  return (
    <div style={s.readonly}>

      <SubSection title="Vous">
        <Row label="Nom · Prénom"  value={[identite.prenom, identite.nom].filter(Boolean).join(' ')} />
        <Row label="Né(e) le"      value={fmtDate(identite.date_naissance)} />
        <Row label="À"             value={identite.lieu_naissance} />
        <Row label="Nationalité"   value={identite.nationalite} />
        <Row label="Profession"    value={pro.client.profession} />
        <Row label="Catégorie"     value={translate(CATEGORIE_PROFESSIONNELLE, pro.client.categorie)} />
        <Row label="Employeur"     value={pro.client.employeur} />
      </SubSection>

      {(identite.adresse || identite.code_postal || identite.ville || identite.telephone || identite.email) && (
        <SubSection title="Coordonnées">
          <Row label="Adresse"             value={identite.adresse} />
          <Row label="Code postal · Ville" value={[identite.code_postal, identite.ville].filter(Boolean).join(' ') || null} />
          <Row label="Téléphone"           value={identite.telephone} />
          <Row label="Email"               value={identite.email} />
        </SubSection>
      )}

      <SubSection title="Situation familiale">
        <Row label="Situation"                  value={translate(SITUATION_FAMILIALE, foyer.situation)} />
        <Row label="Régime matrimonial"         value={translate(REGIME_MATRIMONIAL, foyer.regime_matrimonial)} />
        <Row label="Date de mariage"            value={fmtDate(foyer.date_mariage)} />
        <Row label="Contrat de mariage"         value={foyer.contrat_mariage !== null ? fmtBool(foyer.contrat_mariage) : null} />
        <Row label="Régime PACS"                value={translate(REGIME_PACS, foyer.regime_pacs)} />
        <Row label="Date de PACS"               value={fmtDate(foyer.date_pacs)} />
        <Row label="Donation au dernier vivant" value={foyer.donation_dernier_vivant !== null ? fmtBool(foyer.donation_dernier_vivant) : null} />
      </SubSection>

      {conjoint && (
        <SubSection title="Conjoint(e)">
          <Row label="Nom · Prénom" value={[conjoint.prenom, conjoint.nom].filter(Boolean).join(' ')} />
          <Row label="Né(e) le"     value={fmtDate(conjoint.date_naissance)} />
          <Row label="À"            value={conjoint.lieu_naissance} />
          <Row label="Nationalité"  value={conjoint.nationalite} />
          <Row label="Profession"   value={pro.conjoint?.profession ?? conjoint.profession} />
          <Row label="Catégorie"    value={translate(CATEGORIE_PROFESSIONNELLE, pro.conjoint?.categorie ?? conjoint.categorie_professionnelle)} />
          <Row label="Employeur"    value={pro.conjoint?.employeur ?? conjoint.employeur} />
          <Row label="Email"        value={conjoint.email} />
          <Row label="Téléphone"    value={conjoint.telephone} />
        </SubSection>
      )}

      {foyer.enfants.length > 0 && (
        <SubSection title={`Enfants (${foyer.enfants.length})`}>
          <Table<SnapshotPrefillEnfant>
            columns={[
              { header: 'Prénom · Nom', width: '32%', render: e => [e.prenom, e.nom].filter(Boolean).join(' ') },
              { header: 'Naissance',    width: '20%', render: e => fmtDate(e.date_naissance) },
              { header: 'À charge',     width: '14%', render: e => fmtBool(e.a_charge) },
              { header: 'Filiation',    width: '34%', render: e => translate(FILIATION, e.filiation) },
            ]}
            rows={foyer.enfants}
          />
        </SubSection>
      )}
    </div>
  )
}

// ── Groupe 1 — Patrimoine ─────────────────────────────────────────────────────

function PatrimoineReadonly({ snapshot }: { snapshot: SnapshotPrefill }) {
  const { patrimoine_financier: fin, patrimoine_immobilier: immo, passifs, budget, prevoyance, fiscalite } = snapshot
  const hasContent =
    fin.length > 0 || immo.length > 0 || passifs.length > 0 ||
    budget.revenus.length > 0 || budget.charges.length > 0 ||
    prevoyance.testament || prevoyance.contrats.length > 0 ||
    fiscalite.tranche_ir !== null

  if (!hasContent) {
    return <p style={s.empty}>Aucune donnée patrimoniale enregistrée.</p>
  }

  return (
    <div style={s.readonly}>

      {immo.length > 0 && (
        <SubSection title="Patrimoine immobilier">
          <Table<SnapshotPrefillImmobilier>
            columns={[
              { header: 'Nature',          width: '18%', render: i => translate(NATURE_IMMOBILIER, i.nature) },
              { header: 'Détenu par',      width: '14%', render: i => translate(DETENU_PAR, i.detenu_par) },
              { header: 'Mode détention',  width: '18%', render: i => translate(MODE_DETENTION, detailString(i.detail, 'mode_detention')) },
              { header: 'Acquisition',     width: '13%', render: i => fmtDate(i.date_acquisition) },
              { header: 'Revenus annuels', width: '17%', render: i => fmtMontant(i.revenus_annuels) },
              { header: 'Valeur',          width: '20%', render: i => fmtMontant(i.valeur) },
            ]}
            rows={immo}
          />
        </SubSection>
      )}

      {fin.length > 0 && (
        <SubSection title="Épargne">
          <Table<SnapshotPrefillActif>
            columns={[
              { header: 'Nature',       width: '20%', render: a => translate(NATURE_FINANCIER, a.nature) },
              { header: 'Désignation',  width: '28%', render: a => a.libelle },
              { header: 'Ouverture',    width: '15%', render: a => fmtDate(a.date_souscription) },
              { header: 'Souscrit par', width: '17%', render: a => translate(DETENU_PAR, a.souscrit_par) },
              { header: 'Valeur',       width: '20%', render: a => fmtMontant(a.montant) },
            ]}
            rows={fin}
          />
        </SubSection>
      )}

      {passifs.length > 0 && (
        <SubSection title="Crédits">
          <Table<SnapshotPrefillPassif>
            columns={[
              { header: 'Nature',        width: '17%', render: p => translate(NATURE_PASSIF, p.nature) },
              { header: 'Établissement', width: '18%', render: p => p.banque },
              { header: 'Emprunté',      width: '15%', render: p => fmtMontant(p.montant) },
              { header: 'CRD',           width: '15%', render: p => fmtMontant(p.capital_restant_du) },
              { header: 'Mensualité',    width: '15%', render: p => fmtMontant(p.mensualite) },
              { header: 'Taux',          width: '10%', render: p => fmtPct(p.taux) },
            ]}
            rows={passifs}
          />
        </SubSection>
      )}

      {budget.revenus.length > 0 && (
        <SubSection title="Revenus">
          <Table<SnapshotPrefillBudgetPoste>
            columns={[
              { header: 'Nature',      width: '30%', render: r => translate(NATURE_REVENU, r.nature) },
              { header: 'Désignation', width: '45%', render: r => r.libelle },
              { header: 'Annuel',      width: '25%', render: r => fmtMontant(r.montant_annuel) },
            ]}
            rows={budget.revenus}
          />
        </SubSection>
      )}

      {budget.charges.length > 0 && (
        <SubSection title="Charges">
          <Table<SnapshotPrefillBudgetPoste>
            columns={[
              { header: 'Nature',      width: '30%', render: c => c.nature },
              { header: 'Désignation', width: '45%', render: c => c.libelle },
              { header: 'Annuel',      width: '25%', render: c => fmtMontant(c.montant_annuel) },
            ]}
            rows={budget.charges}
          />
        </SubSection>
      )}

      {(budget.revenus.length > 0 || budget.charges.length > 0) && (
        <Row label="Solde annuel" value={fmtMontant(budget.solde_annuel)} />
      )}

      {(prevoyance.testament || prevoyance.droits_retraite_estimes !== null || prevoyance.contrats.length > 0) && (
        <SubSection title="Prévoyance">
          <Row label="Testament"               value={fmtBool(prevoyance.testament)} />
          <Row label="Droits retraite estimés" value={prevoyance.droits_retraite_estimes !== null ? `${prevoyance.droits_retraite_estimes} €/mois` : null} />
          {prevoyance.contrats.length > 0 && (
            <Table<SnapshotPrefillContratPrevoyance>
              columns={[
                { header: 'Garantie',  width: '34%', render: c => translate(NATURE_PREVOYANCE, c.nature) },
                { header: 'Compagnie', width: '33%', render: c => c.compagnie },
                { header: 'Montant',   width: '33%', render: c => fmtMontant(c.montant) },
              ]}
              rows={prevoyance.contrats}
            />
          )}
        </SubSection>
      )}

      {(fiscalite.tranche_ir !== null || fiscalite.revenu_fiscal !== null || fiscalite.nombre_parts !== null || fiscalite.ifi !== null || fiscalite.dispositifs.length > 0) && (
        <SubSection title="Fiscalité">
          <Row label="Tranche IR"      value={fiscalite.tranche_ir ? `${fiscalite.tranche_ir} %` : null} />
          <Row label="Revenu fiscal"   value={fmtMontant(fiscalite.revenu_fiscal)} />
          <Row label="Nombre de parts" value={fiscalite.nombre_parts !== null ? String(fiscalite.nombre_parts) : null} />
          <Row label="Option barème"   value={fiscalite.option_bareme !== null ? fmtBool(fiscalite.option_bareme) : null} />
          <Row label="IFI"             value={fmtMontant(fiscalite.ifi)} />
          {fiscalite.dispositifs.length > 0 && (
            <div style={{ marginTop: spacing[1] }}>
              <p style={{ ...s.label, marginBottom: spacing[1] }}>Dispositifs fiscaux</p>
              <ul style={{ margin: `0 0 0 ${spacing[4]}`, padding: 0, listStyleType: 'disc' }}>
                {fiscalite.dispositifs.map(d => (
                  <li key={d} style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text, marginBottom: spacing[1] }}>{d}</li>
                ))}
              </ul>
            </div>
          )}
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
      <Table<SnapshotPrefillObjectif>
        columns={[
          { header: 'Priorité',      width: '12%', render: o => String(o.priorite) },
          { header: 'Objectif',      width: '38%', render: o => o.libelle },
          { header: 'Horizon',       width: '30%', render: o => translate(HORIZON_OBJECTIF, o.horizon) },
          { header: 'Montant cible', width: '20%', render: o => fmtMontant(o.montant_cible) },
        ]}
        rows={objectifs}
      />
    </div>
  )
}

// ── Composants UI ─────────────────────────────────────────────────────────────

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: spacing[4] }}>
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

function Table<T>({
  columns,
  rows,
}: {
  columns: { header: string; width?: string; render: (row: T) => string | null }[]
  rows: T[]
}) {
  return (
    <div style={{ marginBottom: spacing[2], overflowX: 'auto' }}>
      <div style={{ minWidth: '400px' }}>
        <div style={{ display: 'flex', gap: spacing[2], paddingBottom: spacing[1], marginBottom: spacing[1], borderBottom: `1.5px solid ${colors.blueLight}` }}>
          {columns.map(col => (
            <span key={col.header} style={{ ...s.tableHeader, width: col.width, flexShrink: 0 }}>
              {col.header}
            </span>
          ))}
        </div>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: spacing[2], paddingBottom: spacing[2], marginBottom: spacing[1], borderBottom: `1px solid ${colors.border}` }}>
            {columns.map(col => {
              const val = col.render(row)
              return (
                <span key={col.header} style={{ ...s.tableCell, width: col.width, flexShrink: 0, color: val ? colors.text : colors.textLight, fontStyle: val ? 'normal' : 'italic' }}>
                  {val ?? '—'}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  readonly: {
    padding: `${spacing[3]} 0`,
  } as React.CSSProperties,
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
  } as React.CSSProperties,
  tableHeader: {
    fontFamily: fonts.body,
    fontSize: '0.6rem',
    fontWeight: fontWeights.bold,
    color: colors.textMid,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  } as React.CSSProperties,
  tableCell: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    wordBreak: 'break-word' as const,
  } as React.CSSProperties,
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    fontStyle: 'italic' as const,
    padding: `${spacing[2]} 0`,
  } as React.CSSProperties,
}
