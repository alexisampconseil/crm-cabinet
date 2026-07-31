'use client'

import { useCallback, useEffect, useState } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, cardBase, inputBase, buttonOutline, buttonGold, statusBadge } from '@/lib/design-tokens'
import { api, dateFr, StateMsg } from './lib'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

// Trois sections seulement : les familles et les motifs sont des données système
// (lecture seule), gérées par le CRM et non éditables ici.
const TABS = ['Types', 'Partenaires', 'Frises']
const PART_TYPES = ['assureur', 'plateforme', 'courtier', 'banque', 'societe_gestion', 'autre']
const INFO_TYPES = [
  { value: 'texte', label: 'Texte' }, { value: 'nombre', label: 'Nombre' }, { value: 'montant', label: 'Montant' },
  { value: 'booleen', label: 'Oui / Non' }, { value: 'date', label: 'Date' }, { value: 'enum', label: 'Choix' },
]
const ELEMENT_BLOCS: { kind: 'tache' | 'document' | 'controle'; title: string; placeholder: string }[] = [
  { kind: 'tache', title: 'Actions à réaliser', placeholder: 'Ex : Recueillir la signature' },
  { kind: 'document', title: 'Documents à obtenir', placeholder: 'Ex : Pièce d’identité' },
  { kind: 'controle', title: 'Contrôles à valider', placeholder: 'Ex : Conformité LCB-FT' },
]

export default function ParametrageAffairesClient() {
  const [cfg, setCfg] = useState<Any>(null)
  const [tab, setTab] = useState('Types')
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

  const post = (url: string, body: Any) => api<Any>(url, { method: 'POST', body: JSON.stringify(body) })
  const patch = (url: string, body: Any) => api<Any>(url, { method: 'PATCH', body: JSON.stringify(body) })

  return (
    <div>
      <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[5], flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>{t}</button>)}
      </div>
      {error && <StateMsg kind="error">{error}</StateMsg>}
      {msg && <StateMsg kind="success">{msg}</StateMsg>}

      {tab === 'Types' && <TypesPanel familles={cfg.familles} rows={cfg.types} reload={load} post={post} patch={patch} run={run} />}
      {tab === 'Partenaires' && (
        <SimpleCrud rows={cfg.partenaires} cols={['nom', 'type_partenaire', 'actif']}
          onAdd={(v) => run(() => post('/api/affaires/parametrage/partenaires', v))}
          onToggle={(row) => run(() => patch(`/api/affaires/parametrage/partenaires/${row.id}`, { actif: !row.actif }))}
          fields={[{ k: 'nom' }, { k: 'type_partenaire', type: 'select', options: PART_TYPES }]} />
      )}
      {tab === 'Frises' && <FrisesPanel cfg={cfg} reload={load} post={post} run={run} />}
    </div>
  )
}

