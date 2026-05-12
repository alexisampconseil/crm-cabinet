'use client'

import { useState } from 'react'
import { useClient } from '@/lib/ClientContext'
import type { Fiscalite } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, inputBase, labelBase, transitions,
} from '@/lib/design-tokens'

const DISPOSITIFS_PRESETS = [
  'Pinel', 'Pinel+', 'Malraux', 'Monuments Historiques',
  'Girardin', 'Denormandie', 'Déficit foncier', 'LMP',
  'LMNP', 'Madelin', 'PER (déductible)', 'IR-PME', 'Dutreil',
  'SOFICA', 'CEL / PEL', 'Démembrement', 'GFI',
]

const TRANCHE_LABELS: Record<string, string> = {
  '0':  '0 % — Non imposable',
  '11': '11 %',
  '30': '30 %',
  '41': '41 %',
  '45': '45 %',
}

const EMPTY_FISCALITE: Omit<Fiscalite, 'id' | 'client_id' | 'created_at' | 'updated_at'> = {
  tranche_ir: null,
  revenu_fiscal: null,
  ifi: null,
  dispositifs: [],
}

export default function FiscalitePage() {
  const { data, update } = useClient()
  const fisc: Fiscalite = {
    id: '',
    client_id: data.client.id,
    created_at: '',
    updated_at: '',
    ...EMPTY_FISCALITE,
    ...data.fiscalite,
  }

  const [customInput, setCustomInput] = useState('')

  const set = (field: keyof Fiscalite) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const raw = e.target.value
    const val = field === 'revenu_fiscal' || field === 'ifi'
      ? (raw ? Number(raw) : null)
      : raw || null
    update('fiscalite', { ...fisc, [field]: val } as Fiscalite)
  }

  const addDispositif = (d: string) => {
    if (!d.trim()) return
    if (fisc.dispositifs.includes(d.trim())) return
    update('fiscalite', { ...fisc, dispositifs: [...fisc.dispositifs, d.trim()] } as Fiscalite)
    setCustomInput('')
  }

  const removeDispositif = (d: string) => {
    update('fiscalite', { ...fisc, dispositifs: fisc.dispositifs.filter(x => x !== d) } as Fiscalite)
  }

  const tranche = fisc.tranche_ir ? Number(fisc.tranche_ir) : null

  return (
    <div style={s.page}>
      {/* Situation fiscale */}
      <Card title="Situation fiscale">
        <div style={s.grid3}>
          <div style={s.field}>
            <label style={labelBase}>Tranche marginale d'imposition (IR)</label>
            <select
              style={{ ...inputBase, cursor: 'pointer' }}
              value={fisc.tranche_ir ?? ''}
              onChange={set('tranche_ir')}
            >
              <option value="">— Non renseignée</option>
              {Object.entries(TRANCHE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div style={s.field}>
            <label style={labelBase}>Revenu fiscal de référence (€)</label>
            <input
              type="number" min="0" step="1000"
              value={fisc.revenu_fiscal ?? ''}
              onChange={set('revenu_fiscal')}
              placeholder="ex : 85 000"
              style={inputBase}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, blurStyle)}
            />
          </div>

          <div style={s.field}>
            <label style={labelBase}>IFI (€)</label>
            <input
              type="number" min="0" step="100"
              value={fisc.ifi ?? ''}
              onChange={set('ifi')}
              placeholder="Laisser vide si non assujetti"
              style={inputBase}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, blurStyle)}
            />
          </div>
        </div>

        {/* Indicateurs */}
        {(fisc.tranche_ir || fisc.revenu_fiscal || fisc.ifi) && (
          <div style={s.kpiRow}>
            {fisc.tranche_ir && (
              <Kpi
                label="TMI"
                value={`${fisc.tranche_ir} %`}
                color={tranche !== null && tranche >= 41 ? colors.danger : tranche !== null && tranche >= 30 ? colors.warning : colors.success}
              />
            )}
            {fisc.revenu_fiscal && (
              <Kpi
                label="Revenu fiscal"
                value={fmt(fisc.revenu_fiscal)}
                color={colors.blueDeep}
              />
            )}
            {fisc.ifi && (
              <Kpi
                label="IFI"
                value={fmt(fisc.ifi)}
                color={colors.gold}
              />
            )}
          </div>
        )}
      </Card>

      {/* Dispositifs fiscaux */}
      <Card title="Dispositifs fiscaux actifs">
        <p style={s.hint}>
          Sélectionnez les dispositifs en vigueur pour ce client. Ils seront pris en compte dans les recommandations.
        </p>

        {/* Presets */}
        <div style={s.presets}>
          {DISPOSITIFS_PRESETS.map(d => {
            const active = fisc.dispositifs.includes(d)
            return (
              <button
                key={d}
                onClick={() => active ? removeDispositif(d) : addDispositif(d)}
                style={active ? s.tagActive : s.tagInactive}
              >
                {active && <span style={{ marginRight: '4px' }}>✓</span>}
                {d}
              </button>
            )
          })}
        </div>

        {/* Tag personnalisé */}
        <div style={s.customRow}>
          <input
            type="text"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDispositif(customInput) } }}
            placeholder="Autre dispositif (Entrée pour valider)"
            style={{ ...inputBase, flex: 1 }}
            onFocus={e => Object.assign(e.target.style, focusStyle)}
            onBlur={e => Object.assign(e.target.style, blurStyle)}
          />
          <button
            onClick={() => addDispositif(customInput)}
            style={s.addBtn}
          >
            Ajouter
          </button>
        </div>

        {/* Tags sélectionnés hors presets */}
        {fisc.dispositifs.filter(d => !DISPOSITIFS_PRESETS.includes(d)).length > 0 && (
          <div style={{ ...s.presets, marginTop: spacing[3] }}>
            {fisc.dispositifs
              .filter(d => !DISPOSITIFS_PRESETS.includes(d))
              .map(d => (
                <button key={d} onClick={() => removeDispositif(d)} style={s.tagActive}>
                  <span style={{ marginRight: '4px' }}>✓</span>{d}
                </button>
              ))
            }
          </div>
        )}

        {fisc.dispositifs.length === 0 && (
          <p style={s.emptyHint}>Aucun dispositif sélectionné.</p>
        )}
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const focusStyle = { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' }
const blurStyle = { borderColor: colors.border, boxShadow: 'none' }

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: spacing[5] },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[5], marginBottom: spacing[5] },
  field: { display: 'flex', flexDirection: 'column' as const, gap: spacing[1] },
  cardBar: { width: '32px', height: '2px', backgroundColor: colors.gold, marginBottom: spacing[3] },
  cardTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep, letterSpacing: letterSpacings.wide, marginBottom: spacing[5],
  },
  kpiRow: { display: 'flex', gap: spacing[4], flexWrap: 'wrap' as const, marginTop: spacing[2] },
  kpi: {
    display: 'flex', flexDirection: 'column' as const, gap: spacing[1],
    borderTop: '3px solid', padding: `${spacing[3]} ${spacing[4]}`,
    backgroundColor: colors.offWhite, minWidth: '140px',
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
  hint: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid,
    fontWeight: fontWeights.light, lineHeight: 1.6, marginBottom: spacing[4],
  },
  presets: { display: 'flex', flexWrap: 'wrap' as const, gap: spacing[2] },
  tagInactive: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.regular,
    padding: `${spacing[1]} ${spacing[3]}`, cursor: 'pointer', transition: transitions.fast,
    backgroundColor: colors.offWhite, color: colors.textMid,
    border: `1px solid ${colors.border}`, borderRadius: '999px',
    lineHeight: 1.5,
  } as React.CSSProperties,
  tagActive: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
    padding: `${spacing[1]} ${spacing[3]}`, cursor: 'pointer', transition: transitions.fast,
    backgroundColor: colors.bluePale, color: colors.blueDeep,
    border: `1px solid ${colors.blueLight}`, borderRadius: '999px',
    lineHeight: 1.5,
  } as React.CSSProperties,
  customRow: { display: 'flex', gap: spacing[3], marginTop: spacing[4], alignItems: 'center' },
  addBtn: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide, padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: 'transparent', color: colors.blueDeep,
    border: `1px solid ${colors.blueLight}`, cursor: 'pointer',
    transition: transitions.fast, whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  emptyHint: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight,
    fontStyle: 'italic', marginTop: spacing[3],
  },
}
