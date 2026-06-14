'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  cardBase, statusBadge,
} from '@/lib/design-tokens'
import type { CreationProduit } from '@/lib/schemas/creation-produit'
import { DOC_TYPE_LABELS, type FrontDocType } from '@/lib/prompts/creation-produit'

// ── Types ─────────────────────────────────────────────────────────────────────

type DocEntry = { file: File; doc_type: FrontDocType }

interface DocumentResult {
  storage_path:  string
  nom_fichier:   string
  nb_pages:      number
  texte_extrait: string
  doc_type:      FrontDocType
}

interface AnalyseResult {
  preview:        CreationProduit
  documents:      DocumentResult[]
  modele:         string
  version_prompt: string
  tokens_entree:  number | null
  tokens_sortie:  number | null
  analyse_brut:   Record<string, unknown>
}

const DOC_TYPE_OPTIONS: { value: FrontDocType; label: string }[] = [
  { value: 'DIC',               label: 'DICI — Document d\'Information Clé' },
  { value: 'Marche_cible',      label: 'Marché cible émetteur' },
  { value: 'Transparence_frais',label: 'Transparence des frais' },
  { value: 'Brochure',          label: 'Brochure commerciale' },
  { value: 'Rapport',           label: 'Rapport périodique' },
  { value: 'Autre',             label: 'Autre document' },
]

// ── Labels de prévisualisation ────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  AV: 'Assurance-vie', SCPI: 'SCPI', PER: 'PER', Capitalisation: 'Capitalisation',
}

const CAT_REG_LABELS: Record<string, string> = {
  OPCVM: 'OPCVM', FIA: 'FIA', assurance_vie: 'Assurance-vie',
  capitalisation: 'Capitalisation', per_individuel: 'PER Individuel',
  per_collectif: 'PER Collectif', scpi: 'SCPI', opci: 'OPCI',
  produit_structure: 'Structuré', autre: 'Autre',
}

const MC_CONNAISSANCE: Record<string, string> = { basique: 'Basique', informe: 'Informé', expert: 'Expert' }
const MC_EXPERIENCE: Record<string, string>   = { faible: 'Faible', moyenne: 'Moyenne', elevee: 'Élevée' }
const MC_CAPACITE: Record<string, string>     = { aucune_perte: 'Aucune perte', pertes_limitees: 'Pertes limitées', perte_capital: 'Perte capital', pertes_superieures: 'Pertes supérieures' }
const MC_TOLERANCE: Record<string, string>    = { tres_faible: 'Très faible', faible: 'Faible', moyenne: 'Moyenne', elevee: 'Élevée', tres_elevee: 'Très élevée' }
const MC_HORIZON: Record<string, string>      = { moins_2_ans: '< 2 ans', entre_2_et_5_ans: '2–5 ans', plus_5_ans: '> 5 ans' }
const MC_ESG: Record<string, string>          = { aucune: 'Aucune', moderee: 'Modérée', forte: 'Forte' }

function lbl<T extends Record<string, string>>(map: T, key: string | null | undefined): string {
  if (!key) return '—'
  return map[key] ?? key
}

// ── SRI compact ───────────────────────────────────────────────────────────────

function SriBar({ sri }: { sri: number | null | undefined }) {
  if (!sri) return <span style={{ color: colors.textLight, fontSize: fontSizes.sm }}>—</span>
  const color = sri <= 2 ? colors.success : sri <= 4 ? colors.warning : colors.danger
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[1,2,3,4,5,6,7].map(n => (
        <div key={n} style={{ width: '14px', height: '14px', backgroundColor: n <= sri ? color : colors.bluePale }} />
      ))}
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, marginLeft: spacing[2] }}>
        SRI {sri}/7
      </span>
    </div>
  )
}

// ── Preview ───────────────────────────────────────────────────────────────────

