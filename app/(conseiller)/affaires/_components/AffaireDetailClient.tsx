'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, radii, cardBase, inputBase, labelBase,
  buttonGold, buttonOutline, statusBadge,
} from '@/lib/design-tokens'
import {
  api, isConflict, euros, dateFr, AFFAIRE_STATUT_LABEL, AFFAIRE_STATUT_STYLE, CIBLE_LABEL,
  StateMsg, ConfirmModal,
} from './lib'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

const ETAPE_OPTS = ['a_faire', 'en_cours', 'terminee', 'ignoree']
const DOC_OPTS = ['attendu', 'depose', 'valide', 'refuse', 'non_requis']
const CTRL_OPTS = ['a_controler', 'conforme', 'non_conforme', 'deroge']

export default function AffaireDetailClient({ affaireId }: { affaireId: string }) {
  const [d, setD] = useState<Any>(null)
  const [motifs, setMotifs] = useState<Any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [modal, setModal] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<Any>(`/api/affaires/${affaireId}`)
      setD(data); setConflict(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }, [affaireId])

  useEffect(() => { load() }, [load])
  useEffect(() => { api<Any>('/api/affaires/parametrage').then((r) => setMotifs((r.motifs ?? []).filter((m: Any) => m.actif))).catch(() => {}) }, [])

  const version = d?.affaire?.version_row as number | undefined

  const act = useCallback(async (url: string, body: Record<string, unknown>, method = 'POST') => {
    if (version === undefined) return
    setBusy(true); setActionError(null)
    try {
      await api(url, { method, body: JSON.stringify({ versionAttendue: version, ...body }) })
      setModal(null)
      await load()
    } catch (e) {
      if (isConflict(e)) { setConflict(true); await load() }
      else setActionError(e instanceof Error ? e.message : 'Erreur')
    } finally { setBusy(false) }
  }, [version, load])

  if (loading) return <StateMsg kind="loading">Chargement de l’affaire…</StateMsg>
  if (error) return <StateMsg kind="error">{error}</StateMsg>
  if (!d) return <StateMsg kind="empty">Affaire introuvable.</StateMsg>

  const a = d.affaire
  const readonly = a.statut !== 'en_cours'
  const tachesByEtape = (id: string) => (d.taches as Any[]).filter((t) => t.etape_id === id)
  const docsByEtape = (id: string) => (d.documents as Any[]).filter((t) => t.etape_id === id)
  const ctrlByEtape = (id: string) => (d.controles as Any[]).filter((t) => t.etape_id === id)
  const blocagesActifs = (d.blocages as Any[]).filter((b) => b.actif && !b.deroge)

  return (
    <div>
      {conflict && (
        <div style={{ ...statusBadge.warning, display: 'block', padding: spacing[3], marginBottom: spacing[4] }}>
          ⚠ Cette affaire a été modifiée ailleurs — les données ont été rechargées. Vérifiez avant de réessayer.
        </div>
      )}

      {/* En-tête */}
      <div style={{ ...cardBase, padding: spacing[5], marginBottom: spacing[5] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[4], flexWrap: 'wrap' }}>
          <div>
            <span style={AFFAIRE_STATUT_STYLE[a.statut]}>{AFFAIRE_STATUT_LABEL[a.statut] ?? a.statut}</span>
            <h1 style={{ fontFamily: fonts.heading, fontSize: fontSizes.xl, color: colors.blueDeep, margin: `${spacing[2]} 0` }}>{a.libelle}</h1>
            <div style={{ display: 'flex', gap: spacing[5], fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, flexWrap: 'wrap' }}>
              <span>Montant : <b>{euros(a.montant)}</b></span>
              <span>Frais : <b>{euros(a.frais)}</b></span>
              <span>CA prév. : <b>{euros(a.revenu_previsionnel)}</b></span>
              <span>CA réal. : <b>{euros(a.revenu_realise)}</b></span>
              <span>Ouverture : {dateFr(a.date_ouverture)}</span>
              {a.date_cloture && <span>Clôture : {dateFr(a.date_cloture)}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap' }}>
            {a.statut === 'en_cours' && <Btn onClick={() => setModal('infos')}>Modifier</Btn>}
            {a.statut === 'en_cours' && <Btn gold onClick={() => setModal('terminer')}>Terminer</Btn>}
            {(a.statut === 'en_cours' || a.statut === 'terminee') && <Btn onClick={() => setModal('archiver')}>Archiver</Btn>}
            {a.statut === 'terminee' && <Btn onClick={() => setModal('reouvrir')}>Rouvrir</Btn>}
            {(a.statut === 'terminee' || a.statut === 'archivee') && <Btn onClick={() => setModal('revenu')}>Corriger revenu</Btn>}
          </div>
        </div>
        {actionError && !modal && <StateMsg kind="error">{actionError}</StateMsg>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: spacing[5], alignItems: 'start' }}>
        {/* Frise (élément principal) */}
        <div>
          <SectionTitle>Frise réglementaire</SectionTitle>
          {(d.etapes as Any[]).map((et) => (
            <div key={et.id} style={{ ...cardBase, padding: spacing[4], marginBottom: spacing[3], borderLeft: `3px solid ${etapeColor(et.statut)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] }}>
                <b style={{ fontFamily: fonts.body, color: colors.blueDeep }}>{et.ordre}. {et.libelle}</b>
                <StatutSelect value={et.statut} opts={ETAPE_OPTS} disabled={readonly || busy}
                  onChange={(v) => act(`/api/affaires/${affaireId}/etapes/${et.id}`, { statut: v })} />
              </div>
              <ChildLines title="Tâches" items={tachesByEtape(et.id)} opts={ETAPE_OPTS} readonly={readonly || busy}
                onChange={(id, v) => act(`/api/affaires/${affaireId}/taches/${id}`, { statut: v })} />
              <ChildLines title="Documents" items={docsByEtape(et.id)} opts={DOC_OPTS} readonly={readonly || busy}
                onChange={(id, v) => act(`/api/affaires/${affaireId}/documents/${id}`, { statut: v })} />
              <ChildLines title="Contrôles" items={ctrlByEtape(et.id)} opts={CTRL_OPTS} readonly={readonly || busy}
                onChange={(id, v) => act(`/api/affaires/${affaireId}/controles/${id}`, { statut: v })} />
            </div>
          ))}
          {(d.etapes as Any[]).length === 0 && <StateMsg kind="empty">Aucune étape.</StateMsg>}

          {/* Blocages */}
          <SectionTitle>Blocages</SectionTitle>
          {(d.blocages as Any[]).length === 0 && <StateMsg kind="empty">Aucun blocage.</StateMsg>}
          {(d.blocages as Any[]).map((b) => (
            <div key={b.id} style={{ ...cardBase, padding: spacing[3], marginBottom: spacing[2], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm }}>
                {b.libelle} {b.deroge ? <span style={statusBadge.neutral}>dérogé</span> : b.actif ? <span style={statusBadge.danger}>actif</span> : <span style={statusBadge.neutral}>résolu</span>}
              </span>
              {a.statut === 'en_cours' && b.actif && !b.deroge && (
                <Btn onClick={() => setModal(`deroger:${b.id}`)}>Déroger</Btn>
              )}
            </div>
          ))}
        </div>

        {/* Colonne latérale */}
        <div>
          {/* Champs dynamiques */}
          <SectionTitle>Champs</SectionTitle>
          {(d.champs as Any[]).length === 0 && <StateMsg kind="empty">Aucun champ dynamique.</StateMsg>}
          {(d.champs as Any[]).map((c) => (
            <ChampEditor key={c.id} champ={c} disabled={readonly || busy}
              onSave={(val) => act(`/api/affaires/${affaireId}/champs/${c.id}`, { valeur: val })} />
          ))}

          {/* Propositions */}
          <SectionTitle>Propositions patrimoniales</SectionTitle>
          {a.statut === 'terminee' && <Btn onClick={() => setModal('prop')}>+ Nouvelle proposition</Btn>}
          {(d.propositions as Any[]).length === 0 && <StateMsg kind="empty">Aucune proposition.</StateMsg>}
          {(d.propositions as Any[]).map((p) => (
            <div key={p.id} style={{ ...cardBase, padding: spacing[3], marginTop: spacing[2] }}>
              <div style={{ fontFamily: fonts.body, fontSize: fontSizes.sm }}>
                <b>{p.operation === 'creation' ? 'Création' : 'Mise à jour'}</b> · {CIBLE_LABEL[p.cible_type]} · <span style={propBadge(p.statut)}>{p.statut}</span>
              </div>
              {p.statut === 'en_attente' && a.statut !== 'archivee' && (
                <div style={{ display: 'flex', gap: spacing[2], marginTop: spacing[2] }}>
                  <Btn gold onClick={() => act(`/api/affaires/${affaireId}/propositions/${p.id}/appliquer`, {})}>Appliquer</Btn>
                  <Btn onClick={() => act(`/api/affaires/${affaireId}/propositions/${p.id}/rejeter`, {})}>Rejeter</Btn>
                  <Btn onClick={() => act(`/api/affaires/${affaireId}/propositions/${p.id}/annuler`, {})}>Annuler</Btn>
                </div>
              )}
            </div>
          ))}

          {/* Historique */}
          <SectionTitle>Historique</SectionTitle>
          <div style={{ ...cardBase, padding: spacing[3], maxHeight: 320, overflowY: 'auto' }}>
            {(d.evenements as Any[]).map((e) => (
              <div key={e.id} style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, padding: `4px 0`, borderBottom: `1px solid ${colors.border}` }}>
                <b>{e.type_evenement}</b> — {dateFr(e.created_at)} {e.motif ? `· ${e.motif}` : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modales */}
      {modal === 'terminer' && <NumMotifModal title="Terminer l’affaire" numLabel="Revenu réalisé (€, optionnel)" numRequired={false} motif="none" busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(n) => act(`/api/affaires/${affaireId}/terminer`, { revenuRealise: n })} />}
      {modal === 'reouvrir' && <ConfirmModal title="Rouvrir l’affaire" message="L’affaire repassera « en cours »." motif="required" confirmLabel="Rouvrir" busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(m) => act(`/api/affaires/${affaireId}/reouvrir`, { motif: m })} />}
      {modal === 'revenu' && <NumMotifModal title="Corriger le revenu réalisé" numLabel="Nouveau revenu (€)" numRequired motif="required" busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(n, m) => act(`/api/affaires/${affaireId}/corriger-revenu`, { revenu: n, motif: m })} />}
      {modal === 'archiver' && <ArchiverModal motifs={motifs} busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(motifId, comm) => act(`/api/affaires/${affaireId}/archiver`, { motifId, commentaire: comm || null })} />}
      {modal?.startsWith('deroger:') && <ConfirmModal title="Déroger au blocage" motif="required" confirmLabel="Déroger" busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(m) => act(`/api/affaires/${affaireId}/blocages/${modal.split(':')[1]}/deroger`, { motif: m })} />}
      {modal === 'infos' && <InfosModal affaire={a} busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(body) => act(`/api/affaires/${affaireId}`, body, 'PATCH')} />}
      {modal === 'prop' && <PropositionModal busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(body) => act(`/api/affaires/${affaireId}/propositions`, body)} />}
    </div>
  )
}

/* ── Sous-composants ─────────────────────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.blueDeep, margin: `${spacing[5]} 0 ${spacing[3]}` }}>{children}</h2>
}
function Btn({ children, onClick, gold }: { children: React.ReactNode; onClick: () => void; gold?: boolean }) {
  return <button onClick={onClick} style={{ ...(gold ? buttonGold : buttonOutline), fontSize: fontSizes.xs, padding: '6px 14px', cursor: 'pointer' }}>{children}</button>
}
function StatutSelect({ value, opts, onChange, disabled }: { value: string; opts: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => e.target.value !== value && onChange(e.target.value)}
      style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, padding: '4px 8px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, backgroundColor: colors.white }}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
function ChildLines({ title, items, opts, onChange, readonly }: { title: string; items: Any[]; opts: string[]; onChange: (id: string, v: string) => void; readonly?: boolean }) {
  if (items.length === 0) return null
  return (
    <div style={{ marginTop: spacing[2] }}>
      <div style={{ fontFamily: fonts.body, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.textLight, marginBottom: 4 }}>{title}</div>
      {items.map((it) => (
        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm }}>{it.libelle}{it.obligatoire ? ' *' : ''}</span>
          <StatutSelect value={it.statut} opts={opts} disabled={readonly} onChange={(v) => onChange(it.id, v)} />
        </div>
      ))}
    </div>
  )
}
function ChampEditor({ champ, onSave, disabled }: { champ: Any; onSave: (v: unknown) => void; disabled?: boolean }) {
  const initial = champ.valeur === null || champ.valeur === undefined ? '' : String(champ.valeur)
  const [val, setVal] = useState(initial)
  const coerce = (s: string): unknown => {
    if (s.trim() === '') return null
    if (s === 'true') return true
    if (s === 'false') return false
    const n = Number(s)
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(s.trim())) return n
    return s
  }
  return (
    <div style={{ ...cardBase, padding: spacing[3], marginBottom: spacing[2] }}>
      <label style={{ ...labelBase, fontSize: '0.7rem' }}>{champ.champ_def_id.slice(0, 8)}…</label>
      <div style={{ display: 'flex', gap: spacing[2] }}>
        <input style={{ ...inputBase, flex: 1 }} value={val} onChange={(e) => setVal(e.target.value)} disabled={disabled} />
        <button style={{ ...buttonOutline, fontSize: fontSizes.xs, padding: '4px 10px' }} disabled={disabled} onClick={() => onSave(coerce(val))}>OK</button>
      </div>
    </div>
  )
}
function NumMotifModal({ title, numLabel, numRequired, motif, busy, error, onCancel, onConfirm }: { title: string; numLabel: string; numRequired: boolean; motif: 'none' | 'required'; busy?: boolean; error?: string | null; onCancel: () => void; onConfirm: (n: number | null, m: string) => void }) {
  const [num, setNum] = useState(''); const [m, setM] = useState('')
  const numVal = num.trim() === '' ? null : Number(num)
  const disabled = busy || (numRequired && numVal === null) || (motif === 'required' && m.trim() === '')
  return (
    <div style={mo.backdrop} onClick={onCancel}><div style={mo.box} onClick={(e) => e.stopPropagation()}>
      <h3 style={mo.title}>{title}</h3>
      <label style={labelBase}>{numLabel}</label>
      <input style={inputBase} type="number" value={num} onChange={(e) => setNum(e.target.value)} />
      {motif === 'required' && <><label style={{ ...labelBase, marginTop: spacing[3] }}>Motif *</label><textarea style={{ ...inputBase, resize: 'vertical' }} rows={2} value={m} onChange={(e) => setM(e.target.value)} /></>}
      {error && <StateMsg kind="error">{error}</StateMsg>}
      <div style={mo.actions}><button style={mo.cancel} onClick={onCancel}>Annuler</button><button style={{ ...mo.ok, opacity: disabled ? 0.5 : 1 }} disabled={disabled} onClick={() => onConfirm(numVal, m.trim())}>Confirmer</button></div>
    </div></div>
  )
}
function ArchiverModal({ motifs, busy, error, onCancel, onConfirm }: { motifs: Any[]; busy?: boolean; error?: string | null; onCancel: () => void; onConfirm: (motifId: string, comm: string) => void }) {
  const [motifId, setMotifId] = useState(''); const [comm, setComm] = useState('')
  const selected = motifs.find((m) => m.id === motifId)
  const needComment = selected?.necessite_commentaire
  const disabled = busy || !motifId || (needComment && comm.trim() === '')
  return (
    <div style={mo.backdrop} onClick={onCancel}><div style={mo.box} onClick={(e) => e.stopPropagation()}>
      <h3 style={mo.title}>Archiver l’affaire</h3>
      <label style={labelBase}>Motif *</label>
      <select style={inputBase} value={motifId} onChange={(e) => setMotifId(e.target.value)}>
        <option value="">— Choisir —</option>
        {motifs.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
      </select>
      {(needComment || comm) && <><label style={{ ...labelBase, marginTop: spacing[3] }}>Commentaire {needComment ? '*' : ''}</label><textarea style={{ ...inputBase, resize: 'vertical' }} rows={2} value={comm} onChange={(e) => setComm(e.target.value)} /></>}
      {error && <StateMsg kind="error">{error}</StateMsg>}
      <div style={mo.actions}><button style={mo.cancel} onClick={onCancel}>Annuler</button><button style={{ ...mo.ok, opacity: disabled ? 0.5 : 1 }} disabled={disabled} onClick={() => onConfirm(motifId, comm.trim())}>Archiver</button></div>
    </div></div>
  )
}
function InfosModal({ affaire, busy, error, onCancel, onConfirm }: { affaire: Any; busy?: boolean; error?: string | null; onCancel: () => void; onConfirm: (b: Record<string, unknown>) => void }) {
  const [libelle, setLibelle] = useState(affaire.libelle ?? '')
  const [montant, setMontant] = useState(affaire.montant ?? '')
  const [frais, setFrais] = useState(affaire.frais ?? '')
  const [revenu, setRevenu] = useState(affaire.revenu_previsionnel ?? '')
  const num = (v: Any) => (v === '' || v === null ? null : Number(v))
  return (
    <div style={mo.backdrop} onClick={onCancel}><div style={mo.box} onClick={(e) => e.stopPropagation()}>
      <h3 style={mo.title}>Modifier les informations</h3>
      <label style={labelBase}>Libellé *</label><input style={inputBase} value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <label style={{ ...labelBase, marginTop: spacing[3] }}>Montant (€)</label><input style={inputBase} type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
      <label style={{ ...labelBase, marginTop: spacing[3] }}>Frais (€)</label><input style={inputBase} type="number" value={frais} onChange={(e) => setFrais(e.target.value)} />
      <label style={{ ...labelBase, marginTop: spacing[3] }}>Revenu prévisionnel (€)</label><input style={inputBase} type="number" value={revenu} onChange={(e) => setRevenu(e.target.value)} />
      {error && <StateMsg kind="error">{error}</StateMsg>}
      <div style={mo.actions}><button style={mo.cancel} onClick={onCancel}>Annuler</button><button style={{ ...mo.ok, opacity: (busy || !libelle.trim()) ? 0.5 : 1 }} disabled={busy || !libelle.trim()} onClick={() => onConfirm({ libelle, montant: num(montant), frais: num(frais), revenuPrevisionnel: num(revenu) })}>Enregistrer</button></div>
    </div></div>
  )
}
function PropositionModal({ busy, error, onCancel, onConfirm }: { busy?: boolean; error?: string | null; onCancel: () => void; onConfirm: (b: Record<string, unknown>) => void }) {
  const [operation, setOperation] = useState('creation')
  const [cibleType, setCibleType] = useState('actif_financier')
  const [donneesTxt, setDonneesTxt] = useState('{\n  "nature": "",\n  "libelle": ""\n}')
  const [existId, setExistId] = useState('')
  const [jsonErr, setJsonErr] = useState<string | null>(null)
  const submit = () => {
    let donnees: Record<string, unknown>
    try { donnees = JSON.parse(donneesTxt) } catch { setJsonErr('JSON invalide'); return }
    setJsonErr(null)
    const idKey: Record<string, string> = { actif_financier: 'actifFinancierId', patrimoine_immobilier: 'patrimoineImmobilierId', passif: 'passifId', contrat_prevoyance: 'contratPrevoyanceId' }
    const body: Record<string, unknown> = { operation, cibleType, donnees }
    if (operation === 'mise_a_jour' && existId) body[idKey[cibleType]] = existId
    onConfirm(body)
  }
  return (
    <div style={mo.backdrop} onClick={onCancel}><div style={mo.box} onClick={(e) => e.stopPropagation()}>
      <h3 style={mo.title}>Nouvelle proposition patrimoniale</h3>
      <div style={{ display: 'flex', gap: spacing[3] }}>
        <div style={{ flex: 1 }}><label style={labelBase}>Opération</label>
          <select style={inputBase} value={operation} onChange={(e) => setOperation(e.target.value)}><option value="creation">Création</option><option value="mise_a_jour">Mise à jour</option></select></div>
        <div style={{ flex: 1 }}><label style={labelBase}>Catégorie</label>
          <select style={inputBase} value={cibleType} onChange={(e) => setCibleType(e.target.value)}>
            {Object.entries(CIBLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      </div>
      {operation === 'mise_a_jour' && <><label style={{ ...labelBase, marginTop: spacing[3] }}>ID élément existant *</label><input style={inputBase} value={existId} onChange={(e) => setExistId(e.target.value)} /></>}
      <label style={{ ...labelBase, marginTop: spacing[3] }}>Données proposées (JSON)</label>
      <textarea style={{ ...inputBase, fontFamily: 'monospace', resize: 'vertical' }} rows={6} value={donneesTxt} onChange={(e) => setDonneesTxt(e.target.value)} />
      {jsonErr && <StateMsg kind="error">{jsonErr}</StateMsg>}
      {error && <StateMsg kind="error">{error}</StateMsg>}
      <div style={mo.actions}><button style={mo.cancel} onClick={onCancel}>Annuler</button><button style={{ ...mo.ok, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={submit}>Créer</button></div>
    </div></div>
  )
}

/* ── styles/utils ─────────────────────────────────────────────────────────── */
function etapeColor(s: string) { return s === 'terminee' ? colors.success : s === 'en_cours' ? colors.blue : s === 'ignoree' ? colors.textLight : colors.border }
function propBadge(s: string): React.CSSProperties {
  return s === 'appliquee' ? statusBadge.success : s === 'en_attente' ? statusBadge.info : statusBadge.neutral
}
const mo = {
  backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(20,30,45,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 } as React.CSSProperties,
  box: { backgroundColor: colors.white, borderRadius: radii.md, padding: spacing[6], width: 'min(560px, 94vw)', maxHeight: '90vh', overflowY: 'auto' } as React.CSSProperties,
  title: { fontFamily: fonts.heading, fontSize: fontSizes.lg, color: colors.blueDeep, marginBottom: spacing[4] } as React.CSSProperties,
  actions: { display: 'flex', justifyContent: 'flex-end', gap: spacing[3], marginTop: spacing[4] } as React.CSSProperties,
  cancel: { fontFamily: fonts.body, fontSize: fontSizes.sm, padding: '8px 16px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: radii.sm, cursor: 'pointer', color: colors.textMid } as React.CSSProperties,
  ok: { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, padding: '8px 18px', border: 'none', backgroundColor: colors.blue, color: colors.white, borderRadius: radii.sm, cursor: 'pointer' } as React.CSSProperties,
}
