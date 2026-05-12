'use client'

import { useClient } from '@/lib/ClientContext'
import type { Prevoyance, ContratPrevoyance } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, inputBase, labelBase, transitions,
} from '@/lib/design-tokens'

const NATURE_LABELS: Record<string, string> = {
  deces:      'Décès',
  incapacite: 'Incapacité de travail',
  invalidite: 'Invalidité',
  dependance: 'Dépendance',
  sante:      'Complémentaire santé',
  autre:      'Autre',
}

const NATURE_COLORS: Record<string, string> = {
  deces:      colors.blueDeep,
  incapacite: colors.warning,
  invalidite: colors.danger,
  dependance: colors.gold,
  sante:      colors.success,
  autre:      colors.textMid,
}

const EMPTY_PREVOYANCE: Omit<Prevoyance, 'id' | 'client_id' | 'created_at' | 'updated_at'> = {
  testament: false,
  droits_retraite_estimes: null,
  detail: null,
}

const mkContrat = (clientId: string): ContratPrevoyance => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  client_id: clientId,
  nature: 'deces',
  compagnie: null,
  montant: null,
  detail: {},
  created_at: new Date().toISOString(),
})

export default function PrevoyancePage() {
  const { data, update } = useClient()

  const prev: Prevoyance = {
    id: '',
    client_id: data.client.id,
    created_at: '',
    updated_at: '',
    ...EMPTY_PREVOYANCE,
    ...data.prevoyance,
  }
  const contrats = data.contratsPrevoyance

  // ---- Prévoyance principale ----
  const setP = (field: keyof Prevoyance) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const raw = e.target
    const val =
      field === 'testament' ? (raw as HTMLInputElement).checked :
      field === 'droits_retraite_estimes' ? ((raw as HTMLInputElement).value ? Number((raw as HTMLInputElement).value) : null) :
      (raw as HTMLTextAreaElement).value || null
    update('prevoyance', { ...prev, [field]: val } as Prevoyance)
  }

  // ---- Contrats ----
  const addContrat = () => update('contratsPrevoyance', [...contrats, mkContrat(data.client.id)])

  const removeContrat = (idx: number) =>
    update('contratsPrevoyance', contrats.filter((_, i) => i !== idx))

  const setContrat = (idx: number, field: keyof ContratPrevoyance) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const raw = e.target.value
    const val = field === 'montant' ? (raw ? Number(raw) : null) : raw || null
    update('contratsPrevoyance', contrats.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  }

  const totalCouverture = contrats.reduce((s, c) => s + (c.montant ?? 0), 0)

  return (
    <div style={s.page}>
      {/* Bilan prévoyance */}
      <Card title="Situation prévoyance">
        <div style={s.grid2}>
          {/* Testament */}
          <div style={s.checkField}>
            <label style={s.checkLabel}>
              <input
                type="checkbox"
                checked={prev.testament}
                onChange={setP('testament')}
                style={{ accentColor: colors.blue, width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span>
                <span style={s.checkTitle}>Testament rédigé</span>
                <span style={s.checkSub}>Le client dispose d'un testament ou d'une donation entre époux</span>
              </span>
            </label>
          </div>

          {/* Droits retraite */}
          <div style={s.field}>
            <label style={labelBase}>Droits retraite estimés (€/an)</label>
            <input
              type="number" min="0" step="500"
              value={prev.droits_retraite_estimes ?? ''}
              onChange={setP('droits_retraite_estimes')}
              placeholder="ex : 28 000"
              style={inputBase}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, blurStyle)}
            />
          </div>
        </div>

        {/* Détail / observations */}
        <div style={{ marginTop: spacing[4] }}>
          <label style={labelBase}>Observations / détail retraite</label>
          <textarea
            value={prev.detail ?? ''}
            onChange={setP('detail')}
            rows={4}
            placeholder="Régime de retraite, caisses complémentaires, plan de succession, dispositions particulières…"
            style={{
              ...inputBase,
              resize: 'vertical',
              lineHeight: '1.6',
              minHeight: '90px',
            }}
            onFocus={e => Object.assign(e.target.style, focusStyle)}
            onBlur={e => Object.assign(e.target.style, blurStyle)}
          />
        </div>

        {/* KPI récapitulatif */}
        {(prev.droits_retraite_estimes || prev.testament) && (
          <div style={s.kpiRow}>
            {prev.droits_retraite_estimes && (
              <Kpi label="Retraite estimée" value={fmt(prev.droits_retraite_estimes) + ' / an'} color={colors.blueDeep} />
            )}
            <Kpi
              label="Testament"
              value={prev.testament ? 'Oui' : 'Non'}
              color={prev.testament ? colors.success : colors.textLight}
            />
          </div>
        )}
      </Card>

      {/* Contrats de prévoyance */}
      <Card title={`Contrats de prévoyance (${contrats.length})`}>
        {contrats.length > 0 && (
          <>
            <table style={s.table}>
              <thead>
                <tr>
                  <TH>Nature</TH>
                  <TH>Compagnie</TH>
                  <TH>Capital / Rente (€)</TH>
                  <TH />
                </tr>
              </thead>
              <tbody>
                {contrats.map((c, i) => (
                  <tr key={c.id}>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                          backgroundColor: NATURE_COLORS[c.nature] ?? colors.textMid,
                        }} />
                        <select
                          style={selStyle}
                          value={c.nature}
                          onChange={setContrat(i, 'nature')}
                        >
                          {Object.entries(NATURE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </TD>
                    <TD>
                      <CI
                        value={c.compagnie ?? ''}
                        onChange={setContrat(i, 'compagnie')}
                        placeholder="ex : AXA, Generali…"
                      />
                    </TD>
                    <TD>
                      <CI
                        type="number"
                        value={c.montant ?? ''}
                        onChange={setContrat(i, 'montant')}
                        placeholder="ex : 150 000"
                        align="right"
                      />
                    </TD>
                    <TD>
                      <DelBtn onClick={() => removeContrat(i)} />
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total couverture */}
            {totalCouverture > 0 && (
              <div style={s.totalRow}>
                <span style={s.totalLabel}>Couverture totale estimée</span>
                <span style={s.totalVal}>{fmt(totalCouverture)}</span>
              </div>
            )}
          </>
        )}

        {contrats.length === 0 && (
          <p style={s.empty}>Aucun contrat de prévoyance renseigné.</p>
        )}

        <button
          onClick={addContrat}
          style={s.addBtn}
        >
          + Ajouter un contrat
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

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ ...s.kpi, borderTopColor: color }}>
      <span style={{ ...s.kpiVal, color }}>{value}</span>
      <span style={s.kpiLabel}>{label}</span>
    </div>
  )
}

