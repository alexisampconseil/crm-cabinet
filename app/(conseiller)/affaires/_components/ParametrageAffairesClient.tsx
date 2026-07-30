'use client'

import { useCallback, useEffect, useState } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, cardBase, inputBase, buttonOutline, buttonGold, statusBadge } from '@/lib/design-tokens'
import { api, StateMsg } from './lib'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any
const TABS = ['Familles', 'Types', 'Partenaires', 'Motifs', 'Frises']
const PART_TYPES = ['assureur', 'plateforme', 'courtier', 'banque', 'societe_gestion', 'autre']
const CHAMP_TYPES = ['texte', 'nombre', 'montant', 'booleen', 'date', 'enum']

export default function ParametrageAffairesClient() {
  const [cfg, setCfg] = useState<Any>(null)
  const [tab, setTab] = useState('Familles')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setCfg(await api<Any>('/api/affaires/parametrage')) } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setError(null); setMsg(null)
    try { await fn(); await load(); setMsg('Enregistré ✓') } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  if (error && !cfg) return <StateMsg kind="error">{error}</StateMsg>
  if (!cfg) return <StateMsg kind="loading">Chargement…</StateMsg>
  if (!cfg.peut_parametrer) return <StateMsg kind="error">Paramétrage réservé aux conseillers autorisés (permission peut_parametrer_affaires).</StateMsg>

  const post = (url: string, body: Any) => api(url, { method: 'POST', body: JSON.stringify(body) })
  const patch = (url: string, body: Any) => api(url, { method: 'PATCH', body: JSON.stringify(body) })

  return (
    <div>
      <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[5], flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>{t}</button>)}
      </div>
      {error && <StateMsg kind="error">{error}</StateMsg>}
      {msg && <StateMsg kind="success">{msg}</StateMsg>}

      {tab === 'Familles' && (
        <SimpleCrud rows={cfg.familles} cols={['code', 'libelle', 'ordre', 'actif']}
          onAdd={(v) => run(() => post('/api/affaires/parametrage/familles', v))}
          onToggle={(row) => run(() => patch(`/api/affaires/parametrage/familles/${row.id}`, { actif: !row.actif }))}
          fields={[{ k: 'code' }, { k: 'libelle' }, { k: 'ordre', type: 'number' }]} />
      )}
      {tab === 'Types' && (
        <TypesCrud familles={cfg.familles} rows={cfg.types} run={run} post={post} patch={patch} />
      )}
      {tab === 'Partenaires' && (
        <SimpleCrud rows={cfg.partenaires} cols={['nom', 'type_partenaire', 'actif']}
          onAdd={(v) => run(() => post('/api/affaires/parametrage/partenaires', v))}
          onToggle={(row) => run(() => patch(`/api/affaires/parametrage/partenaires/${row.id}`, { actif: !row.actif }))}
          fields={[{ k: 'nom' }, { k: 'type_partenaire', type: 'select', options: PART_TYPES }]} />
      )}
      {tab === 'Motifs' && (
        <SimpleCrud rows={cfg.motifs} cols={['code', 'libelle', 'ordre', 'necessite_commentaire', 'actif']}
          onAdd={(v) => run(() => post('/api/affaires/parametrage/motifs', v))}
          onToggle={(row) => run(() => patch(`/api/affaires/parametrage/motifs/${row.id}`, { actif: !row.actif }))}
          fields={[{ k: 'code' }, { k: 'libelle' }, { k: 'ordre', type: 'number' }, { k: 'necessite_commentaire', type: 'bool' }]} />
      )}
      {tab === 'Frises' && <FrisesPanel cfg={cfg} run={run} post={post} />}
    </div>
  )
}