/* ── Types d'affaires (famille + libellé, code auto) ───────────────────────── */
function TypesPanel({ familles, rows, reload, post, patch, run }: { familles: Any[]; rows: Any[]; reload: () => Promise<void>; post: (u: string, b: Any) => Promise<Any>; patch: (u: string, b: Any) => Promise<Any>; run: (fn: () => Promise<unknown>) => void }) {
  const [familleId, setFamilleId] = useState('')
  const [libelle, setLibelle] = useState('')
  const [busy, setBusy] = useState(false)
  const [fieldErr, setFieldErr] = useState<{ field: string; msg: string } | null>(null)
  const nom = (id: string) => familles.find((f) => f.id === id)?.libelle ?? id

  const add = async () => {
    setFieldErr(null); setBusy(true)
    try {
      await post('/api/affaires/parametrage/types', { famille_id: familleId, libelle })
      setLibelle(''); await reload()
    } catch (e: Any) {
      // Messages précis près du champ concerné.
      const message = e instanceof Error ? e.message : 'Erreur'
      const field = !familleId ? 'famille_id' : 'libelle'
      setFieldErr({ field, msg: message })
    } finally { setBusy(false) }
  }

  return (
    <div style={{ ...cardBase, padding: spacing[4] }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: spacing[4] }}>
        <thead><tr>{['Famille', 'Type', 'Statut'].map((c) => <th key={c} style={th}>{c}</th>)}<th style={th}></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td style={td}>{nom(r.famille_id)}</td>
            <td style={td}>{r.libelle}</td>
            <td style={td}>{r.actif ? <span style={statusBadge.success}>Actif</span> : <span style={statusBadge.neutral}>Inactif</span>}</td>
            <td style={td}><button style={miniBtn} onClick={() => run(() => patch(`/api/affaires/parametrage/types/${r.id}`, { actif: !r.actif }))}>{r.actif ? 'Désactiver' : 'Activer'}</button></td>
          </tr>
        ))}</tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(200px, 2fr) auto', gap: spacing[3], alignItems: 'start' }}>
        <div>
          <select style={{ ...inputBase, ...(fieldErr?.field === 'famille_id' ? errBorder : {}) }} value={familleId} onChange={(e) => { setFamilleId(e.target.value); setFieldErr(null) }}>
            <option value="">Famille…</option>{familles.filter((f) => f.actif).map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
          </select>
          {fieldErr?.field === 'famille_id' && <FieldError>{fieldErr.msg}</FieldError>}
        </div>
        <div>
          <input style={{ ...inputBase, ...(fieldErr?.field === 'libelle' ? errBorder : {}) }} placeholder="Libellé (ex : Assurance vie)"
            value={libelle} onChange={(e) => { setLibelle(e.target.value); setFieldErr(null) }} onKeyDown={(e) => e.key === 'Enter' && add()} />
          {fieldErr?.field === 'libelle' && <FieldError>{fieldErr.msg}</FieldError>}
        </div>
        <button style={{ ...buttonGold, fontSize: fontSizes.xs, padding: '9px 16px', opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={add}>Ajouter</button>
      </div>
      <p style={hint}>Le code technique et l’ordre sont générés automatiquement.</p>
    </div>
  )
}

/* ── CRUD générique (partenaires) ──────────────────────────────────────────── */
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
        ) : (
          <input key={f.k} style={{ ...inputBase, width: 180 }} placeholder={f.k} value={form[f.k] ?? ''}
            onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
        ))}
        <button style={{ ...buttonGold, fontSize: fontSizes.xs, padding: '8px 16px' }} onClick={submit}>Ajouter</button>
      </div>
    </div>
  )
}

