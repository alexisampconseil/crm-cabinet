'use client'

import { useClient } from '@/lib/ClientContext'
import type { ActifFinancier, BienImmobilier, Passif, BudgetPoste } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, inputBase, labelBase,
  buttonGhost, transitions,
} from '@/lib/design-tokens'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function id() { return `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

function fmt(n: number | null) {
  if (!n) return '0 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PatrimoinePage() {
  const { data, update } = useClient()
  const { actifsFinanciers: actifs, biensImmobiliers: biens, passifs, budgetPostes: budget, client } = data

  // ---- Actifs financiers ----
  const addActif = () => update('actifsFinanciers', [...actifs, {
    id: id(), client_id: client.id, nature: 'AV', libelle: '', montant: null,
    souscrit_par: 'client', date_souscription: null, detail: {}, created_at: new Date().toISOString(),
  } as ActifFinancier])

  const setActif = (idx: number, field: keyof ActifFinancier) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = field === 'montant' ? (e.target.value ? Number(e.target.value) : null) : (e.target.value || null)
    update('actifsFinanciers', actifs.map((a, i) => i === idx ? { ...a, [field]: val } : a))
  }

  const removeActif = (idx: number) => update('actifsFinanciers', actifs.filter((_, i) => i !== idx))

  // ---- Patrimoine immobilier ----
  const addBien = () => update('biensImmobiliers', [...biens, {
    id: id(), client_id: client.id, nature: 'RP', valeur: null, detenu_par: 'client',
    mode_detention: null, revenus_annuels: null, fiscalite: null, detail: {}, created_at: new Date().toISOString(),
  } as BienImmobilier])

  const setBien = (idx: number, field: keyof BienImmobilier) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = ['valeur', 'revenus_annuels'].includes(String(field))
      ? (e.target.value ? Number(e.target.value) : null)
      : (e.target.value || null)
    update('biensImmobiliers', biens.map((b, i) => i === idx ? { ...b, [field]: val } : b))
  }

  const removeBien = (idx: number) => update('biensImmobiliers', biens.filter((_, i) => i !== idx))

  // ---- Passifs ----
  const addPassif = () => update('passifs', [...passifs, {
    id: id(), client_id: client.id, nature: 'immobilier', banque: null, montant: null,
    duree: null, taux: null, mensualite: null, detail: {}, created_at: new Date().toISOString(),
  } as Passif])

  const setPassif = (idx: number, field: keyof Passif) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = ['montant', 'duree', 'taux', 'mensualite'].includes(String(field))
      ? (e.target.value ? Number(e.target.value) : null)
      : (e.target.value || null)
    update('passifs', passifs.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  const removePassif = (idx: number) => update('passifs', passifs.filter((_, i) => i !== idx))

  // ---- Budget ----
  const addPoste = (type: 'revenu' | 'charge') => update('budgetPostes', [...budget, {
    id: id(), client_id: client.id, type, libelle: '', montant_annuel: null,
  } as BudgetPoste])

  const setPoste = (idx: number, field: keyof BudgetPoste) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = field === 'montant_annuel' ? (e.target.value ? Number(e.target.value) : null) : e.target.value
    update('budgetPostes', budget.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  const removePoste = (idx: number) => update('budgetPostes', budget.filter((_, i) => i !== idx))

  // Totaux
  const totalActifs = actifs.reduce((s, a) => s + (a.montant ?? 0), 0)
  const totalBiens = biens.reduce((s, b) => s + (b.valeur ?? 0), 0)
  const totalPassifs = passifs.reduce((s, p) => s + (p.montant ?? 0), 0)
  const totalRevenus = budget.filter(p => p.type === 'revenu').reduce((s, p) => s + (p.montant_annuel ?? 0), 0)
  const totalCharges = budget.filter(p => p.type === 'charge').reduce((s, p) => s + (p.montant_annuel ?? 0), 0)

  return (
    <div style={s.page}>

      {/* Bilan rapide */}
      <div style={s.bilanRow}>
        <BilanCard label="Actifs financiers" value={fmt(totalActifs)} color={colors.success} />
        <BilanCard label="Patrimoine immobilier" value={fmt(totalBiens)} color={colors.blue} />
        <BilanCard label="Passifs totaux" value={fmt(totalPassifs)} color={colors.danger} />
        <BilanCard label="Patrimoine brut" value={fmt(totalActifs + totalBiens)} color={colors.blueDeep} />
        <BilanCard label="Patrimoine net" value={fmt(totalActifs + totalBiens - totalPassifs)} color={colors.gold} bold />
      </div>

      {/* Actifs financiers */}
      <Section title="Actifs financiers" total={fmt(totalActifs)} onAdd={addActif}>
        {actifs.length > 0 && (
          <table style={s.table}>
            <thead><tr>
              <TH>Nature</TH><TH>Libellé / Compagnie</TH><TH>Détenu par</TH>
              <TH>Date souscription</TH><TH right>Montant (€)</TH><TH />
            </tr></thead>
            <tbody>
              {actifs.map((a, i) => (
                <tr key={a.id}>
                  <TD>
                    <select style={selStyle} value={a.nature} onChange={setActif(i, 'nature')}>
                      {['AV','PER','SCPI','Capitalisation','PEA','CTO','Livret','CompteCourant','PrivateEquity','Autre'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </TD>
                  <TD><CI val={a.libelle} onChange={setActif(i, 'libelle')} /></TD>
                  <TD>
                    <select style={selStyle} value={a.souscrit_par ?? 'client'} onChange={setActif(i, 'souscrit_par')}>
                      <option value="client">Client</option>
                      <option value="conjoint">Conjoint</option>
                      <option value="commun">Commun</option>
                    </select>
                  </TD>
                  <TD><CI type="date" val={a.date_souscription} onChange={setActif(i, 'date_souscription')} /></TD>
                  <TD right><CI type="number" val={a.montant?.toString()} onChange={setActif(i, 'montant')} align="right" /></TD>
                  <TD><DelBtn onClick={() => removeActif(i)} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Patrimoine immobilier */}
      <Section title="Patrimoine immobilier" total={fmt(totalBiens)} onAdd={addBien}>
        {biens.length > 0 && (
          <table style={s.table}>
            <thead><tr>
              <TH>Nature</TH><TH>Détenu par</TH><TH>Mode de détention</TH>
              <TH right>Valeur (€)</TH><TH right>Revenus/an (€)</TH><TH>Fiscalité</TH><TH />
            </tr></thead>
            <tbody>
              {biens.map((b, i) => (
                <tr key={b.id}>
                  <TD>
                    <select style={selStyle} value={b.nature} onChange={setBien(i, 'nature')}>
                      {['RP','RS','LocatifNu','LocatifMeuble','SCI','Terrain','Autre'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </TD>
                  <TD>
                    <select style={selStyle} value={b.detenu_par ?? 'client'} onChange={setBien(i, 'detenu_par')}>
                      <option value="client">Client</option>
                      <option value="conjoint">Conjoint</option>
                      <option value="commun">Commun</option>
                      <option value="SCI">SCI</option>
                    </select>
                  </TD>
                  <TD><CI val={b.mode_detention} onChange={setBien(i, 'mode_detention')} placeholder="Pleine propriété…" /></TD>
                  <TD right><CI type="number" val={b.valeur?.toString()} onChange={setBien(i, 'valeur')} align="right" /></TD>
                  <TD right><CI type="number" val={b.revenus_annuels?.toString()} onChange={setBien(i, 'revenus_annuels')} align="right" /></TD>
                  <TD><CI val={b.fiscalite} onChange={setBien(i, 'fiscalite')} placeholder="ex: Pinel, LMNP…" /></TD>
                  <TD><DelBtn onClick={() => removeBien(i)} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Passifs */}
      <Section title="Emprunts & Passifs" total={fmt(totalPassifs)} onAdd={addPassif}>
        {passifs.length > 0 && (
          <table style={s.table}>
            <thead><tr>
              <TH>Nature</TH><TH>Banque</TH><TH right>Capital restant (€)</TH>
              <TH right>Durée (mois)</TH><TH right>Taux (%)</TH><TH right>Mensualité (€)</TH><TH />
            </tr></thead>
            <tbody>
              {passifs.map((p, i) => (
                <tr key={p.id}>
                  <TD>
                    <select style={selStyle} value={p.nature} onChange={setPassif(i, 'nature')}>
                      <option value="immobilier">Immobilier</option>
                      <option value="consommation">Consommation</option>
                      <option value="professionnel">Professionnel</option>
                      <option value="autre">Autre</option>
                    </select>
                  </TD>
                  <TD><CI val={p.banque} onChange={setPassif(i, 'banque')} /></TD>
                  <TD right><CI type="number" val={p.montant?.toString()} onChange={setPassif(i, 'montant')} align="right" /></TD>
                  <TD right><CI type="number" val={p.duree?.toString()} onChange={setPassif(i, 'duree')} align="right" /></TD>
                  <TD right><CI type="number" step="0.001" val={p.taux?.toString()} onChange={setPassif(i, 'taux')} align="right" /></TD>
                  <TD right><CI type="number" val={p.mensualite?.toString()} onChange={setPassif(i, 'mensualite')} align="right" /></TD>
                  <TD><DelBtn onClick={() => removePassif(i)} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Budget */}
      <div style={s.budgetGrid}>
        {/* Revenus */}
        <BudgetSection
          title="Revenus annuels"
          total={fmt(totalRevenus)}
          postes={budget.filter(p => p.type === 'revenu')}
          allBudget={budget}
          onAdd={() => addPoste('revenu')}
          setPoste={setPoste}
          removePoste={removePoste}
          color={colors.success}
        />
        {/* Charges */}
        <BudgetSection
          title="Charges annuelles"
          total={fmt(totalCharges)}
          postes={budget.filter(p => p.type === 'charge')}
          allBudget={budget}
          onAdd={() => addPoste('charge')}
          setPoste={setPoste}
          removePoste={removePoste}
          color={colors.danger}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function BilanCard({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{ ...cardBase, padding: `${spacing[4]} ${spacing[5]}`, flex: 1, borderTop: `2px solid ${color}` }}>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.label, textTransform: 'uppercase', color: colors.textMid, marginBottom: spacing[1] }}>{label}</p>
      <p style={{ fontFamily: fonts.heading, fontSize: '1.2rem', fontWeight: bold ? fontWeights.medium : fontWeights.light, color: bold ? color : colors.blueDeep }}>{value}</p>
    </div>
  )
}

function Section({ title, total, onAdd, children }: { title: string; total: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div style={{ ...cardBase, boxShadow: shadows.sm, overflow: 'hidden' } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing[4]} ${spacing[5]}`, borderBottom: `1px solid ${colors.border}` }}>
        <div>
          <h3 style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep }}>{title}</h3>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, marginTop: '2px' }}>Total : <strong>{total}</strong></p>
        </div>
        <button onClick={onAdd} style={{ ...buttonGhost, fontSize: fontSizes.sm, padding: `${spacing[2]} ${spacing[4]}` }}>+ Ajouter</button>
      </div>
      {children}
      {!children && <p style={{ padding: `${spacing[5]}`, color: colors.textLight, fontSize: fontSizes.sm, fontStyle: 'italic' }}>Aucun élément renseigné.</p>}
    </div>
  )
}

