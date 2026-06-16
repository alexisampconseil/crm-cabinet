'use client'

import { useClient } from '@/lib/ClientContext'
import type { Objectif } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, inputBase, labelBase,
  buttonGhost, transitions,
} from '@/lib/design-tokens'

const EMPTY_OBJECTIF = (): Objectif => ({
  id: `new-${Date.now()}`,
  client_id: '',
  libelle: '',
  horizon: null,
  profil_risque: null,
  besoin_liquidites: null,
  montant_cible: null,
  priorite: 1,
  collecte_session_id: null,
  created_at: new Date().toISOString(),
})

const PROFIL_LABELS: Record<string, string> = {
  prudent: '🟢 Prudent',
  equilibre: '🟡 Équilibré',
  dynamique: '🟠 Dynamique',
  agressif: '🔴 Agressif',
}

const HORIZON_LABELS: Record<string, string> = {
  court_terme: 'Court terme (< 3 ans)',
  moyen_terme: 'Moyen terme (3–8 ans)',
  long_terme: 'Long terme (> 8 ans)',
  retraite: 'Horizon retraite',
}

const LIQUIDITES_LABELS: Record<string, string> = {
  faible: 'Faible',
  moyen: 'Moyen',
  fort: 'Fort',
  tres_fort: 'Très fort',
}

const PROFIL_COLORS: Record<string, string> = {
  prudent: colors.success,
  equilibre: colors.warning,
  dynamique: '#c47a1f',
  agressif: colors.danger,
}

export default function ObjectifsPage() {
  const { data, update } = useClient()
  const objectifs = data.objectifs

  const addObjectif = () => {
    const newObj = EMPTY_OBJECTIF()
    newObj.client_id = data.client.id
    newObj.priorite = objectifs.length + 1
    update('objectifs', [...objectifs, newObj])
  }

  const removeObjectif = (idx: number) => {
    update('objectifs', objectifs.filter((_, i) => i !== idx).map((o, i) => ({ ...o, priorite: i + 1 })))
  }

  const setObjectif = (idx: number, field: keyof Objectif) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const raw = e.target.value
    const val = field === 'montant_cible' ? (raw ? Number(raw) : null) :
                field === 'priorite' ? Number(raw) :
                raw || null
    update('objectifs', objectifs.map((o, i) => i === idx ? { ...o, [field]: val } : o))
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...objectifs]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    update('objectifs', next.map((o, i) => ({ ...o, priorite: i + 1 })))
  }

  const moveDown = (idx: number) => {
    if (idx === objectifs.length - 1) return
    const next = [...objectifs]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    update('objectifs', next.map((o, i) => ({ ...o, priorite: i + 1 })))
  }

  return (
    <div style={s.page}>
      {/* Intro */}
      <div style={s.intro}>
        <p style={s.introText}>
          Définissez les objectifs patrimoniaux du client par ordre de priorité.
          Ces informations alimentent le conseil et la sélection des produits adaptés.
        </p>
        <button onClick={addObjectif} style={{ ...buttonGhost, fontSize: fontSizes.sm, padding: `${spacing[2]} ${spacing[5]}` }}>
          + Ajouter un objectif
        </button>
      </div>

      {/* Liste d'objectifs */}
      {objectifs.length === 0 && (
        <div style={s.empty}>
          <p style={s.emptyText}>Aucun objectif renseigné.</p>
          <button onClick={addObjectif} style={{ ...buttonGhost, fontSize: fontSizes.sm, padding: `${spacing[2]} ${spacing[5]}` }}>
            Définir le premier objectif
          </button>
        </div>
      )}

      {objectifs.map((obj, idx) => (
        <div key={obj.id} style={s.objectifCard}>
          {/* En-tête */}
          <div style={s.objectifHeader}>
            <div style={s.priorityBadge}>{idx + 1}</div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={obj.libelle}
                onChange={setObjectif(idx, 'libelle')}
                placeholder="Libellé de l'objectif (ex: Préparer la retraite)"
                style={{ ...inputBase, fontWeight: fontWeights.medium, fontSize: fontSizes.md }}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
            {/* Actions priorité */}
            <div style={s.moveButtons}>
              <button onClick={() => moveUp(idx)} disabled={idx === 0} style={s.moveBtn} title="Monter">↑</button>
              <button onClick={() => moveDown(idx)} disabled={idx === objectifs.length - 1} style={s.moveBtn} title="Descendre">↓</button>
            </div>
            <button onClick={() => removeObjectif(idx)} style={s.deleteBtn} title="Supprimer cet objectif">✕</button>
          </div>

          {/* Champs détail */}
          <div style={s.grid3}>
            {/* Horizon */}
            <div style={s.field}>
              <label style={labelBase}>Horizon</label>
              <select style={{ ...inputBase, cursor: 'pointer' }} value={obj.horizon ?? ''} onChange={setObjectif(idx, 'horizon')}>
                <option value="">—</option>
                {Object.entries(HORIZON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Profil de risque */}
            <div style={s.field}>
              <label style={labelBase}>Profil de risque</label>
              <select style={{ ...inputBase, cursor: 'pointer' }} value={obj.profil_risque ?? ''} onChange={setObjectif(idx, 'profil_risque')}>
                <option value="">—</option>
                {Object.entries(PROFIL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Besoin de liquidités */}
            <div style={s.field}>
              <label style={labelBase}>Besoin de liquidités</label>
              <select style={{ ...inputBase, cursor: 'pointer' }} value={obj.besoin_liquidites ?? ''} onChange={setObjectif(idx, 'besoin_liquidites')}>
                <option value="">—</option>
                {Object.entries(LIQUIDITES_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Montant cible */}
            <div style={s.field}>
              <label style={labelBase}>Montant cible (€)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={obj.montant_cible ?? ''}
                onChange={setObjectif(idx, 'montant_cible')}
                placeholder="ex: 500000"
                style={inputBase}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
          </div>

          {/* Indicateurs visuels */}
          {(obj.horizon || obj.profil_risque || obj.besoin_liquidites) && (
            <div style={s.indicators}>
              {obj.horizon && <Chip color={colors.blue}>{HORIZON_LABELS[obj.horizon]}</Chip>}
              {obj.profil_risque && <Chip color={PROFIL_COLORS[obj.profil_risque]}>{obj.profil_risque.charAt(0).toUpperCase() + obj.profil_risque.slice(1)}</Chip>}
              {obj.besoin_liquidites && <Chip color={colors.textMid}>Liquidités : {LIQUIDITES_LABELS[obj.besoin_liquidites]}</Chip>}
              {obj.montant_cible && <Chip color={colors.gold}>Cible : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(obj.montant_cible)}</Chip>}
            </div>
          )}
        </div>
      ))}

      {objectifs.length > 0 && (
        <div style={{ textAlign: 'center' as const, paddingTop: spacing[2] }}>
          <button onClick={addObjectif} style={{ ...buttonGhost, fontSize: fontSizes.sm, padding: `${spacing[2]} ${spacing[5]}` }}>
            + Ajouter un objectif
          </button>
        </div>
      )}
    </div>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontFamily: fonts.body, fontSize: '0.65rem', fontWeight: fontWeights.bold,
      letterSpacing: '0.06em', padding: '3px 10px', borderRadius: '999px',
      backgroundColor: `${color}18`, color, border: `1px solid ${color}44`,
      display: 'inline-block',
    }}>{children}</span>
  )
}