/* ── Frises : versionnement simplifié ──────────────────────────────────────── */
function FrisesPanel({ cfg, reload, post, run }: { cfg: Any; reload: () => Promise<void>; post: (u: string, b: Any) => Promise<Any>; run: (fn: () => Promise<unknown>) => void }) {
  const [sel, setSel] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const nomFamille = (id: string) => cfg.familles.find((f: Any) => f.id === id)?.libelle ?? id

  const frises = cfg.frises as Any[]
  const famBrouillon = frises.find((f) => f.famille_id === sel && f.statut === 'brouillon')
  const famPublie = frises.find((f) => f.famille_id === sel && f.statut === 'publie')
  const createLabel = famBrouillon ? 'Brouillon déjà existant' : famPublie ? 'Créer une nouvelle version' : 'Créer la frise'

  const createFrise = async () => {
    setErr(null); setBusy(true)
    try { const row = await post('/api/affaires/parametrage/frises', { famille_id: sel }); await reload(); setEditing(row.id) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erreur') }
    finally { setBusy(false) }
  }

  const byFamille = new Map<string, Any[]>()
  for (const v of frises) { const arr = byFamille.get(v.famille_id) ?? []; arr.push(v); byFamille.set(v.famille_id, arr) }

  const statutLabel = (v: Any) => v.statut === 'publie' ? <span style={statusBadge.success}>Frise publiée</span>
    : v.statut === 'brouillon' ? <span style={statusBadge.info}>Brouillon en cours</span>
    : <span style={statusBadge.neutral}>Archivée</span>

  return (
    <div>
      {/* Création / nouvelle version */}
      <div style={{ ...cardBase, padding: spacing[4], marginBottom: spacing[4] }}>
        <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...inputBase, width: 'auto' }} value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Choisir une famille…</option>{cfg.familles.filter((f: Any) => f.actif).map((f: Any) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
          </select>
          <button style={{ ...buttonGold, fontSize: fontSizes.xs, padding: '9px 16px', opacity: (!sel || !!famBrouillon || busy) ? 0.5 : 1 }}
            disabled={!sel || !!famBrouillon || busy} onClick={createFrise}>{createLabel}</button>
        </div>
        {sel && famPublie && !famBrouillon && <p style={hint}>La nouvelle version reprendra la structure de la frise publiée. Une version publiée reste non modifiable.</p>}
        {sel && famBrouillon && <p style={hint}>Un brouillon existe déjà pour cette famille : modifiez-le puis publiez-le.</p>}
        {err && <StateMsg kind="error">{err}</StateMsg>}
      </div>

      {/* Versions par famille */}
      {byFamille.size === 0 && <StateMsg kind="empty">Aucune frise pour l’instant.</StateMsg>}
      {[...byFamille.entries()].map(([fid, versions]) => (
        <div key={fid} style={{ ...cardBase, padding: spacing[4], marginBottom: spacing[3] }}>
          <h4 style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep, marginBottom: spacing[3] }}>{nomFamille(fid)}</h4>
          {versions.map((v) => (
            <div key={v.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3], padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}`, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, display: 'flex', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
                  {statutLabel(v)}
                  {v.publie_le && <span style={{ color: colors.textMid }}>publiée le {dateFr(v.publie_le)}</span>}
                  <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>v{v.version}</span>
                </span>
                <div style={{ display: 'flex', gap: spacing[2] }}>
                  {v.statut === 'brouillon' && <button style={miniBtn} onClick={() => setEditing(editing === v.id ? null : v.id)}>{editing === v.id ? 'Fermer' : 'Modifier'}</button>}
                  {v.statut === 'brouillon' && <button style={miniBtn} onClick={() => run(() => post(`/api/affaires/parametrage/frises/${v.id}/publier`, {}))}>Publier</button>}
                  {v.statut !== 'archive' && <button style={miniBtn} onClick={() => run(() => post(`/api/affaires/parametrage/frises/${v.id}/archiver`, {}))}>Archiver</button>}
                </div>
              </div>
              {editing === v.id && <FriseEditor versionId={v.id} familleId={fid} types={cfg.types} onDone={reload} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── Éditeur de frise (brouillon) ──────────────────────────────────────────── */
function FriseEditor({ versionId, familleId, types, onDone }: { versionId: string; familleId: string; types: Any[]; onDone: () => Promise<void> }) {
  const [detail, setDetail] = useState<Any>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [newEtape, setNewEtape] = useState('')
  const [showInfos, setShowInfos] = useState(false)

  const base = `/api/affaires/parametrage/frises/${versionId}`
  const load = useCallback(async () => { setDetail(await api<Any>(base)) }, [base])
  useEffect(() => { load() }, [load])

  const mut = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null)
    try { await fn(); await load(); await onDone() } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur') }
    finally { setBusy(false) }
  }
  const addEl = (kind: string, values: Any) => mut(() => api(`${base}/elements`, { method: 'POST', body: JSON.stringify({ kind, values }) }))
  const delEl = (kind: string, id: string) => mut(() => api(`${base}/elements/${kind}/${id}`, { method: 'DELETE' }))
  const patchEl = (kind: string, id: string, values: Any) => api(`${base}/elements/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(values) })

  if (!detail) return <StateMsg kind="loading">Chargement…</StateMsg>
  const etapes = (detail.etapes as Any[])
  const famTypes = types.filter((t) => t.famille_id === familleId && t.actif)

  // Réorganisation : échange l'ordre de deux étapes via un ordre temporaire libre
  // (contrainte d'unicité de l'ordre par version).
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= etapes.length) return
    const a = etapes[i], b = etapes[j]
    const tmp = Math.max(...etapes.map((e) => e.ordre)) + 1
    mut(async () => {
      await patchEl('etape', a.id, { ordre: tmp })
      await patchEl('etape', b.id, { ordre: a.ordre })
      await patchEl('etape', a.id, { ordre: b.ordre })
    })
  }

  return (
    <div style={{ marginTop: spacing[3], padding: spacing[4], backgroundColor: colors.offWhite, borderRadius: radii.sm }}>
      {err && <StateMsg kind="error">{err}</StateMsg>}

      {/* Étapes */}
      {etapes.length === 0 && <StateMsg kind="empty">Aucune étape. Ajoutez la première ci-dessous.</StateMsg>}
      {etapes.map((e, i) => (
        <EtapeCard key={e.id} etape={e} index={i} total={etapes.length} busy={busy}
          taches={(detail.taches as Any[]).filter((x) => x.etape_modele_id === e.id)}
          documents={(detail.documents as Any[]).filter((x) => x.etape_modele_id === e.id)}
          controles={(detail.controles as Any[]).filter((x) => x.etape_modele_id === e.id)}
          onMove={(dir) => moveStep(i, dir)}
          onDelete={() => delEl('etape', e.id)}
          onAddChild={(kind, values) => addEl(kind, { ...values, etape_modele_id: e.id })}
          onDelChild={(kind, id) => delEl(kind, id)} />
      ))}

      <div style={{ display: 'flex', gap: spacing[2], marginTop: spacing[3], flexWrap: 'wrap' }}>
        <input style={{ ...inputBase, flex: '1 1 220px' }} placeholder="Libellé de l’étape (ex : Document d’entrée en relation)"
          value={newEtape} onChange={(e) => setNewEtape(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newEtape.trim()) { addEl('etape', { libelle: newEtape }); setNewEtape('') } }} />
        <button style={{ ...buttonGold, fontSize: fontSizes.xs, padding: '8px 16px', opacity: (!newEtape.trim() || busy) ? 0.5 : 1 }}
          disabled={!newEtape.trim() || busy} onClick={() => { addEl('etape', { libelle: newEtape }); setNewEtape('') }}>+ Ajouter l’étape</button>
      </div>

      {/* Informations à renseigner (panneau facultatif replié) */}
      <div style={{ marginTop: spacing[5] }}>
        <button onClick={() => setShowInfos(!showInfos)} style={{ ...buttonOutline, fontSize: fontSizes.xs, padding: '6px 14px', cursor: 'pointer' }}>
          {showInfos ? '▾' : '▸'} Informations à renseigner{(detail.champs as Any[]).length > 0 ? ` (${(detail.champs as Any[]).length})` : ''}
        </button>
        {showInfos && (
          <div style={{ marginTop: spacing[3] }}>
            {(detail.champs as Any[]).map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, padding: '4px 0', borderBottom: `1px solid ${colors.border}` }}>
                <span>{c.libelle} · {INFO_TYPES.find((t) => t.value === c.type_donnee)?.label ?? c.type_donnee}{c.obligatoire ? ' *' : ''}{c.portee === 'type' ? ' · (type)' : ''}</span>
                <button style={miniBtn} onClick={() => delEl('champ', c.id)}>×</button>
              </div>
            ))}
            <ChampAdder famTypes={famTypes} busy={busy} onAdd={(values) => addEl('champ', values)} />
          </div>
        )}
      </div>
    </div>
  )
}