function Preview({ result, onConfirm, onReset, confirming, confirmError }: {
  result: AnalyseResult
  onConfirm: () => void
  onReset: () => void
  confirming: boolean
  confirmError: string | null
}) {
  const p   = result.preview
  const m   = p.metadonnees_produit
  const f   = p.produit_facts ?? {}
  const pos = p.marche_cible_positif
  const neg = p.marche_cible_negatif

  const totalPages   = result.documents.reduce((s, d) => s + d.nb_pages, 0)
  const scoreColor   = p.score_confiance >= 0.8 ? colors.success
    : p.score_confiance >= 0.5 ? colors.warning
    : colors.danger

  const mcRow = (dimLabel: string, posVal: string, negVal: string) => (
    <tr key={dimLabel}>
      <td style={{ ...tdStyle, color: colors.textMid, fontWeight: fontWeights.bold, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontSize: fontSizes.xs }}>
        {dimLabel}
      </td>
      <td style={{ ...tdStyle, color: posVal !== '—' ? colors.success : colors.textLight, fontStyle: posVal !== '—' ? 'normal' : 'italic' }}>
        {posVal}
      </td>
      <td style={{ ...tdStyle, color: negVal !== '—' ? colors.danger : colors.textLight, fontStyle: negVal !== '—' ? 'normal' : 'italic' }}>
        {negVal}
      </td>
    </tr>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[5] }}>

      {/* En-tête score + résumé dossier */}
      <div style={{ padding: `${spacing[3]} ${spacing[5]}`, backgroundColor: colors.bluePale, border: `1px solid ${colors.blueLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] }}>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blueDeep, fontWeight: fontWeights.medium }}>
            ✓ Analyse terminée · {result.documents.length} document{result.documents.length > 1 ? 's' : ''} · {totalPages} page{totalPages > 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
            <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>Confiance</span>
            <span style={{ ...statusBadge.info, color: scoreColor, borderColor: scoreColor, backgroundColor: `${scoreColor}15`, fontWeight: fontWeights.bold }}>
              {Math.round(p.score_confiance * 100)} %
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: spacing[3], flexWrap: 'wrap' as const }}>
          {result.documents.map((d, i) => (
            <span key={i} style={{ ...statusBadge.neutral, fontSize: fontSizes.xs }}>
              {DOC_TYPE_LABELS[d.doc_type]} — {d.nom_fichier}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[5] }}>

        {/* Identité */}
        <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm }}>
          <h3 style={cardTitleStyle}>Produit détecté</h3>
          <Row label="Nom"                  value={m.nom} bold />
          <Row label="Émetteur"             value={m.societe_gestion} />
          <Row label="Catégorie"            value={m.categorie ? CAT_LABELS[m.categorie] : null} />
          <Row label="Catégorie réglementaire" value={m.categorie_reglementaire ? CAT_REG_LABELS[m.categorie_reglementaire] : null} />
          <Row label="ISIN"                 value={m.isin} mono />
        </div>

        {/* Indicateurs */}
        <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm }}>
          <h3 style={cardTitleStyle}>Indicateurs clés</h3>
          <div style={{ marginBottom: spacing[3] }}>
            <p style={dimLabelStyle}>SRI</p>
            <SriBar sri={f.sri} />
          </div>
          <Row label="Frais de gestion"      value={f.frais_gestion    != null ? `${f.frais_gestion} %`    : null} />
          <Row label="Frais d'entrée"        value={f.frais_entree     != null ? `${f.frais_entree} %`     : null} />
          <Row label="Frais de sortie"       value={f.frais_sortie     != null ? `${f.frais_sortie} %`     : null} />
          <Row label="Durée min. conseillée" value={f.duree_detention_min != null ? `${f.duree_detention_min} ans` : null} />
          <Row label="Rendement N-1"         value={f.rendement_n1     != null ? `${f.rendement_n1} %`     : null} />
          <Row label="Rendement 3 ans"       value={f.rendement_3ans   != null ? `${f.rendement_3ans} %`   : null} />
        </div>
      </div>

      {/* Marché cible */}
      <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm }}>
        <h3 style={cardTitleStyle}>Marché cible</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40%' }}>Dimension</th>
              <th style={{ ...thStyle, color: colors.success }}>Positif ✓</th>
              <th style={{ ...thStyle, color: colors.danger }}>Négatif ✗</th>
            </tr>
          </thead>
          <tbody>
            {mcRow('Connaissances',   lbl(MC_CONNAISSANCE, pos.connaissance),    lbl(MC_CONNAISSANCE, neg.connaissance))}
            {mcRow('Expérience',      lbl(MC_EXPERIENCE,   pos.experience),      lbl(MC_EXPERIENCE,   neg.experience))}
            {mcRow('Capacité pertes', lbl(MC_CAPACITE,     pos.capacite_pertes), lbl(MC_CAPACITE,     neg.capacite_pertes))}
            {mcRow('Tolérance risque',lbl(MC_TOLERANCE,    pos.tolerance_risque),lbl(MC_TOLERANCE,    neg.tolerance_risque))}
            {mcRow('Horizon',         lbl(MC_HORIZON,      pos.horizon),         lbl(MC_HORIZON,      neg.horizon))}
            {mcRow('Sensibilité ESG', lbl(MC_ESG,          pos.sensibilite_esg), lbl(MC_ESG,          neg.sensibilite_esg))}
          </tbody>
        </table>
      </div>

      {/* Description */}
      {m.description && (
        <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm }}>
          <h3 style={cardTitleStyle}>Description générée</h3>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, lineHeight: 1.8 }}>
            {m.description}
          </p>
        </div>
      )}

      {/* Avertissement */}
      <div style={{
        padding: `${spacing[3]} ${spacing[5]}`,
        backgroundColor: colors.warningBg,
        border: `1px solid ${colors.warningBorder}`,
        display: 'flex', alignItems: 'flex-start', gap: spacing[3],
      }}>
        <span style={{ color: colors.warning, fontSize: fontSizes.base, flexShrink: 0 }}>⚠</span>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.warning, lineHeight: 1.6 }}>
          Toutes les données extraites par l'IA sont en statut <strong>À valider</strong>. Vérifiez la fiche produit créée et validez manuellement avant utilisation.
        </p>
      </div>

      {/* Actions */}
      {confirmError && (
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, margin: 0 }}>{confirmError}</p>
      )}
      <div style={{ display: 'flex', gap: spacing[4] }}>
        <button
          onClick={onConfirm}
          disabled={confirming}
          style={{
            fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            backgroundColor: confirming ? colors.textLight : colors.blue,
            color: colors.white, border: 'none', padding: `${spacing[4]} ${spacing[8]}`,
            cursor: confirming ? 'not-allowed' : 'pointer',
          }}
        >
          {confirming ? 'Création en cours…' : 'Créer le produit'}
        </button>
        <button
          onClick={onReset}
          disabled={confirming}
          style={{
            fontFamily: fonts.body, fontSize: fontSizes.sm,
            background: 'none', border: `1px solid ${colors.border}`,
            color: colors.textMid, padding: `${spacing[4]} ${spacing[6]}`,
            cursor: confirming ? 'not-allowed' : 'pointer',
          }}
        >
          Recommencer
        </button>
      </div>
    </div>
  )
}

// ── Sous-composants UI ────────────────────────────────────────────────────────

function Row({ label, value, bold, mono }: { label: string; value: string | null | undefined; bold?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}` }}>
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMid, flex: '0 0 160px' }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? 'monospace' : fonts.body, fontSize: fontSizes.sm,
        color: value ? colors.text : colors.textLight,
        fontWeight: (bold && value) ? fontWeights.semibold : fontWeights.regular,
        fontStyle: value ? 'normal' : 'italic', textAlign: 'right',
      }}>{value ?? '—'}</span>
    </div>
  )
}

