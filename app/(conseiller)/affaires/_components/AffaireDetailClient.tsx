'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, radii, cardBase, inputBase, labelBase,
  buttonGold, buttonOutline, statusBadge,
} from '@/lib/design-tokens'
import {
  api, isConflict, euros, dateFr, AFFAIRE_STATUT_LABEL, AFFAIRE_STATUT_STYLE, CIBLE_LABEL,
  StateMsg, ConfirmModal, FraisFields,
  ETAPE_STATUTS, TACHE_STATUTS, DOC_STATUTS, CTRL_STATUTS, StatutBadge, statutMeta, etapeTone,
  type StatutOpt,
} from './lib'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

export default function AffaireDetailClient({ affaireId, clientId }: { affaireId: string; clientId?: string }) {
  const [d, setD] = useState<Any>(null)
  const [motifs, setMotifs] = useState<Any[]>([])
  const [champDefs, setChampDefs] = useState<Map<string, Any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [modal, setModal] = useState<string | null>(null)   // modales d'en-tête / confirmations
  const [stepId, setStepId] = useState<string | null>(null) // modale d'étape

  const load = useCallback(async () => {
    try {
      const data = await api<Any>(`/api/affaires/${affaireId}`)
      setD(data); setConflict(false)
      if (data?.affaire?.frise_version_id) {
        api<Any>(`/api/affaires/parametrage/frises/${data.affaire.frise_version_id}`)
          .then((fd) => setChampDefs(new Map((fd.champs ?? []).map((c: Any) => [c.id, c]))))
          .catch(() => {})
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }, [affaireId])

  useEffect(() => { load() }, [load])
  useEffect(() => { api<Any>('/api/affaires/parametrage').then((r) => setMotifs((r.motifs ?? []).filter((m: Any) => m.actif))).catch(() => {}) }, [])

  const version = d?.affaire?.version_row as number | undefined

  // Action versionnée : renvoie true si succès. Ne ferme aucune modale (le
  // caller décide). Gère le conflit HTTP 409 comme aujourd'hui.
  const run = useCallback(async (url: string, body: Record<string, unknown>, method = 'POST'): Promise<boolean> => {
    if (version === undefined) return false
    setBusy(true); setActionError(null)
    try {
      await api(url, { method, body: JSON.stringify({ versionAttendue: version, ...body }) })
      await load(); return true
    } catch (e) {
      if (isConflict(e)) { setConflict(true); await load() }
      else setActionError(e instanceof Error ? e.message : 'Erreur')
      return false
    } finally { setBusy(false) }
  }, [version, load])

  // Modales de confirmation d'en-tête : ferment sur succès.
  const actClose = async (url: string, body: Record<string, unknown>, method = 'POST') => {
    const ok = await run(url, body, method); if (ok) setModal(null)
  }

  if (loading) return <StateMsg kind="loading">Chargement de l’affaire…</StateMsg>
  if (error) return <StateMsg kind="error">{error}</StateMsg>
  if (!d) return <StateMsg kind="empty">Affaire introuvable.</StateMsg>

  const a = d.affaire
  const readonly = a.statut !== 'en_cours'
  const etapes = (d.etapes as Any[])
  const tachesByEtape = (id: string) => (d.taches as Any[]).filter((t) => t.etape_id === id)
  const docsByEtape = (id: string) => (d.documents as Any[]).filter((t) => t.etape_id === id)
  const ctrlByEtape = (id: string) => (d.controles as Any[]).filter((t) => t.etape_id === id)
  const blocagesByEtape = (id: string) => (d.blocages as Any[]).filter((b) => b.etape_id === id)
  const blocagesActifs = (d.blocages as Any[]).filter((b) => b.actif && !b.deroge)
  const currentEtape = etapes.find((e) => e.statut === 'en_cours') ?? etapes.find((e) => e.statut === 'a_faire')
  const fraisPct = a.montant && a.montant > 0 && a.frais != null ? (Math.round((100 * a.frais) / a.montant * 100) / 100).toFixed(2) : null

  const step = stepId ? etapes.find((e) => e.id === stepId) : null

  return (
    <div>
      {clientId && (
        <Link href={`/clients/${clientId}/affaires`} style={{ ...buttonOutline, fontSize: fontSizes.xs, padding: '6px 14px', textDecoration: 'none', display: 'inline-flex', marginBottom: spacing[4] }}>
          ← Retour aux affaires
        </Link>
      )}

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
              <span>Frais : <b>{euros(a.frais)}</b>{fraisPct ? ` (${fraisPct} %)` : ''}</span>
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
        {actionError && !modal && !stepId && <StateMsg kind="error">{actionError}</StateMsg>}
      </div>

      {/* Blocages actifs (bandeau) */}
      {blocagesActifs.length > 0 && (
        <div style={{ ...statusBadge.danger, display: 'block', padding: spacing[3], marginBottom: spacing[4] }}>
          ⚠ {blocagesActifs.length} blocage{blocagesActifs.length > 1 ? 's' : ''} actif{blocagesActifs.length > 1 ? 's' : ''} — ouvrez l’étape concernée pour le traiter.
        </div>
      )}

      {/* Frise horizontale */}
      <SectionTitle>Frise réglementaire</SectionTitle>
      {etapes.length === 0 ? (
        <StateMsg kind="empty">Aucune étape.</StateMsg>
      ) : (
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', padding: `${spacing[2]} 0 ${spacing[4]}` }}>
          {etapes.map((et, i) => (
            <FriseNode key={et.id} etape={et} index={i} last={i === etapes.length - 1}
              current={currentEtape?.id === et.id}
              bloque={blocagesByEtape(et.id).some((b: Any) => b.actif && !b.deroge)}
              nbChildren={tachesByEtape(et.id).length + docsByEtape(et.id).length + ctrlByEtape(et.id).length}
              onClick={() => { setActionError(null); setStepId(et.id) }} />
          ))}
        </div>
      )}

      {/* Colonne latérale allégée : informations, propositions, historique */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: spacing[5], marginTop: spacing[4] }}>
        <div>
          <SectionTitle>Informations à renseigner</SectionTitle>
          {(d.champs as Any[]).length === 0 && <StateMsg kind="empty">Aucune information à renseigner.</StateMsg>}
          {(d.champs as Any[]).map((c) => (
            <ChampEditor key={c.id} champ={c} def={champDefs.get(c.champ_def_id)} disabled={readonly || busy}
              onSave={(val) => run(`/api/affaires/${affaireId}/champs/${c.id}`, { valeur: val })} />
          ))}
        </div>

        <div>
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
                  <Btn gold onClick={() => run(`/api/affaires/${affaireId}/propositions/${p.id}/appliquer`, {})}>Appliquer</Btn>
                  <Btn onClick={() => run(`/api/affaires/${affaireId}/propositions/${p.id}/rejeter`, {})}>Rejeter</Btn>
                  <Btn onClick={() => run(`/api/affaires/${affaireId}/propositions/${p.id}/annuler`, {})}>Annuler</Btn>
                </div>
              )}
            </div>
          ))}
        </div>

        <div>
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

      {/* Modale d'étape */}
      {step && (
        <EtapeModal
          etape={step} numero={etapes.findIndex((e) => e.id === step.id) + 1} readonly={readonly} busy={busy} error={actionError}
          taches={tachesByEtape(step.id)} docs={docsByEtape(step.id)} ctrls={ctrlByEtape(step.id)}
          blocages={blocagesByEtape(step.id)}
          onEtapeStatut={(v) => run(`/api/affaires/${affaireId}/etapes/${step.id}`, { statut: v })}
          onChild={(kind, id, v) => run(`/api/affaires/${affaireId}/${kind}/${id}`, { statut: v })}
          onDeroger={(bId) => setModal(`deroger:${bId}`)}
          onClose={() => { setStepId(null); setActionError(null) }} />
      )}

      {/* Modales d'en-tête */}
      {modal === 'terminer' && <NumMotifModal title="Terminer l’affaire" numLabel="Revenu réalisé (€, optionnel)" numRequired={false} motif="none" busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(n) => actClose(`/api/affaires/${affaireId}/terminer`, { revenuRealise: n })} />}
      {modal === 'reouvrir' && <ConfirmModal title="Rouvrir l’affaire" message="L’affaire repassera « en cours »." motif="required" confirmLabel="Rouvrir" busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(m) => actClose(`/api/affaires/${affaireId}/reouvrir`, { motif: m })} />}
      {modal === 'revenu' && <NumMotifModal title="Corriger le revenu réalisé" numLabel="Nouveau revenu (€)" numRequired motif="required" busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(n, m) => actClose(`/api/affaires/${affaireId}/corriger-revenu`, { revenu: n, motif: m })} />}
      {modal === 'archiver' && <ArchiverModal motifs={motifs} busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(motifId, comm) => actClose(`/api/affaires/${affaireId}/archiver`, { motifId, commentaire: comm || null })} />}
      {modal?.startsWith('deroger:') && <ConfirmModal title="Déroger au blocage" motif="required" confirmLabel="Déroger" busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(m) => actClose(`/api/affaires/${affaireId}/blocages/${modal.split(':')[1]}/deroger`, { motif: m })} />}
      {modal === 'infos' && <InfosModal affaire={a} busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(body) => actClose(`/api/affaires/${affaireId}`, body, 'PATCH')} />}
      {modal === 'prop' && <PropositionModal busy={busy} error={actionError} onCancel={() => setModal(null)} onConfirm={(body) => actClose(`/api/affaires/${affaireId}/propositions`, body)} />}
    </div>
  )
}