function TH({ children }: { children?: React.ReactNode }) {
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

function TD({ children }: { children: React.ReactNode }) {
  return (
    <td style={{
      padding: `${spacing[2]} ${spacing[3]}`,
      borderBottom: `1px solid ${colors.border}`,
      verticalAlign: 'middle',
    }}>{children}</td>
  )
}

function CI({ value, onChange, placeholder, type = 'text', align }: {
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
  align?: 'right'
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        ...inputBase,
        padding: '4px 8px',
        fontSize: fontSizes.sm,
        textAlign: align ?? 'left',
      }}
      onFocus={e => Object.assign(e.target.style, focusStyle)}
      onBlur={e => Object.assign(e.target.style, blurStyle)}
    />
  )
}

function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: colors.danger, fontSize: fontSizes.sm, padding: '2px 6px',
        transition: transitions.fast, fontFamily: fonts.body,
      }}
      title="Supprimer"
    >✕</button>
  )
}

// ---------------------------------------------------------------------------
// Helpers & styles
// ---------------------------------------------------------------------------

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const focusStyle = { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' }
const blurStyle = { borderColor: colors.border, boxShadow: 'none' }

const selStyle: React.CSSProperties = {
  ...inputBase,
  padding: '4px 8px',
  fontSize: fontSizes.sm,
  cursor: 'pointer',
  width: 'auto',
}

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: spacing[5] },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[5], marginBottom: spacing[2] },
  field: { display: 'flex', flexDirection: 'column' as const, gap: spacing[1] },
  checkField: {
    display: 'flex', alignItems: 'flex-start',
    padding: `${spacing[4]} ${spacing[4]}`,
    backgroundColor: colors.offWhite,
    border: `1px solid ${colors.border}`,
  },
  checkLabel: {
    display: 'flex', alignItems: 'flex-start', gap: spacing[3], cursor: 'pointer',
  } as React.CSSProperties,
  checkTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium,
    color: colors.blueDeep, display: 'block', marginBottom: spacing[1],
  } as React.CSSProperties,
  checkSub: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid,
    fontWeight: fontWeights.light, display: 'block',
  } as React.CSSProperties,
  kpiRow: { display: 'flex', gap: spacing[4], flexWrap: 'wrap' as const, marginTop: spacing[5] },
  kpi: {
    display: 'flex', flexDirection: 'column' as const, gap: spacing[1],
    borderTop: '3px solid', padding: `${spacing[3]} ${spacing[4]}`,
    backgroundColor: colors.offWhite, minWidth: '160px',
  },
  kpiVal: {
    fontFamily: fonts.heading, fontSize: fontSizes['2xl'], fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacings.tight,
  },
  kpiLabel: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const,
    color: colors.textLight,
  },
  cardBar: { width: '32px', height: '2px', backgroundColor: colors.gold, marginBottom: spacing[3] },
  cardTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep, letterSpacing: letterSpacings.wide, marginBottom: spacing[5],
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: spacing[3] },
  totalRow: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: spacing[4],
    padding: `${spacing[3]} ${spacing[3]}`,
    borderTop: `2px solid ${colors.blueLight}`,
    backgroundColor: colors.bluePale,
  },
  totalLabel: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.wide, textTransform: 'uppercase' as const,
    color: colors.blueDeep,
  },
  totalVal: {
    fontFamily: fonts.heading, fontSize: fontSizes.xl, fontWeight: fontWeights.semibold,
    color: colors.blueDeep,
  },
  empty: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight,
    fontStyle: 'italic', padding: `${spacing[4]} 0`,
  },
  addBtn: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide, padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: 'transparent', color: colors.textMid,
    border: `1px solid ${colors.border}`, cursor: 'pointer',
    transition: transitions.fast, marginTop: spacing[3],
    display: 'inline-block',
  } as React.CSSProperties,
}