const focusStyle = { borderColor: colors.blue, boxShadow: '0 0 0 3px rgba(99,129,168,0.12)' }

const s = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: spacing[4] },
  intro: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing[4], marginBottom: spacing[2],
  },
  introText: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid,
    fontWeight: fontWeights.light, lineHeight: 1.6, maxWidth: '560px',
  },
  empty: {
    ...cardBase,
    padding: spacing[10], textAlign: 'center' as const,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: spacing[4],
  },
  emptyText: {
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textLight, fontStyle: 'italic',
  },
  objectifCard: {
    ...cardBase,
    padding: spacing[5],
    boxShadow: shadows.sm,
  } as React.CSSProperties,
  objectifHeader: {
    display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[4],
  },
  priorityBadge: {
    width: '32px', height: '32px', borderRadius: '50%',
    backgroundColor: colors.blueDeep, color: colors.white,
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  moveButtons: { display: 'flex', gap: spacing[1] },
  moveBtn: {
    background: 'none', border: `1px solid ${colors.border}`, cursor: 'pointer',
    color: colors.textMid, padding: '4px 8px', fontFamily: fonts.body,
    fontSize: fontSizes.sm, transition: transitions.fast,
  } as React.CSSProperties,
  deleteBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: colors.danger,
    fontSize: fontSizes.sm, padding: '4px 8px', transition: transitions.fast,
    fontFamily: fonts.body,
  } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[4] },
  field: { display: 'flex', flexDirection: 'column' as const, gap: spacing[1] },
  indicators: { display: 'flex', gap: spacing[2], marginTop: spacing[4], flexWrap: 'wrap' as const },
}