const cardTitleStyle: React.CSSProperties = {
  fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
  color: colors.blueDeep, marginBottom: spacing[4],
}

const dimLabelStyle: React.CSSProperties = {
  fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMid,
  marginBottom: spacing[2],
}

const thStyle: React.CSSProperties = {
  fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.blueDeep,
  padding: `${spacing[2]} ${spacing[3]}`, textAlign: 'left',
  backgroundColor: colors.bluePale, borderBottom: `2px solid ${colors.blueLight}`,
}

const tdStyle: React.CSSProperties = {
  fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text,
  padding: `${spacing[2]} ${spacing[3]}`, borderBottom: `1px solid ${colors.border}`,
  verticalAlign: 'middle',
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function CreerDepuisDIC() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [etape, setEtape]               = useState<'upload' | 'analyse' | 'preview'>('upload')
  const [fichiers, setFichiers]         = useState<DocEntry[]>([])
  const [analyseError, setAnalyseError] = useState<string | null>(null)
  const [result, setResult]             = useState<AnalyseResult | null>(null)
  const [confirming, setConfirming]     = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [etapeMsg, setEtapeMsg]         = useState('')

  function reset() {
    setEtape('upload')
    setFichiers([])
    setAnalyseError(null)
    setResult(null)
    setConfirming(false)
    setConfirmError(null)
    setEtapeMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleFilesAdded(files: FileList | null) {
    if (!files) return
    const newEntries: DocEntry[] = Array.from(files)
      .filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map(f => ({ file: f, doc_type: 'DIC' as FrontDocType }))
    setFichiers(prev => [...prev, ...newEntries])
    if (inputRef.current) inputRef.current.value = ''
  }

  function changerType(index: number, doc_type: FrontDocType) {
    setFichiers(prev => prev.map((d, i) => i === index ? { ...d, doc_type } : d))
  }

  function retirerFichier(index: number) {
    setFichiers(prev => prev.filter((_, i) => i !== index))
  }

  async function analyser() {
    if (fichiers.length === 0) return
    setAnalyseError(null)
    setEtape('analyse')

    try {
      setEtapeMsg(`Upload de ${fichiers.length} document${fichiers.length > 1 ? 's' : ''}…`)
      const fd = new FormData()
      fd.append('count', fichiers.length.toString())
      fichiers.forEach((d, i) => {
        fd.append(`file_${i}`, d.file)
        fd.append(`type_${i}`, d.doc_type)
      })

      setEtapeMsg('Extraction du texte PDF…')
      const res  = await fetch('/api/produits/creer-depuis-dic/analyser', { method: 'POST', body: fd })
      const ct   = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) throw new Error(`Erreur serveur ${res.status}`)

      const data = await res.json() as AnalyseResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Analyse échouée')

      setResult(data)
      setEtape('preview')
    } catch (e) {
      setAnalyseError(e instanceof Error ? e.message : 'Erreur inconnue')
      setEtape('upload')
    }
  }

  async function confirmer() {
    if (!result) return
    setConfirming(true)
    setConfirmError(null)
    try {
      const res  = await fetch('/api/produits/creer-depuis-dic/confirmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) throw new Error(`Erreur serveur ${res.status}`)
      const data = await res.json() as { produit_id?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Création échouée')
      if (!data.produit_id) throw new Error('Identifiant produit manquant dans la réponse')
      router.push(`/produits/${data.produit_id}?tab=gouvernance`)
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'Erreur lors de la création')
      setConfirming(false)
    }
  }

  // ── Étape 1 : Upload + qualification ──────────────────────────────────────

  if (etape === 'upload') {
    return (
      <div>
        {analyseError && (
          <div style={{ padding: `${spacing[3]} ${spacing[5]}`, marginBottom: spacing[5], backgroundColor: colors.dangerBg, border: `1px solid ${colors.dangerBorder}` }}>
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger }}>{analyseError}</p>
          </div>
        )}

        {/* Zone d'ajout de fichier */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${fichiers.length > 0 ? colors.blue : colors.border}`,
            padding: spacing[8],
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: fichiers.length > 0 ? colors.infoBg : colors.offWhite,
            marginBottom: spacing[5],
          }}
        >
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xl, color: colors.textLight, marginBottom: spacing[2] }}>
            📄
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid }}>
            {fichiers.length === 0
              ? 'Cliquez pour ajouter des documents'
              : 'Cliquez pour ajouter d\'autres documents'}
          </p>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: spacing[1] }}>
            PDF · 20 Mo max par fichier
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFilesAdded(e.target.files)}
        />

        {/* Liste des documents avec qualification */}
        {fichiers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], marginBottom: spacing[6] }}>
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMid }}>
              Documents du dossier
            </p>
            {fichiers.map((entry, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: spacing[4],
                padding: `${spacing[3]} ${spacing[4]}`,
                backgroundColor: colors.offWhite, border: `1px solid ${colors.border}`,
              }}>
                <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blueDeep, fontWeight: fontWeights.medium, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {entry.file.name}
                </span>
                <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, flexShrink: 0 }}>
                  {(entry.file.size / 1024 / 1024).toFixed(1)} Mo
                </span>
                <select
                  value={entry.doc_type}
                  onChange={e => changerType(i, e.target.value as FrontDocType)}
                  style={{
                    fontFamily: fonts.body, fontSize: fontSizes.xs,
                    border: `1px solid ${colors.border}`, backgroundColor: colors.white,
                    color: colors.blueDeep, padding: `${spacing[2]} ${spacing[3]}`,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  {DOC_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => retirerFichier(i)}
                  style={{
                    background: 'none', border: 'none',
                    color: colors.danger, cursor: 'pointer',
                    fontFamily: fonts.body, fontSize: fontSizes.sm, flexShrink: 0,
                    padding: `${spacing[1]} ${spacing[2]}`,
                  }}
                  title="Retirer ce document"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={analyser}
          disabled={fichiers.length === 0}
          style={{
            fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            backgroundColor: fichiers.length === 0 ? colors.textLight : colors.blue,
            color: colors.white, border: 'none',
            padding: `${spacing[4]} ${spacing[8]}`,
            cursor: fichiers.length === 0 ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {fichiers.length === 0
            ? 'Analyser avec Claude'
            : `Analyser ${fichiers.length} document${fichiers.length > 1 ? 's' : ''} avec Claude`}
        </button>
      </div>
    )
  }

  // ── Étape 2 : Analyse en cours ─────────────────────────────────────────────

  if (etape === 'analyse') {
    return (
      <div style={{ textAlign: 'center', padding: spacing[12] }}>
        <div style={{
          display: 'inline-block', width: '40px', height: '40px',
          border: `3px solid ${colors.blueLight}`, borderTopColor: colors.blue,
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          marginBottom: spacing[5],
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid }}>
          {etapeMsg || 'Analyse en cours…'}
        </p>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: spacing[2] }}>
          Claude analyse le dossier documentaire · cela peut prendre 20 à 60 secondes
        </p>
      </div>
    )
  }

  // ── Étape 3 : Prévisualisation ─────────────────────────────────────────────

  if (etape === 'preview' && result) {
    return (
      <Preview
        result={result}
        onConfirm={confirmer}
        onReset={reset}
        confirming={confirming}
        confirmError={confirmError}
      />
    )
  }

  return null
}