function BudgetSection({ title, total, postes, allBudget, onAdd, setPoste, removePoste, color }: {
  title: string; total: string; color: string
  postes: BudgetPoste[]; allBudget: BudgetPoste[]
  onAdd: () => void
  setPoste: (idx: number, field: keyof BudgetPoste) => (e: React.ChangeEvent<HTMLInputElement>) => void
  removePoste: (idx: number) => void
}) {
  return (
    <div style={{ ...cardBase, boxShadow: shadows.sm, borderTop: `2px solid ${color}` } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing[4]} ${spacing[5]}`, borderBottom: `1px solid ${colors.border}` }}>
        <div>
          <h3 style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep }}>{title}</h3>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color, fontWeight: fontWeights.medium, marginTop: '2px' }}>{total} / an</p>
        </div>
        <button onClick={onAdd} style={{ ...buttonGhost, fontSize: fontSizes.sm, padding: `${spacing[2]} ${spacing[4]}` }}>+ Ajouter</button>
      </div>
      <div style={{ padding: spacing[4] }}>
        {postes.length === 0 && <p style={{ color: colors.textLight, fontSize: fontSizes.sm, fontStyle: 'italic', padding: `${spacing[2]} 0` }}>Aucun poste renseigné.</p>}
        {postes.map(poste => {
          const idx = allBudget.findIndex(p => p.id === poste.id)
          return (
            <div key={poste.id} style={{ display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] }}>
              <input
                type="text" value={poste.libelle} placeholder="Libellé"
                onChange={setPoste(idx, 'libelle')}
                style={{ ...inputBase, flex: 1, padding: '6px 10px', fontSize: fontSizes.sm }}
                onFocus={e => Object.assign(e.target.style, { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' })}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
              <input
                type="number" value={poste.montant_annuel ?? ''} placeholder="Montant/an"
                onChange={setPoste(idx, 'montant_annuel')}
                style={{ ...inputBase, width: '140px', padding: '6px 10px', fontSize: fontSizes.sm, textAlign: 'right' }}
                onFocus={e => Object.assign(e.target.style, { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' })}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
              <button onClick={() => removePoste(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, fontFamily: fonts.body, fontSize: fontSizes.sm, flexShrink: 0, transition: transitions.fast }}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Cellules de table inline
const TH = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.wider, textTransform: 'uppercase', color: colors.blueDeep, backgroundColor: colors.bluePale, padding: `${spacing[2]} ${spacing[3]}`, textAlign: right ? 'right' : 'left', borderBottom: `2px solid ${colors.blueLight}` }}>{children}</th>
)

const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td style={{ padding: `${spacing[2]} ${spacing[3]}`, borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle', textAlign: right ? 'right' : 'left' }}>{children}</td>
)

// Input compact pour les cellules
const CI = ({ val, onChange, type = 'text', align, placeholder, step }: { val?: string | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; align?: string; placeholder?: string; step?: string }) => (
  <input
    type={type} value={val ?? ''} onChange={onChange} placeholder={placeholder} step={step}
    style={{ ...inputBase, padding: '4px 8px', fontSize: fontSizes.sm, textAlign: (align as 'right' | 'left') ?? 'left' }}
    onFocus={e => Object.assign(e.target.style, { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' })}
    onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
  />
)

const DelBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, fontFamily: fonts.body, fontSize: fontSizes.sm, padding: '2px 6px', transition: transitions.fast }}>✕</button>
)

const selStyle: React.CSSProperties = { ...inputBase, cursor: 'pointer', padding: '4px 8px', fontSize: fontSizes.sm }

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: spacing[5] },
  bilanRow: { display: 'flex', gap: spacing[3] },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  budgetGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[5] },
}