/* ── CRUD générique ────────────────────────────────────────────────────────── */
function SimpleCrud({ rows, cols, fields, onAdd, onToggle }: { rows: Any[]; cols: string[]; fields: { k: string; type?: string; options?: string[] }[]; onAdd: (v: Any) => void; onToggle: (row: Any) => void }) {
  const [form, setForm] = useState<Any>({})
  const submit = () => { onAdd(form); setForm({}) }
  return (
    <div style={{ ...cardBase, padding: spacing[4] }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: spacing[4] }}>
        <thead><tr>{cols.map((c) => <th key={c} style={th}>{c}</th>)}<th style={th}></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {cols.map((c) => <td key={c} style={td}>{typeof r[c] === 'boolean' ? (r[c] ? '✓' : '—') : String(r[c] ?? '—')}</td>)}
              <td style={td}><button style={miniBtn} onClick={() => onToggle(r)}>{r.actif ? 'Désactiver' : 'Activer'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap', alignItems: 'center' }}>
        {fields.map((f) => f.type === 'select' ? (
          <select key={f.k} style={{ ...inputBase, width: 'auto' }} value={form[f.k] ?? ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}>
            <option value="">{f.k}</option>{f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.type === 'bool' ? (
          <label key={f.k} style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={!!form[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.checked })} />{f.k}
          </label>
        ) : (
          <input key={f.k} style={{ ...inputBase, width: 140 }} type={f.type ?? 'text'} placeholder={f.k} value={form[f.k] ?? ''}
            onChange={(e) => setForm({ ...form, [f.k]: f.type === 'number' ? Number(e.target.value) : e.target.value })} />
        ))}
        <button style={{ ...buttonGold, fontSize: fontSizes.xs, padding: '8px 16px' }} onClick={submit}>Ajouter</button>
      </div>
    </div>
  )
}

function TypesCrud({ familles, rows, run, post, patch }: { familles: Any[]; rows: Any[]; run: (fn: () => Promise<unknown>) => void; post: (u: string, b: Any) => Promise<unknown>; patch: (u: string, b: Any) => Promise<unknown> }) {
  const [form, setForm] = useState<Any>({})
  const nom = (id: string) => familles.find((f) => f.id === id)?.libelle ?? id
  return (
    <div style={{ ...cardBase, padding: spacing[4] }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: spacing[4] }}>
        <thead><tr>{['famille', 'code', 'libelle', 'actif'].map((c) => <th key={c} style={th}>{c}</th>)}<th style={th}></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td style={td}>{nom(r.famille_id)}</td><td style={td}>{r.code}</td><td style={td}>{r.libelle}</td><td style={td}>{r.actif ? '✓' : '—'}</td>
            <td style={td}><button style={miniBtn} onClick={() => run(() => patch(`/api/affaires/parametrage/types/${r.id}`, { actif: !r.actif }))}>{r.actif ? 'Désactiver' : 'Activer'}</button></td></tr>
        ))}</tbody>
      </table>
      <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap' }}>
        <select style={{ ...inputBase, width: 'auto' }} value={form.famille_id ?? ''} onChange={(e) => setForm({ ...form, famille_id: e.target.value })}>
          <option value="">Famille</option>{familles.map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
        </select>
        <input style={{ ...inputBase, width: 120 }} placeholder="code" value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input style={{ ...inputBase, width: 180 }} placeholder="libellé" value={form.libelle ?? ''} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
        <button style={{ ...buttonGold, fontSize: fontSizes.xs, padding: '8px 16px' }} onClick={() => { run(() => post('/api/affaires/parametrage/types', form)); setForm({}) }}>Ajouter</button>
      </div>
    </div>
  )
}