/* ── Frise horizontale ─────────────────────────────────────────────────────── */
function FriseNode({ etape, index, last, current, bloque, nbChildren, onClick }: {
  etape: Any; index: number; last: boolean; current: boolean; bloque: boolean; nbChildren: number; onClick: () => void
}) {
  const t = etapeTone(etape.statut)
  const done = etape.statut === 'terminee'
  const date = etape.date_fin ?? etape.date_debut
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      <button onClick={onClick} title={etape.libelle}
        style={{
          width: 170, textAlign: 'left', cursor: 'pointer', backgroundColor: colors.white,
          border: `1px solid ${current ? colors.gold : colors.border}`,
          borderTop: `3px solid ${current ? colors.gold : t.color}`,
          boxShadow: current ? `0 0 0 2px ${colors.goldPale}` : 'none',
          padding: spacing[3], display: 'flex', flexDirection: 'column', gap: spacing[2],
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: fonts.body, fontSize: '0.62rem', fontWeight: fontWeights.bold,
            backgroundColor: done ? colors.success : current ? colors.gold : colors.offWhite,
            color: (done || current) ? colors.white : colors.textMid, border: `1px solid ${done ? colors.success : current ? colors.gold : colors.border}`,
          }}>{done ? '✓' : index + 1}</span>
          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.blueDeep, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etape.libelle}</span>
        </div>
        <StatutBadge opts={ETAPE_STATUTS} value={etape.statut} />
        <div style={{ fontFamily: fonts.body, fontSize: '0.6rem', color: colors.textLight, display: 'flex', justifyContent: 'space-between', gap: spacing[2] }}>
          <span>{date ? dateFr(date) : '—'}</span>
          <span>{nbChildren > 0 ? `${nbChildren} élém.` : ''}{bloque ? ' ⚠' : ''}</span>
        </div>
      </button>
      {!last && <div style={{ width: spacing[3], display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textLight }}>›</div>}
    </div>
  )
}