function EtapeCard({ etape, index, total, busy, taches, documents, controles, onMove, onDelete, onAddChild, onDelChild }: {
  etape: Any; index: number; total: number; busy: boolean; taches: Any[]; documents: Any[]; controles: Any[]
  onMove: (dir: -1 | 1) => void; onDelete: () => void
  onAddChild: (kind: string, values: Any) => void; onDelChild: (kind: string, id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const listOf = (kind: string) => kind === 'tache' ? taches : kind === 'document' ? documents : controles
  return (
    <div style={{ ...cardBase, padding: spacing[3], marginBottom: spacing[2] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] }}>
        <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.blueDeep }}>{etape.ordre}. {etape.libelle}</span>
        <div style={{ display: 'flex', gap: spacing[1] }}>
          <button style={miniBtn} disabled={busy || index === 0} onClick={() => onMove(-1)} title="Monter">↑</button>
          <button style={miniBtn} disabled={busy || index === total - 1} onClick={() => onMove(1)} title="Descendre">↓</button>
          <button style={miniBtn} onClick={() => setOpen(!open)}>{open ? 'Fermer' : 'Contenu'}</button>
          <button style={miniBtn} disabled={busy} onClick={onDelete}>Suppr.</button>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: spacing[3], paddingLeft: spacing[3], borderLeft: `2px solid ${colors.border}` }}>
          {ELEMENT_BLOCS.map((b) => (
            <div key={b.kind} style={{ marginBottom: spacing[3] }}>
              <div style={{ fontFamily: fonts.body, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.gold, fontWeight: fontWeights.bold, marginBottom: 4 }}>{b.title}</div>
              {listOf(b.kind).map((x) => (
                <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text, padding: '2px 0' }}>
                  <span>{x.libelle}{x.obligatoire ? ' *' : ''}</span>
                  <button style={miniBtn} onClick={() => onDelChild(b.kind, x.id)}>×</button>
                </div>
              ))}
              <ChildAdder placeholder={b.placeholder} busy={busy} onAdd={(v) => onAddChild(b.kind, v)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChildAdder({ placeholder, busy, onAdd }: { placeholder: string; busy: boolean; onAdd: (v: Any) => void }) {
  const [libelle, setLibelle] = useState('')
  const [obligatoire, setObligatoire] = useState(true)
  const submit = () => { if (!libelle.trim()) return; onAdd({ libelle, obligatoire }); setLibelle('') }
  return (
    <div style={{ display: 'flex', gap: spacing[2], marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input style={{ ...inputBase, flex: '1 1 200px', fontSize: fontSizes.xs }} placeholder={placeholder} value={libelle}
        onChange={(e) => setLibelle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <label style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, display: 'flex', gap: 4, alignItems: 'center', color: colors.textMid }}>
        <input type="checkbox" checked={obligatoire} onChange={(e) => setObligatoire(e.target.checked)} />obligatoire
      </label>
      <button style={{ ...miniBtn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={submit}>+</button>
    </div>
  )
}

function ChampAdder({ famTypes, busy, onAdd }: { famTypes: Any[]; busy: boolean; onAdd: (v: Any) => void }) {
  const [libelle, setLibelle] = useState('')
  const [type, setType] = useState('texte')
  const [obligatoire, setObligatoire] = useState(false)
  const [limiter, setLimiter] = useState(false)
  const [typeId, setTypeId] = useState('')
  const submit = () => {
    if (!libelle.trim()) return
    const values: Any = { libelle, type_donnee: type, obligatoire, portee: limiter ? 'type' : 'famille' }
    if (limiter) values.type_id = typeId
    onAdd(values)
    setLibelle(''); setLimiter(false); setTypeId('')
  }
  return (
    <div style={{ display: 'flex', gap: spacing[2], marginTop: spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
      <input style={{ ...inputBase, flex: '1 1 180px' }} placeholder="Libellé de l’information" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <select style={{ ...inputBase, width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
        {INFO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <label style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, display: 'flex', gap: 4, alignItems: 'center', color: colors.textMid }}>
        <input type="checkbox" checked={obligatoire} onChange={(e) => setObligatoire(e.target.checked)} />obligatoire
      </label>
      <label style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, display: 'flex', gap: 4, alignItems: 'center', color: colors.textMid }}>
        <input type="checkbox" checked={limiter} onChange={(e) => setLimiter(e.target.checked)} disabled={famTypes.length === 0} />Limiter à un type
      </label>
      {limiter && (
        <select style={{ ...inputBase, width: 'auto' }} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Type…</option>{famTypes.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
        </select>
      )}
      <button style={{ ...buttonOutline, fontSize: fontSizes.xs, padding: '6px 12px', opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={submit}>+ Information</button>
    </div>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: 4 }}>{children}</p>
}

const tabBtn: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textMid, padding: '8px 16px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: '6px', cursor: 'pointer' }
const tabActive: React.CSSProperties = { color: colors.white, backgroundColor: colors.blueDeep, borderColor: colors.blueDeep }
const th: React.CSSProperties = { fontFamily: fonts.body, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textLight, textAlign: 'left', padding: `${spacing[2]} ${spacing[3]}`, borderBottom: `1px solid ${colors.border}` }
const td: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text, padding: `${spacing[2]} ${spacing[3]}`, borderBottom: `1px solid ${colors.border}` }
const miniBtn: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSizes.xs, padding: '4px 10px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: radii.sm, cursor: 'pointer', color: colors.textMid }
const hint: React.CSSProperties = { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, fontStyle: 'italic', marginTop: spacing[2] }
const errBorder: React.CSSProperties = { borderColor: colors.danger }