/* ── Frises ────────────────────────────────────────────────────────────────── */
function FrisesPanel({ cfg, run, post }: { cfg: Any; run: (fn: () => Promise<unknown>) => void; post: (u: string, b: Any) => Promise<unknown> }) {
  const [nf, setNf] = useState<Any>({})
  const [editing, setEditing] = useState<string | null>(null)
  const nom = (id: string) => cfg.familles.find((f: Any) => f.id === id)?.libelle ?? id

  return (
    <div>
      <div style={{ ...cardBase, padding: spacing[4], marginBottom: spacing[4] }}>
        <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...inputBase, width: 'auto' }} value={nf.famille_id ?? ''} onChange={(e) => setNf({ ...nf, famille_id: e.target.value })}>
            <option value="">Famille</option>{cfg.familles.map((f: Any) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
          </select>
          <input style={{ ...inputBase, width: 120 }} placeholder="version (ex 1.0)" value={nf.version ?? ''} onChange={(e) => setNf({ ...nf, version: e.target.value })} />
          <button style={{ ...buttonGold, fontSize: fontSizes.xs, padding: '8px 16px' }} onClick={() => { run(() => post('/api/affaires/parametrage/frises', nf)); setNf({}) }}>Nouveau brouillon</button>
        </div>
      </div>
      <div style={{ ...cardBase, padding: spacing[4] }}>
        {cfg.frises.length === 0 && <StateMsg kind="empty">Aucune version.</StateMsg>}
        {cfg.frises.map((v: Any) => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}` }}>
            <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm }}>
              {nom(v.famille_id)} · v{v.version} · <span style={v.statut === 'publie' ? statusBadge.success : v.statut === 'archive' ? statusBadge.neutral : statusBadge.info}>{v.statut}</span> {v.actif ? '· actif' : ''}
            </span>
            <div style={{ display: 'flex', gap: spacing[2] }}>
              {v.statut === 'brouillon' && <button style={miniBtn} onClick={() => setEditing(editing === v.id ? null : v.id)}>{editing === v.id ? 'Fermer' : 'Éditer'}</button>}
              {v.statut === 'brouillon' && <button style={miniBtn} onClick={() => run(() => post(`/api/affaires/parametrage/frises/${v.id}/publier`, {}))}>Publier</button>}
              {v.statut !== 'archive' && <button style={miniBtn} onClick={() => run(() => post(`/api/affaires/parametrage/frises/${v.id}/archiver`, {}))}>Archiver</button>}
            </div>
          </div>
        ))}
        {editing && <FriseEditor versionId={editing} run={run} />}
      </div>
    </div>
  )
}

function FriseEditor({ versionId, run }: { versionId: string; run: (fn: () => Promise<unknown>) => void }) {
  const [detail, setDetail] = useState<Any>(null)
  const [et, setEt] = useState<Any>({}); const [champ, setChamp] = useState<Any>({ portee: 'famille', type_donnee: 'texte' })
  const load = useCallback(async () => { setDetail(await api<Any>(`/api/affaires/parametrage/frises/${versionId}`)) }, [versionId])
  useEffect(() => { load() }, [load])
  const el = (kind: string, values: Any) => run(async () => { await api(`/api/affaires/parametrage/frises/${versionId}/elements`, { method: 'POST', body: JSON.stringify({ kind, values }) }); await load() })
  const del = (kind: string, id: string) => run(async () => { await api(`/api/affaires/parametrage/frises/${versionId}/elements/${kind}/${id}`, { method: 'DELETE' }); await load() })
  if (!detail) return <StateMsg kind="loading">Chargement…</StateMsg>

  return (
    <div style={{ marginTop: spacing[4], padding: spacing[3], backgroundColor: colors.offWhite, borderRadius: radii.sm }}>
      <b style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blueDeep }}>Étapes</b>
      {(detail.etapes as Any[]).map((e) => (
        <div key={e.id} style={{ padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm }}>{e.ordre}. {e.libelle} ({e.code})</span>
            <button style={miniBtn} onClick={() => del('etape', e.id)}>Suppr.</button>
          </div>
          <ChildAdder etapeId={e.id} onAdd={(kind, v) => el(kind, { ...v, etape_modele_id: e.id })} />
          {[['tache', detail.taches], ['document', detail.documents], ['controle', detail.controles]].map(([kind, list]: Any) => (
            (list as Any[]).filter((x) => x.etape_modele_id === e.id).map((x) => (
              <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: spacing[4], fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.textMid }}>
                <span>{kind}: {x.libelle} ({x.code}){x.obligatoire ? ' *' : ''}</span>
                <button style={miniBtn} onClick={() => del(kind, x.id)}>×</button>
              </div>
            ))
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: spacing[2], marginTop: spacing[2], flexWrap: 'wrap' }}>
        <input style={{ ...inputBase, width: 90 }} placeholder="code" value={et.code ?? ''} onChange={(e) => setEt({ ...et, code: e.target.value })} />
        <input style={{ ...inputBase, width: 160 }} placeholder="libellé étape" value={et.libelle ?? ''} onChange={(e) => setEt({ ...et, libelle: e.target.value })} />
        <input style={{ ...inputBase, width: 70 }} type="number" placeholder="ordre" value={et.ordre ?? ''} onChange={(e) => setEt({ ...et, ordre: Number(e.target.value) })} />
        <button style={{ ...buttonOutline, fontSize: fontSizes.xs, padding: '6px 12px' }} onClick={() => { el('etape', et); setEt({}) }}>+ Étape</button>
      </div>

      <b style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blueDeep, display: 'block', marginTop: spacing[4] }}>Champs dynamiques</b>
      {(detail.champs as Any[]).map((c) => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, padding: '2px 0' }}>
          <span>{c.portee}/{c.code} · {c.type_donnee}{c.obligatoire ? ' *' : ''}</span>
          <button style={miniBtn} onClick={() => del('champ', c.id)}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: spacing[2], marginTop: spacing[2], flexWrap: 'wrap' }}>
        <select style={{ ...inputBase, width: 'auto' }} value={champ.portee} onChange={(e) => setChamp({ ...champ, portee: e.target.value })}><option value="famille">famille</option><option value="type">type</option></select>
        {champ.portee === 'type' && <input style={{ ...inputBase, width: 130 }} placeholder="type_id" value={champ.type_id ?? ''} onChange={(e) => setChamp({ ...champ, type_id: e.target.value })} />}
        <input style={{ ...inputBase, width: 90 }} placeholder="code" value={champ.code ?? ''} onChange={(e) => setChamp({ ...champ, code: e.target.value })} />
        <input style={{ ...inputBase, width: 130 }} placeholder="libellé" value={champ.libelle ?? ''} onChange={(e) => setChamp({ ...champ, libelle: e.target.value })} />
        <select style={{ ...inputBase, width: 'auto' }} value={champ.type_donnee} onChange={(e) => setChamp({ ...champ, type_donnee: e.target.value })}>{CHAMP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <button style={{ ...buttonOutline, fontSize: fontSizes.xs, padding: '6px 12px' }} onClick={() => { el('champ', champ); setChamp({ portee: 'famille', type_donnee: 'texte' }) }}>+ Champ</button>
      </div>
    </div>
  )
}

function ChildAdder({ etapeId, onAdd }: { etapeId: string; onAdd: (kind: string, v: Any) => void }) {
  const [kind, setKind] = useState('tache'); const [v, setV] = useState<Any>({})
  return (
    <div style={{ display: 'flex', gap: 6, paddingLeft: spacing[4], marginTop: 4, flexWrap: 'wrap' }}>
      <select style={{ ...inputBase, width: 'auto', fontSize: fontSizes.xs }} value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="tache">tâche</option><option value="document">document</option><option value="controle">contrôle</option>
      </select>
      <input style={{ ...inputBase, width: 80, fontSize: fontSizes.xs }} placeholder="code" value={v.code ?? ''} onChange={(e) => setV({ ...v, code: e.target.value })} />
      <input style={{ ...inputBase, width: 120, fontSize: fontSizes.xs }} placeholder="libellé" value={v.libelle ?? ''} onChange={(e) => setV({ ...v, libelle: e.target.value })} />
      <label style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, display: 'flex', gap: 3, alignItems: 'center' }}><input type="checkbox" checked={!!v.obligatoire} onChange={(e) => setV({ ...v, obligatoire: e.target.checked })} />oblig.</label>
      <button style={miniBtn} onClick={() => { onAdd(kind, v); setV({}) }}>+</button>
    </div>
  )
}

const tabBtn: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textMid, padding: '8px 16px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: '6px', cursor: 'pointer' }
const tabActive: React.CSSProperties = { color: colors.white, backgroundColor: colors.blueDeep, borderColor: colors.blueDeep }
const th: React.CSSProperties = { fontFamily: fonts.body, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textLight, textAlign: 'left', padding: `${spacing[2]} ${spacing[3]}`, borderBottom: `1px solid ${colors.border}` }
const td: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text, padding: `${spacing[2]} ${spacing[3]}`, borderBottom: `1px solid ${colors.border}` }
const miniBtn: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSizes.xs, padding: '4px 10px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: radii.sm, cursor: 'pointer', color: colors.textMid }