/* ── Modale d'étape ────────────────────────────────────────────────────────── */
function EtapeModal({ etape, numero, taches, docs, ctrls, blocages, readonly, busy, error, onEtapeStatut, onChild, onDeroger, onClose }: {
  etape: Any; numero: number; taches: Any[]; docs: Any[]; ctrls: Any[]; blocages: Any[]; readonly: boolean; busy: boolean; error: string | null
  onEtapeStatut: (v: string) => void
  onChild: (kind: 'taches' | 'documents' | 'controles', id: string, v: string) => void
  onDeroger: (blocageId: string) => void
  onClose: () => void
}) {
  return (
    <div style={mo.backdrop} onClick={onClose}>
      <div style={mo.box} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3] }}>
          <h3 style={mo.title}>{numero}. {etape.libelle}</h3>
          <button style={mo.close} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap', marginBottom: spacing[3] }}>
          <label style={{ ...labelBase, margin: 0 }}>Statut</label>
          <StatutSelect opts={ETAPE_STATUTS} value={etape.statut} disabled={readonly || busy} onChange={onEtapeStatut} />
          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight }}>
            {etape.date_debut ? `Début ${dateFr(etape.date_debut)}` : ''}{etape.date_fin ? ` · Fin ${dateFr(etape.date_fin)}` : ''}
          </span>
        </div>

        <ChildBlock title="Actions à réaliser" items={taches} opts={TACHE_STATUTS} disabled={readonly || busy} onChange={(id, v) => onChild('taches', id, v)} />
        <ChildBlock title="Documents à obtenir" items={docs} opts={DOC_STATUTS} disabled={readonly || busy} onChange={(id, v) => onChild('documents', id, v)} />
        <ChildBlock title="Contrôles à valider" items={ctrls} opts={CTRL_STATUTS} disabled={readonly || busy} onChange={(id, v) => onChild('controles', id, v)} />

        {blocages.length > 0 && (
          <div style={{ marginTop: spacing[4] }}>
            <div style={mo.blockTitle}>Blocages</div>
            {blocages.map((b: Any) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm }}>
                  {b.libelle} {b.deroge ? <span style={statusBadge.neutral}>Dérogé</span> : b.actif ? <span style={statusBadge.danger}>Actif</span> : <span style={statusBadge.neutral}>Résolu</span>}
                </span>
                {!readonly && b.actif && !b.deroge && <button style={mo.miniBtn} disabled={busy} onClick={() => onDeroger(b.id)}>Déroger</button>}
              </div>
            ))}
          </div>
        )}

        {error && <StateMsg kind="error">{error}</StateMsg>}
        {readonly && <StateMsg kind="empty">Affaire non modifiable (statut actuel).</StateMsg>}
        <div style={mo.actions}><button style={mo.cancel} onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  )
}

