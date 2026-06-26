'use client'

import { useClient } from '@/lib/ClientContext'
import type { Famille, Enfant } from '@/lib/supabase'
import {
  CIVILITE, SITUATION_FAMILIALE, REGIME_MATRIMONIAL, REGIME_PACS,
  CATEGORIE_PROFESSIONNELLE, FILIATION,
} from '@/lib/referentiel/listes'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, inputBase, labelBase,
  buttonGhost, buttonDanger, transitions,
} from '@/lib/design-tokens'

// Valeur par défaut quand famille est null
const EMPTY_FAMILLE: Partial<Famille> = {
  civilite: null, nom: null, prenom: null, lieu_naissance: null,
  code_postal_naissance: null, date_naissance: null, nationalite: 'Française', situation: null,
  regime_matrimonial: null,
  date_mariage: null, contrat_mariage: null, date_contrat_mariage: null, donation_dernier_vivant: null,
  regime_pacs: null, date_pacs: null,
  adresse: null,
  code_postal: null, ville: null, email: null, telephone: null,
  profession: null, employeur: null, categorie_professionnelle: null,
  conjoint_civilite: null, conjoint_nom: null, conjoint_prenom: null,
  conjoint_date_naissance: null, conjoint_lieu_naissance: null,
  conjoint_nationalite: 'Française', conjoint_profession: null,
  conjoint_employeur: null, conjoint_email: null, conjoint_telephone: null,
}

const EMPTY_ENFANT: Omit<Enfant, 'id' | 'client_id'> = {
  prenom: '', nom: null, date_naissance: null, a_charge: true, filiation: null,
}

const AVEC_CONJOINT = ['marie', 'pacse', 'concubinage']

