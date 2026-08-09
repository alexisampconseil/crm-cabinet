'use client'

import { useClient } from '@/lib/ClientContext'
import type { ActifFinancier, BienImmobilier, Passif, BudgetPoste } from '@/lib/supabase'
import {
  AF_NATURE, SOUSCRIT_PAR, IMMO_NATURE, DETENU_PAR, TYPE_BIEN,
  MODE_DETENTION, TYPE_DEMEMBREMENT, REGIME_FISCAL_FONCIER, REGIME_FISCAL_MEUBLE,
  PASSIF_NATURE, REV_NATURE, REV_REGIME_FISCAL,
} from '@/lib/referentiel/listes'
import {
  AF_NATURES_AVEC_DATE, AF_NATURES_AVEC_DETENTION, AF_NATURES_ELIGIBLES_GESTION,
  IMMO_NATURES_LOCATIVES, IMMO_NATURES_REGIME_FONCIER, IMMO_NATURES_REGIME_MEUBLE,
} from '@/lib/referentiel/conditionsProduit'
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

function detailStr(detail: Record<string, unknown>, key: string): string {
  const v = detail[key]
  return v == null ? '' : String(v)
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
    souscrit_par: 'client', date_souscription: null, sous_gestion_cabinet: false, detail: {}, created_at: new Date().toISOString(),
  } as ActifFinancier])

  const setActif = (idx: number, field: keyof ActifFinancier) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = field === 'montant' ? (e.target.value ? Number(e.target.value) : null) : (e.target.value || null)
    update('actifsFinanciers', actifs.map((a, i) => i === idx ? { ...a, [field]: val } : a))
  }

  // Changer la nature : si la nouvelle nature n'est pas éligible à la gestion
  // cabinet, on remet sous_gestion_cabinet à FALSE (cohérence avec le garde-fou base).
  const setActifNature = (idx: number) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nature = e.target.value as ActifFinancier['nature']
    const eligible = (AF_NATURES_ELIGIBLES_GESTION as readonly string[]).includes(nature)
    update('actifsFinanciers', actifs.map((a, i) => i === idx
      ? { ...a, nature, sous_gestion_cabinet: eligible ? a.sous_gestion_cabinet : false }
      : a))
  }

  const setSousGestion = (idx: number, checked: boolean) =>
    update('actifsFinanciers', actifs.map((a, i) => i === idx ? { ...a, sous_gestion_cabinet: checked } : a))

  const setActifDetail = (idx: number, key: string, numeric = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value
    const val = numeric ? (raw ? Number(raw) : null) : (raw || null)
    update('actifsFinanciers', actifs.map((a, i) => i === idx ? { ...a, detail: { ...a.detail, [key]: val } } : a))
  }

  const removeActif = (idx: number) => update('actifsFinanciers', actifs.filter((_, i) => i !== idx))

  // ---- Patrimoine immobilier ----
  const addBien = () => update('biensImmobiliers', [...biens, {
    id: id(), client_id: client.id, nature: 'RP', valeur: null, detenu_par: 'client',
    revenus_annuels: null, fiscalite: null, date_acquisition: null, quote_part_detenue: null,
    detail: {}, created_at: new Date().toISOString(),
  } as BienImmobilier])

  const setBien = (idx: number, field: keyof BienImmobilier) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = ['valeur', 'revenus_annuels', 'quote_part_detenue'].includes(String(field))
      ? (e.target.value ? Number(e.target.value) : null)
      : (e.target.value || null)
    update('biensImmobiliers', biens.map((b, i) => i === idx ? { ...b, [field]: val } : b))
  }

  const setBienDetail = (idx: number, key: string, numeric = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value
    const val = numeric ? (raw ? Number(raw) : null) : (raw || null)
    update('biensImmobiliers', biens.map((b, i) => i === idx ? { ...b, detail: { ...b.detail, [key]: val } } : b))
  }

  const removeBien = (idx: number) => update('biensImmobiliers', biens.filter((_, i) => i !== idx))

  // ---- Passifs ----
  const addPassif = () => update('passifs', [...passifs, {
    id: id(), client_id: client.id, nature: 'immobilier', banque: null, montant: null,
    duree: null, taux: null, mensualite: null, capital_restant_du: null, detail: {}, created_at: new Date().toISOString(),
  } as Passif])

  const setPassif = (idx: number, field: keyof Passif) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = ['montant', 'duree', 'taux', 'mensualite', 'capital_restant_du'].includes(String(field))
      ? (e.target.value ? Number(e.target.value) : null)
      : (e.target.value || null)
    update('passifs', passifs.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  const setPassifDetail = (idx: number, key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    update('passifs', passifs.map((p, i) => i === idx ? { ...p, detail: { ...p.detail, [key]: raw ? Number(raw) : null } } : p))
  }

  const removePassif = (idx: number) => update('passifs', passifs.filter((_, i) => i !== idx))

  // ---- Budget ----
  const addPoste = (type: 'revenu' | 'charge') => update('budgetPostes', [...budget, {
    id: id(), client_id: client.id, type, libelle: '', montant_annuel: null, nature: null, detail: {},
  } as BudgetPoste])

  const setPoste = (idx: number, field: keyof BudgetPoste) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = field === 'montant_annuel' ? (e.target.value ? Number(e.target.value) : null) : (e.target.value || null)
    update('budgetPostes', budget.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  const setPosteDetail = (idx: number, key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value
    update('budgetPostes', budget.map((p, i) => i === idx ? { ...p, detail: { ...p.detail, [key]: raw || null } } : p))
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
        {actifs.map((a, i) => {
          const avecDate = (AF_NATURES_AVEC_DATE as readonly string[]).includes(a.nature)
          const avecDetention = (AF_NATURES_AVEC_DETENTION as readonly string[]).includes(a.nature)
          const eligibleGestion = (AF_NATURES_ELIGIBLES_GESTION as readonly string[]).includes(a.nature)
          const modeDetention = detailStr(a.detail, 'mode_detention')
          const enNuePropriete = modeDetention === 'nue_propriete'
          return (
            <ItemCard key={a.id} onDelete={() => removeActif(i)}>
              <div style={s.row}>
                <Field label="Nature" w="180px">
                  <select style={selStyle} value={a.nature} onChange={setActifNature(i)}>
                    {AF_NATURE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Libellé / Compagnie" w="220px"><CI val={a.libelle} onChange={setActif(i, 'libelle')} /></Field>
                <Field label="Souscrit par" w="140px">
                  <select style={selStyle} value={a.souscrit_par ?? 'client'} onChange={setActif(i, 'souscrit_par')}>
                    {SOUSCRIT_PAR.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                {avecDate && (
                  <Field label="Date souscription" w="150px"><CI type="date" val={a.date_souscription} onChange={setActif(i, 'date_souscription')} /></Field>
                )}
                <Field label="Montant (€)" w="140px"><CI type="number" val={a.montant?.toString()} onChange={setActif(i, 'montant')} align="right" /></Field>
                {/* Sous gestion cabinet — même ligne, à droite du Montant (natures éligibles) */}
                {eligibleGestion && (
                  <Field label={' '}>
                    <label style={s.gestionToggle}>
                      <input type="checkbox" checked={!!a.sous_gestion_cabinet} onChange={e => setSousGestion(i, e.target.checked)} />
                      <span>Sous gestion du cabinet</span>
                    </label>
                  </Field>
                )}
              </div>
              {avecDetention && (
                <div style={s.detailRow}>
                  <Field label="Mode de détention" w="180px">
                    <select style={selStyle} value={modeDetention} onChange={setActifDetail(i, 'mode_detention')}>
                      <option value="">—</option>
                      {MODE_DETENTION.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  {enNuePropriete && (
                    <>
                      <Field label="Usufruit" w="140px">
                        <select style={selStyle} value={detailStr(a.detail, 'type_demembrement')} onChange={setActifDetail(i, 'type_demembrement')}>
                          <option value="">—</option>
                          {TYPE_DEMEMBREMENT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Âge usufruitier" w="120px"><CI type="number" val={detailStr(a.detail, 'age_usufruitier')} onChange={setActifDetail(i, 'age_usufruitier', true)} /></Field>
                      <Field label="Date démembrement" w="150px"><CI type="date" val={detailStr(a.detail, 'date_demembrement')} onChange={setActifDetail(i, 'date_demembrement')} /></Field>
                      <Field label="Lien usufruitier" w="180px"><CI val={detailStr(a.detail, 'lien_usufruitier')} onChange={setActifDetail(i, 'lien_usufruitier')} /></Field>
                    </>
                  )}
                </div>
              )}
            </ItemCard>
          )
        })}
      </Section>

      {/* Patrimoine immobilier */}
      <Section title="Patrimoine immobilier" total={fmt(totalBiens)} onAdd={addBien}>
        {biens.map((b, i) => {
          const avecRevenus = (IMMO_NATURES_LOCATIVES as readonly string[]).includes(b.nature)
          const avecFoncier = (IMMO_NATURES_REGIME_FONCIER as readonly string[]).includes(b.nature)
          const avecMeuble = (IMMO_NATURES_REGIME_MEUBLE as readonly string[]).includes(b.nature)
          const modeDetention = detailStr(b.detail, 'mode_detention')
          const enNuePropriete = modeDetention === 'nue_propriete'
          return (
            <ItemCard key={b.id} onDelete={() => removeBien(i)}>
              <div style={s.row}>
                <Field label="Nature" w="160px">
                  <select style={selStyle} value={b.nature} onChange={setBien(i, 'nature')}>
                    {IMMO_NATURE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Type de bien" w="160px">
                  <select style={selStyle} value={detailStr(b.detail, 'type_bien')} onChange={setBienDetail(i, 'type_bien')}>
                    <option value="">—</option>
                    {TYPE_BIEN.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Détenu par" w="140px">
                  <select style={selStyle} value={b.detenu_par ?? 'client'} onChange={setBien(i, 'detenu_par')}>
                    {DETENU_PAR.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Valeur (€)" w="140px"><CI type="number" val={b.valeur?.toString()} onChange={setBien(i, 'valeur')} align="right" /></Field>
                <Field label="Quote-part (%)" w="120px"><CI type="number" val={b.quote_part_detenue?.toString()} onChange={setBien(i, 'quote_part_detenue')} align="right" /></Field>
                <Field label="Date d'acquisition" w="150px"><CI type="date" val={b.date_acquisition} onChange={setBien(i, 'date_acquisition')} /></Field>
              </div>
              {avecRevenus && (
                <div style={s.row}>
                  <Field label="Revenus locatifs/an (€)" w="170px"><CI type="number" val={b.revenus_annuels?.toString()} onChange={setBien(i, 'revenus_annuels')} align="right" /></Field>
                  {avecFoncier && (
                    <Field label="Régime fiscal (location nue)" w="200px">
                      <select style={selStyle} value={detailStr(b.detail, 'regime_fiscal')} onChange={setBienDetail(i, 'regime_fiscal')}>
                        <option value="">—</option>
                        {REGIME_FISCAL_FONCIER.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  )}
                  {avecMeuble && (
                    <Field label="Régime fiscal (location meublée)" w="200px">
                      <select style={selStyle} value={detailStr(b.detail, 'regime_fiscal')} onChange={setBienDetail(i, 'regime_fiscal')}>
                        <option value="">—</option>
                        {REGIME_FISCAL_MEUBLE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Fiscalité / dispositif" w="200px"><CI val={b.fiscalite} onChange={setBien(i, 'fiscalite')} placeholder="ex: Pinel, LMNP…" /></Field>
                </div>
              )}
              <div style={s.detailRow}>
                <Field label="Mode de détention" w="180px">
                  <select style={selStyle} value={modeDetention} onChange={setBienDetail(i, 'mode_detention')}>
                    <option value="">—</option>
                    {MODE_DETENTION.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                {enNuePropriete && (
                  <>
                    <Field label="Usufruit" w="140px">
                      <select style={selStyle} value={detailStr(b.detail, 'type_demembrement')} onChange={setBienDetail(i, 'type_demembrement')}>
                        <option value="">—</option>
                        {TYPE_DEMEMBREMENT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Âge usufruitier" w="120px"><CI type="number" val={detailStr(b.detail, 'age_usufruitier')} onChange={setBienDetail(i, 'age_usufruitier', true)} /></Field>
                    <Field label="Date démembrement" w="150px"><CI type="date" val={detailStr(b.detail, 'date_demembrement')} onChange={setBienDetail(i, 'date_demembrement')} /></Field>
                    <Field label="Lien usufruitier" w="180px"><CI val={detailStr(b.detail, 'lien_usufruitier')} onChange={setBienDetail(i, 'lien_usufruitier')} /></Field>
                  </>
                )}
              </div>
            </ItemCard>
          )
        })}
      </Section>

      {/* Passifs */}
      <Section title="Emprunts & Passifs" total={fmt(totalPassifs)} onAdd={addPassif}>
        {passifs.map((p, i) => (
          <ItemCard key={p.id} onDelete={() => removePassif(i)}>
            <div style={s.row}>
              <Field label="Nature" w="160px">
                <select style={selStyle} value={p.nature} onChange={setPassif(i, 'nature')}>
                  {PASSIF_NATURE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Banque" w="180px"><CI val={p.banque} onChange={setPassif(i, 'banque')} /></Field>
              <Field label="Capital emprunté (€)" w="150px"><CI type="number" val={p.montant?.toString()} onChange={setPassif(i, 'montant')} align="right" /></Field>
              <Field label="Capital restant dû (€)" w="150px"><CI type="number" val={p.capital_restant_du?.toString()} onChange={setPassif(i, 'capital_restant_du')} align="right" /></Field>
              <Field label="Durée (mois)" w="110px"><CI type="number" val={p.duree?.toString()} onChange={setPassif(i, 'duree')} align="right" /></Field>
              <Field label="Taux d'intérêt hors assurance (%)" w="140px"><CI type="number" step="0.001" val={p.taux?.toString()} onChange={setPassif(i, 'taux')} align="right" /></Field>
              <Field label="Mensualité (€)" w="120px"><CI type="number" val={p.mensualite?.toString()} onChange={setPassif(i, 'mensualite')} align="right" /></Field>
            </div>
            <div style={s.detailRow}>
              <Field label="Quotité — part par membre du foyer (%)" w="220px"><CI type="number" val={detailStr(p.detail, 'quotite')} onChange={setPassifDetail(i, 'quotite')} align="right" /></Field>
            </div>
          </ItemCard>
        ))}
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
          setPosteDetail={setPosteDetail}
          removePoste={removePoste}
          color={colors.success}
          avecNature
        />
        {/* Charges */}
        <BudgetSection
          title="Charges annuelles"
          total={fmt(totalCharges)}
          postes={budget.filter(p => p.type === 'charge')}
          allBudget={budget}
          onAdd={() => addPoste('charge')}
          setPoste={setPoste}
          setPosteDetail={setPosteDetail}
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
    <div style={{ ...cardBase, padding: `${spacing[4]} ${spacing[5]}`, flex: 1, minWidth: 0, borderTop: `2px solid ${color}` }}>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.label, textTransform: 'uppercase', color: colors.textMid, marginBottom: spacing[1] }}>{label}</p>
      <p style={{ fontFamily: fonts.heading, fontSize: '1.2rem', fontWeight: bold ? fontWeights.medium : fontWeights.light, color: bold ? color : colors.blueDeep }}>{value}</p>
    </div>
  )
}

function Section({ title, total, onAdd, children }: { title: string; total: string; onAdd: () => void; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div style={{ ...cardBase, boxShadow: shadows.sm, padding: spacing[5] } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4] }}>
        <div>
          <h3 style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep }}>{title}</h3>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, marginTop: '2px' }}>Total : <strong>{total}</strong></p>
        </div>
        <button onClick={onAdd} style={{ ...buttonGhost, fontSize: fontSizes.sm, padding: `${spacing[2]} ${spacing[4]}` }}>+ Ajouter</button>
      </div>
      {hasChildren ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>{children}</div>
      ) : (
        <p style={{ color: colors.textLight, fontSize: fontSizes.sm, fontStyle: 'italic' }}>Aucun élément renseigné.</p>
      )}
    </div>
  )
}

// Carte pour une ligne répétable (actif, bien, passif) — champs principaux puis
// champs `detail` JSONB conditionnels, pour qu'un conseiller comprenne tout le
// patrimoine sans rouvrir le questionnaire KYC.
function ItemCard({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  return (
    <div style={s.itemCard}>
      <button onClick={onDelete} style={s.itemDelete} title="Supprimer">✕</button>
      {children}
    </div>
  )
}

function Field({ label, children, w }: { label: string; children: React.ReactNode; w?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: w }}>
      <label style={s.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function BudgetSection({ title, total, postes, allBudget, onAdd, setPoste, setPosteDetail, removePoste, color, avecNature }: {
  title: string; total: string; color: string
  postes: BudgetPoste[]; allBudget: BudgetPoste[]
  onAdd: () => void
  setPoste: (idx: number, field: keyof BudgetPoste) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  setPosteDetail: (idx: number, key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  removePoste: (idx: number) => void
  avecNature?: boolean
}) {
  return (
    <div style={{ ...cardBase, boxShadow: shadows.sm, borderTop: `2px solid ${color}`, padding: spacing[5], minWidth: 0 } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4] }}>
        <div>
          <h3 style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep }}>{title}</h3>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color, fontWeight: fontWeights.medium, marginTop: '2px' }}>{total} / an</p>
        </div>
        <button onClick={onAdd} style={{ ...buttonGhost, fontSize: fontSizes.sm, padding: `${spacing[2]} ${spacing[4]}` }}>+ Ajouter</button>
      </div>
      {postes.length === 0 && <p style={{ color: colors.textLight, fontSize: fontSizes.sm, fontStyle: 'italic' }}>Aucun poste renseigné.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        {postes.map(poste => {
          const idx = allBudget.findIndex(p => p.id === poste.id)
          const nature = poste.nature ?? ''
          const sousChamp = REV_NATURE_DETAIL_CHAMP[nature]
          return (
            <ItemCard key={poste.id} onDelete={() => removePoste(idx)}>
              <div style={s.row}>
                {avecNature && (
                  <Field label="Nature" w="170px">
                    <select style={selStyle} value={nature} onChange={setPoste(idx, 'nature')}>
                      <option value="">—</option>
                      {REV_NATURE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Libellé" w="220px"><CI val={poste.libelle} onChange={setPoste(idx, 'libelle')} /></Field>
                <Field label="Montant / an (€)" w="140px"><CI type="number" val={poste.montant_annuel?.toString()} onChange={setPoste(idx, 'montant_annuel')} align="right" /></Field>
              </div>
              {avecNature && sousChamp && (
                <div style={s.detailRow}>
                  {sousChamp === 'regime_fiscal' ? (
                    <Field label="Régime fiscal" w="160px">
                      <select style={selStyle} value={detailStr(poste.detail, sousChamp)} onChange={setPosteDetail(idx, sousChamp)}>
                        <option value="">—</option>
                        {REV_REGIME_FISCAL.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  ) : (
                    <Field label={REV_NATURE_DETAIL_LABEL[sousChamp]} w="220px">
                      <CI val={detailStr(poste.detail, sousChamp)} onChange={setPosteDetail(idx, sousChamp)} />
                    </Field>
                  )}
                </div>
              )}
            </ItemCard>
          )
        })}
      </div>
    </div>
  )
}

// Sous-champ `detail` pertinent par catégorie de revenu — même logique que le
// questionnaire KYC (lib/referentiel/conditionsProduit.ts ne couvre que
// actifs/immobilier ; les revenus n'ont qu'un seul sous-champ affiché à la
// fois en CRM, contrairement au KYC qui peut en afficher plusieurs).
const REV_NATURE_DETAIL_CHAMP: Record<string, string> = {
  tns: 'regime_fiscal',
  bic: 'regime_fiscal',
  bnc: 'regime_fiscal',
  ba: 'regime_fiscal',
  fonciers: 'regime_fiscal',
  dividendes: 'societe',
  capitaux_mobiliers: 'nature_produit',
  pension_alimentaire_recue: 'beneficiaire_debiteur',
  pension_alimentaire_versee: 'beneficiaire_debiteur',
  retraite: 'organisme_payeur',
  autre: 'precision',
}

const REV_NATURE_DETAIL_LABEL: Record<string, string> = {
  societe: 'Société distributrice',
  nature_produit: 'Nature du produit',
  beneficiaire_debiteur: 'Bénéficiaire / débiteur',
  organisme_payeur: 'Organisme payeur',
  precision: 'Précision',
}

// Input compact
const CI = ({ val, onChange, type = 'text', align, placeholder, step }: { val?: string | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; align?: string; placeholder?: string; step?: string }) => (
  <input
    type={type} value={val ?? ''} onChange={onChange} placeholder={placeholder} step={step}
    style={{ ...inputBase, padding: '6px 8px', fontSize: fontSizes.sm, textAlign: (align as 'right' | 'left') ?? 'left' }}
    onFocus={e => Object.assign(e.target.style, { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' })}
    onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
  />
)

const selStyle: React.CSSProperties = { ...inputBase, cursor: 'pointer', padding: '6px 8px', fontSize: fontSizes.sm }

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: spacing[5] },
  bilanRow: { display: 'flex', gap: spacing[3] },
  budgetGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[5] },
  row: { display: 'flex', flexWrap: 'wrap' as const, gap: spacing[4] },
  detailRow: {
    display: 'flex', flexWrap: 'wrap' as const, gap: spacing[4],
    marginTop: spacing[3], paddingTop: spacing[3], borderTop: `1px dashed ${colors.border}`,
  },
  itemCard: {
    position: 'relative' as const,
    padding: spacing[4],
    backgroundColor: colors.offWhite,
    border: `1px solid ${colors.border}`,
  },
  itemDelete: {
    position: 'absolute' as const, top: spacing[2], right: spacing[2],
    background: 'none', border: 'none', cursor: 'pointer', color: colors.danger,
    fontFamily: fonts.body, fontSize: fontSizes.sm, padding: '2px 6px', transition: transitions.fast,
  } as React.CSSProperties,
  fieldLabel: {
    fontFamily: fonts.body, fontSize: '0.65rem', fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const,
    color: colors.textMid,
  },
  gestionToggle: {
    display: 'flex', alignItems: 'center', gap: spacing[2],
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text,
    padding: '6px 0', cursor: 'pointer', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
}