function ChildBlock({ title, items, opts, onChange, disabled }: { title: string; items: Any[]; opts: StatutOpt[]; onChange: (id: string, v: string) => void; disabled?: boolean }) {
  return (
    <div style={{ marginTop: spacing[3] }}>
      <div style={mo.blockTitle}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, fontStyle: 'italic' }}>Aucun élément.</div>
      ) : items.map((it) => (
        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3], padding: '4px 0', borderBottom: `1px solid ${colors.border}` }}>
          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm }}>{it.libelle}{it.obligatoire ? ' *' : ''}</span>
          <StatutSelect opts={opts} value={it.statut} disabled={disabled} onChange={(v) => onChange(it.id, v)} />
        </div>
      ))}
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
function StatutSelect({ opts, value, onChange, disabled }: { opts: StatutOpt[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { style } = statutMeta(opts, value)
  return (
    <select value={value} disabled={disabled} onChange={(e) => e.target.value !== value && onChange(e.target.value)}
      style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, padding: '4px 8px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, backgroundColor: (style.backgroundColor as string) ?? colors.white, color: (style.color as string) ?? colors.text }}>
      {opts.map((o) => <option key={o.value} value={o.value} style={{ backgroundColor: colors.white, color: colors.text }}>{o.label}</option>)}
    </select>
  )
}
function ChampEditor({ champ, def, onSave, disabled }: { champ: Any; def?: Any; onSave: (v: unknown) => void; disabled?: boolean }) {
  const initial = champ.valeur === null || champ.valeur === undefined ? '' : String(champ.valeur)
  const [val, setVal] = useState(initial)
  const type = def?.type_donnee as string | undefined
  const label = def?.libelle ?? 'Information'
  const coerce = (s: string): unknown => {
    if (s.trim() === '') return null
    if (type === 'booleen') return s === 'true' || s === 'oui'
    if (type === 'nombre' || type === 'montant') { const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : s }
    if (s === 'true') return true
    if (s === 'false') return false
    return s
  }
  const inputType = type === 'date' ? 'date' : (type === 'nombre' || type === 'montant') ? 'number' : 'text'
  return (
    <div style={{ ...cardBase, padding: spacing[3], marginBottom: spacing[2] }}>
      <label style={{ ...labelBase, fontSize: '0.7rem' }}>{label}{def?.obligatoire ? ' *' : ''}</label>
      <div style={{ display: 'flex', gap: spacing[2] }}>
        {type === 'booleen' ? (
          <select style={{ ...inputBase, flex: 1 }} value={val} onChange={(e) => setVal(e.target.value)} disabled={disabled}>
            <option value="">—</option><option value="true">Oui</option><option value="false">Non</option>
          </select>
        ) : (
          <input style={{ ...inputBase, flex: 1 }} type={inputType} value={val} onChange={(e) => setVal(e.target.value)} disabled={disabled} />
        )}
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
  const [montant, setMontant] = useState(affaire.montant != null ? String(affaire.montant) : '')
  const [frais, setFrais] = useState<number | null>(affaire.frais ?? null)
  const [revenu, setRevenu] = useState(affaire.revenu_previsionnel != null ? String(affaire.revenu_previsionnel) : '')
  const num = (v: string) => (v.trim() === '' ? null : Number(v))
  return (
    <div style={mo.backdrop} onClick={onCancel}><div style={mo.box} onClick={(e) => e.stopPropagation()}>
      <h3 style={mo.title}>Modifier les informations</h3>
      <label style={labelBase}>Libellé *</label><input style={inputBase} value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <label style={{ ...labelBase, marginTop: spacing[3] }}>Montant (€)</label><input style={inputBase} type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
      <div style={{ marginTop: spacing[3] }}>
        <FraisFields montant={num(montant)} initialEuros={frais} onEurosChange={setFrais} />
      </div>
      <label style={{ ...labelBase, marginTop: spacing[3] }}>Revenu prévisionnel (€)</label><input style={inputBase} type="number" value={revenu} onChange={(e) => setRevenu(e.target.value)} />
      {error && <StateMsg kind="error">{error}</StateMsg>}
      <div style={mo.actions}><button style={mo.cancel} onClick={onCancel}>Annuler</button><button style={{ ...mo.ok, opacity: (busy || !libelle.trim()) ? 0.5 : 1 }} disabled={busy || !libelle.trim()} onClick={() => onConfirm({ libelle, montant: num(montant), frais, revenuPrevisionnel: num(revenu) })}>Enregistrer</button></div>
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
function propBadge(s: string): React.CSSProperties {
  return s === 'appliquee' ? statusBadge.success : s === 'en_attente' ? statusBadge.info : statusBadge.neutral
}
const mo = {
  backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(20,30,45,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 } as React.CSSProperties,
  box: { backgroundColor: colors.white, borderRadius: radii.md, padding: spacing[6], width: 'min(560px, 94vw)', maxHeight: '90vh', overflowY: 'auto' } as React.CSSProperties,
  title: { fontFamily: fonts.heading, fontSize: fontSizes.lg, color: colors.blueDeep, marginBottom: spacing[4] } as React.CSSProperties,
  close: { border: 'none', background: 'none', fontSize: fontSizes.lg, color: colors.textLight, cursor: 'pointer', lineHeight: 1 } as React.CSSProperties,
  blockTitle: { fontFamily: fonts.body, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.gold, fontWeight: fontWeights.bold, marginBottom: 4 } as React.CSSProperties,
  miniBtn: { fontFamily: fonts.body, fontSize: fontSizes.xs, padding: '4px 10px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: radii.sm, cursor: 'pointer', color: colors.textMid } as React.CSSProperties,
  actions: { display: 'flex', justifyContent: 'flex-end', gap: spacing[3], marginTop: spacing[4] } as React.CSSProperties,
  cancel: { fontFamily: fonts.body, fontSize: fontSizes.sm, padding: '8px 16px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, borderRadius: radii.sm, cursor: 'pointer', color: colors.textMid } as React.CSSProperties,
  ok: { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, padding: '8px 18px', border: 'none', backgroundColor: colors.blue, color: colors.white, borderRadius: radii.sm, cursor: 'pointer' } as React.CSSProperties,
}