export default function FamillePage() {
  const { data, update } = useClient()
  const famille = { ...EMPTY_FAMILLE, ...data.famille } as Famille
  const enfants = data.enfants

  const setF = (field: keyof Famille) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    update('famille', { ...famille, [field]: e.target.value || null } as Famille)
  }

  const setBool = (field: keyof Famille) => (e: React.ChangeEvent<HTMLInputElement>) => {
    update('famille', { ...famille, [field]: e.target.checked } as Famille)
  }

  const avecConjoint = famille.situation ? AVEC_CONJOINT.includes(famille.situation) : false
  const estMarie = famille.situation === 'marie'
  const estPacse = famille.situation === 'pacse'

  // Enfants
  const addEnfant = () => update('enfants', [...enfants, { ...EMPTY_ENFANT, id: `new-${Date.now()}`, client_id: data.client.id }])
  const removeEnfant = (idx: number) => update('enfants', enfants.filter((_, i) => i !== idx))
  const setEnfant = (idx: number, field: keyof Enfant) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = field === 'a_charge' ? (e.target as HTMLInputElement).checked : (e.target.value || null)
    update('enfants', enfants.map((en, i) => i === idx ? { ...en, [field]: val } : en))
  }

  return (
    <div style={s.page}>
      {/* Identité */}
      <Card title="Identité du client">
        <div style={s.grid2}>
          <Field label="Civilité">
            <select style={{ ...inputBase, cursor: 'pointer' }} value={famille.civilite ?? ''} onChange={setF('civilite')}>
              <option value="">—</option>
              {CIVILITE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <div />
          <Field label="Prénom"><TextIn val={famille.prenom} onChange={setF('prenom')} /></Field>
          <Field label="Nom"><TextIn val={famille.nom} onChange={setF('nom')} /></Field>
          <Field label="Lieu de naissance"><TextIn val={famille.lieu_naissance} onChange={setF('lieu_naissance')} /></Field>
          <Field label="Code postal de naissance"><TextIn val={famille.code_postal_naissance} onChange={setF('code_postal_naissance')} /></Field>
          <Field label="Date de naissance"><TextIn type="date" val={famille.date_naissance} onChange={setF('date_naissance')} /></Field>
          <Field label="Nationalité"><TextIn val={famille.nationalite} onChange={setF('nationalite')} /></Field>
        </div>
      </Card>

      {/* Situation familiale */}
      <Card title="Situation familiale">
        <div style={s.grid2}>
          <Field label="Situation">
            <select style={{ ...inputBase, cursor: 'pointer' }} value={famille.situation ?? ''} onChange={setF('situation')}>
              <option value="">—</option>
              {SITUATION_FAMILIALE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {estMarie && (
            <Field label="Régime matrimonial">
              <select style={{ ...inputBase, cursor: 'pointer' }} value={famille.regime_matrimonial ?? ''} onChange={setF('regime_matrimonial')}>
                <option value="">—</option>
                {REGIME_MATRIMONIAL.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          )}
          {estMarie && (
            <>
              <Field label="Date de mariage"><TextIn type="date" val={famille.date_mariage} onChange={setF('date_mariage')} /></Field>
              <Field label="Contrat de mariage">
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={famille.contrat_mariage ?? false} onChange={setBool('contrat_mariage')} style={{ accentColor: colors.blue }} />
                  <span>Un contrat de mariage a été établi</span>
                </label>
              </Field>
              {famille.contrat_mariage && (
                <Field label="Date du contrat de mariage"><TextIn type="date" val={famille.date_contrat_mariage} onChange={setF('date_contrat_mariage')} /></Field>
              )}
              <Field label="Donation au dernier vivant">
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={famille.donation_dernier_vivant ?? false} onChange={setBool('donation_dernier_vivant')} style={{ accentColor: colors.blue }} />
                  <span>Donation au dernier vivant établie</span>
                </label>
              </Field>
            </>
          )}
          {estPacse && (
            <>
              <Field label="Régime du PACS">
                <select style={{ ...inputBase, cursor: 'pointer' }} value={famille.regime_pacs ?? ''} onChange={setF('regime_pacs')}>
                  <option value="">—</option>
                  {REGIME_PACS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Date de PACS"><TextIn type="date" val={famille.date_pacs} onChange={setF('date_pacs')} /></Field>
            </>
          )}
        </div>
      </Card>

      {/* Coordonnées */}
      <Card title="Coordonnées">
        <div style={s.grid2}>
          <Field label="Adresse" span={2}><TextIn val={famille.adresse} onChange={setF('adresse')} /></Field>
          <Field label="Code postal"><TextIn val={famille.code_postal} onChange={setF('code_postal')} /></Field>
          <Field label="Ville"><TextIn val={famille.ville} onChange={setF('ville')} /></Field>
          <Field label="Email"><TextIn type="email" val={famille.email} onChange={setF('email')} /></Field>
          <Field label="Téléphone"><TextIn type="tel" val={famille.telephone} onChange={setF('telephone')} /></Field>
        </div>
      </Card>

      {/* Profession */}
      <Card title="Situation professionnelle">
        <div style={s.grid2}>
          <Field label="Profession"><TextIn val={famille.profession} onChange={setF('profession')} /></Field>
          <Field label="Employeur"><TextIn val={famille.employeur} onChange={setF('employeur')} /></Field>
          <Field label="Catégorie professionnelle">
            <select style={{ ...inputBase, cursor: 'pointer' }} value={famille.categorie_professionnelle ?? ''} onChange={setF('categorie_professionnelle')}>
              <option value="">—</option>
              {CATEGORIE_PROFESSIONNELLE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {/* Conjoint */}
      {avecConjoint && (
        <Card title="Conjoint / Partenaire">
          <div style={s.grid2}>
            <Field label="Civilité">
              <select style={{ ...inputBase, cursor: 'pointer' }} value={famille.conjoint_civilite ?? ''} onChange={setF('conjoint_civilite')}>
                <option value="">—</option>
                {CIVILITE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <div />
            <Field label="Prénom"><TextIn val={famille.conjoint_prenom} onChange={setF('conjoint_prenom')} /></Field>
            <Field label="Nom"><TextIn val={famille.conjoint_nom} onChange={setF('conjoint_nom')} /></Field>
            <Field label="Date de naissance"><TextIn type="date" val={famille.conjoint_date_naissance} onChange={setF('conjoint_date_naissance')} /></Field>
            <Field label="Lieu de naissance"><TextIn val={famille.conjoint_lieu_naissance} onChange={setF('conjoint_lieu_naissance')} /></Field>
            <Field label="Nationalité"><TextIn val={famille.conjoint_nationalite} onChange={setF('conjoint_nationalite')} /></Field>
            <Field label="Profession"><TextIn val={famille.conjoint_profession} onChange={setF('conjoint_profession')} /></Field>
            <Field label="Employeur"><TextIn val={famille.conjoint_employeur} onChange={setF('conjoint_employeur')} /></Field>
            <Field label="Email"><TextIn type="email" val={famille.conjoint_email} onChange={setF('conjoint_email')} /></Field>
            <Field label="Téléphone"><TextIn type="tel" val={famille.conjoint_telephone} onChange={setF('conjoint_telephone')} /></Field>
          </div>
        </Card>
      )}

      {/* Enfants */}
      <Card title={`Enfants (${enfants.length})`}>
        {enfants.length > 0 && (
          <table style={s.table}>
            <thead>
              <tr>
                <Th>Prénom</Th>
                <Th>Nom</Th>
                <Th>Date de naissance</Th>
                <Th>Filiation</Th>
                <Th>À charge</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {enfants.map((en, i) => (
                <tr key={en.id}>
                  <Td><TextIn compact val={en.prenom} onChange={setEnfant(i, 'prenom')} /></Td>
                  <Td><TextIn compact val={en.nom} onChange={setEnfant(i, 'nom')} /></Td>
                  <Td><TextIn compact type="date" val={en.date_naissance} onChange={setEnfant(i, 'date_naissance')} /></Td>
                  <Td>
                    <select style={{ ...inputBase, padding: '4px 8px', fontSize: fontSizes.sm }} value={en.filiation ?? ''} onChange={setEnfant(i, 'filiation')}>
                      <option value="">—</option>
                      {FILIATION.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Td>
                  <Td>
                    <input type="checkbox" checked={en.a_charge} onChange={setEnfant(i, 'a_charge')} style={{ accentColor: colors.blue }} />
                  </Td>
                  <Td>
                    <button onClick={() => removeEnfant(i)} style={s.deleteBtn} title="Supprimer">✕</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button onClick={addEnfant} style={{ ...buttonGhost, marginTop: spacing[3], fontSize: fontSizes.sm, padding: `${spacing[2]} ${spacing[4]}` }}>
          + Ajouter un enfant
        </button>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...cardBase, boxShadow: shadows.sm, padding: spacing[6] }}>
      <div style={s.cardBar} />
      <h3 style={s.cardTitle}>{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1], gridColumn: span ? `span ${span}` : undefined }}>
      <label style={labelBase}>{label}</label>
      {children}
    </div>
  )
}

function TextIn({ val, onChange, type = 'text', compact }: {
  val: string | null | undefined
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  compact?: boolean
}) {
  return (
    <input
      type={type}
      value={val ?? ''}
      onChange={onChange}
      style={{ ...inputBase, ...(compact ? { padding: '4px 8px', fontSize: fontSizes.sm } : {}) }}
      onFocus={e => Object.assign(e.target.style, { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' })}
      onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
    />
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{
      fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
      letterSpacing: letterSpacings.wider, textTransform: 'uppercase',
      color: colors.blueDeep, backgroundColor: colors.bluePale,
      padding: `${spacing[2]} ${spacing[3]}`, textAlign: 'left',
      borderBottom: `2px solid ${colors.blueLight}`,
    }}>{children}</th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{
      padding: `${spacing[2]} ${spacing[3]}`,
      borderBottom: `1px solid ${colors.border}`,
      verticalAlign: 'middle',
    }}>{children}</td>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: spacing[5] },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[5] },
  cardBar: { width: '32px', height: '2px', backgroundColor: colors.gold, marginBottom: spacing[3] },
  cardTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep, letterSpacing: letterSpacings.wide, marginBottom: spacing[5],
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: spacing[2] },
  deleteBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: colors.danger,
    fontSize: fontSizes.sm, padding: '2px 6px', transition: transitions.fast,
    fontFamily: fonts.body,
  } as React.CSSProperties,
  checkLabel: {
    display: 'flex', alignItems: 'center', gap: spacing[2], cursor: 'pointer',
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text,
    height: '38px',
  } as React.CSSProperties,
}
