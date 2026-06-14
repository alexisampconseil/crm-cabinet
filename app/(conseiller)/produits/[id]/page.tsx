import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase, logAccess } from '@/lib/supabase'
import { getSignedDocumentUrl, createServiceSupabase } from '@/lib/supabase-service'
import type {
  Produit, ProduitGouvernance, ProduitGouvernanceHistorique,
  ProduitDocument, StatutConformite, StatutValidation,
  CategorieReglementaire, SourceMarcheCible, FrequenceRevue,
  StatutAnalyseIA,
  ConnaissanceMC, ExperienceMC, CapacitePertesMC,
  ToleranceRisqueMC, HorizonMC, SensibiliteESGMC,
} from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows, radii,
  letterSpacings, cardBase, sectionLabel, statusBadge,
  tableHeaderCell, tableCell,
} from '@/lib/design-tokens'
import ProduitTabs from './_components/ProduitTabs'
import ExtraireButton from './_components/ExtraireButton'
import ChampEditable, { type Option } from './_components/ChampEditable'
import SupprimerDocument from './_components/SupprimerDocument'
import ValidationActions from '../../gouvernance/[id]/_components/ValidationActions'
import MarquerRevu from '../../gouvernance/[id]/_components/MarquerRevu'
import UploadDocument from '../../gouvernance/[id]/_components/UploadDocument'
import AnalyserClaude from '../../gouvernance/[id]/_components/AnalyserClaude'
import { GenerateDescriptionButton } from '../../catalogue/[id]/_components/GenerateDescriptionButton'
import ArchiverProduit from './_components/ArchiverProduit'
import SupprimerProduit from './_components/SupprimerProduit'

// ─── Labels ──────────────────────────────────────────────────────────────────

const CONFORMITE_LABELS: Record<StatutConformite, string> = {
  conforme:     'Conforme',
  en_revision:  'En révision',
  suspendu:     'Suspendu',
  non_conforme: 'Non conforme',
}

const VALIDATION_LABELS: Record<StatutValidation, string> = {
  a_valider: 'À valider',
  valide:    'Validé',
  a_revoir:  'À revoir',
}

const CATEGORIE_REG_LABELS: Record<CategorieReglementaire, string> = {
  OPCVM:             'OPCVM',
  FIA:               'FIA',
  assurance_vie:     'Assurance-vie',
  capitalisation:    'Capitalisation',
  per_individuel:    'PER Individuel',
  per_collectif:     'PER Collectif',
  scpi:              'SCPI',
  opci:              'OPCI',
  produit_structure: 'Produit structuré',
  autre:             'Autre',
}

const SOURCE_LABELS: Record<SourceMarcheCible, string> = {
  emetteur:  'Émetteur',
  deduit_ia: 'Déduit par IA',
  manuel:    'Saisie manuelle',
}

const FREQUENCE_LABELS: Record<FrequenceRevue, string> = {
  trimestrielle: 'Trimestrielle',
  semestrielle:  'Semestrielle',
  annuelle:      'Annuelle',
}

const MC_CONNAISSANCE = { basique: 'Basique', informe: 'Informé', expert: 'Expert' }
const MC_EXPERIENCE   = { faible: 'Faible', moyenne: 'Moyenne', elevee: 'Élevée' }
const MC_CAPACITE     = { aucune_perte: 'Aucune perte', pertes_limitees: 'Pertes limitées', perte_capital: 'Perte du capital', pertes_superieures: 'Pertes supérieures au capital' }
const MC_TOLERANCE    = { tres_faible: 'Très faible (SRI 1)', faible: 'Faible (SRI 2-3)', moyenne: 'Moyenne (SRI 4)', elevee: 'Élevée (SRI 5-6)', tres_elevee: 'Très élevée (SRI 7)' }
const MC_HORIZON      = { moins_2_ans: '< 2 ans', entre_2_et_5_ans: '2 à 5 ans', plus_5_ans: '> 5 ans' }
const MC_ESG          = { aucune: 'Aucune', moderee: 'Modérée', forte: 'Forte' }

// ─── Options pour ChampEditable ──────────────────────────────────────────────

const OPTS_CATEGORIE: Option[] = [
  { value: 'AV',             label: 'Assurance-vie' },
  { value: 'SCPI',           label: 'SCPI' },
  { value: 'PER',            label: 'PER' },
  { value: 'Capitalisation', label: 'Capitalisation' },
]

const OPTS_CATEGORIE_REG: Option[] = [
  { value: 'OPCVM',             label: 'OPCVM' },
  { value: 'FIA',               label: 'FIA' },
  { value: 'assurance_vie',     label: 'Assurance-vie' },
  { value: 'capitalisation',    label: 'Capitalisation' },
  { value: 'per_individuel',    label: 'PER Individuel' },
  { value: 'per_collectif',     label: 'PER Collectif' },
  { value: 'scpi',              label: 'SCPI' },
  { value: 'opci',              label: 'OPCI' },
  { value: 'produit_structure', label: 'Produit structuré' },
  { value: 'autre',             label: 'Autre' },
]

const OPTS_SRI: Option[] = [1,2,3,4,5,6,7].map(n => ({ value: String(n), label: String(n) }))

const OPTS_CONFORMITE: Option[] = [
  { value: 'conforme',     label: 'Conforme' },
  { value: 'en_revision',  label: 'En révision' },
  { value: 'suspendu',     label: 'Suspendu' },
  { value: 'non_conforme', label: 'Non conforme' },
]

const OPTS_VALIDATION: Option[] = [
  { value: 'a_valider', label: 'À valider' },
  { value: 'valide',    label: 'Validé' },
  { value: 'a_revoir',  label: 'À revoir' },
]

const OPTS_CONNAISSANCE: Option[] = [
  { value: 'basique', label: 'Basique' },
  { value: 'informe', label: 'Informé' },
  { value: 'expert',  label: 'Expert' },
]

const OPTS_EXPERIENCE: Option[] = [
  { value: 'faible',  label: 'Faible' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'elevee',  label: 'Élevée' },
]

const OPTS_CAPACITE: Option[] = [
  { value: 'aucune_perte',         label: 'Aucune perte' },
  { value: 'pertes_limitees',      label: 'Pertes limitées' },
  { value: 'perte_capital',        label: 'Perte du capital' },
  { value: 'pertes_superieures',   label: 'Pertes supérieures' },
]

const OPTS_TOLERANCE: Option[] = [
  { value: 'tres_faible', label: 'Très faible (SRI 1)' },
  { value: 'faible',      label: 'Faible (SRI 2-3)' },
  { value: 'moyenne',     label: 'Moyenne (SRI 4)' },
  { value: 'elevee',      label: 'Élevée (SRI 5-6)' },
  { value: 'tres_elevee', label: 'Très élevée (SRI 7)' },
]

const OPTS_HORIZON: Option[] = [
  { value: 'moins_2_ans',      label: '< 2 ans' },
  { value: 'entre_2_et_5_ans', label: '2 à 5 ans' },
  { value: 'plus_5_ans',       label: '> 5 ans' },
]

const OPTS_ESG: Option[] = [
  { value: 'aucune',  label: 'Aucune' },
  { value: 'moderee', label: 'Modérée' },
  { value: 'forte',   label: 'Forte' },
]

const OPTS_FREQUENCE: Option[] = [
  { value: 'trimestrielle', label: 'Trimestrielle' },
  { value: 'semestrielle',  label: 'Semestrielle' },
  { value: 'annuelle',      label: 'Annuelle' },
]

const STATUT_ANALYSE_LABEL: Record<StatutAnalyseIA, string> = {
  en_attente:       'Texte extrait',
  en_cours:         'Analyse en cours…',
  analyse_terminee: 'Analysé IA',
  erreur:           'Erreur extraction',
}

const STATUT_ANALYSE_STYLE: Record<StatutAnalyseIA, React.CSSProperties> = {
  en_attente:       statusBadge.info,
  en_cours:         statusBadge.warning,
  analyse_terminee: statusBadge.success,
  erreur:           statusBadge.danger,
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function conformiteBadgeStyle(statut: StatutConformite): React.CSSProperties {
  const map: Record<StatutConformite, React.CSSProperties> = {
    conforme:     statusBadge.success,
    en_revision:  statusBadge.warning,
    suspendu:     statusBadge.neutral,
    non_conforme: statusBadge.danger,
  }
  return map[statut] ?? statusBadge.neutral
}

function validationBadgeStyle(statut: StatutValidation): React.CSSProperties {
  const map: Record<StatutValidation, React.CSSProperties> = {
    a_valider: statusBadge.info,
    valide:    statusBadge.success,
    a_revoir:  statusBadge.warning,
  }
  return map[statut] ?? statusBadge.neutral
}

// ─── Composants locaux ───────────────────────────────────────────────────────

function SriBar({ sri }: { sri: number | null }) {
  if (!sri) return <span style={{ color: colors.textLight, fontSize: fontSizes.sm }}>Non défini</span>
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1,2,3,4,5,6,7].map(n => (
        <div key={n} style={{
          width: '18px', height: '18px',
          backgroundColor: n <= sri
            ? (sri <= 2 ? colors.success : sri <= 4 ? colors.warning : colors.danger)
            : colors.bluePale,
        }} />
      ))}
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, marginLeft: spacing[2] }}>
        SRI {sri}/7
      </span>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}`,
    }}>
      <span style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
        letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textMid,
        flex: '0 0 180px',
      }}>{label}</span>
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: value ? colors.text : colors.textLight, textAlign: 'right', fontStyle: value ? 'normal' : 'italic' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function DimRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}`,
    }}>
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMid }}>
        {label}
      </span>
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: value ? colors.blueDeep : colors.textLight, fontWeight: value ? fontWeights.medium : fontWeights.regular, fontStyle: value ? 'normal' : 'italic' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function DdaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[4], padding: `${spacing[3]} 0`, borderBottom: `1px solid ${colors.border}` }}>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.wide, textTransform: 'uppercase' as const, color: colors.textMid, flex: '0 0 200px' }}>{label}</p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, flex: 1 }}>{value}</p>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...cardBase, padding: spacing[5], boxShadow: shadows.sm }}>
      <p style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
        letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const,
        color: colors.textMid, marginBottom: spacing[2],
      }}>{label}</p>
      <p style={{
        fontFamily: fonts.heading, fontSize: '2rem', fontWeight: fontWeights.light,
        color: colors.blueDeep, lineHeight: 1,
      }}>{value}</p>
      {sub && <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: spacing[1] }}>{sub}</p>}
    </div>
  )
}

// ─── DDA profile ─────────────────────────────────────────────────────────────

function ddaProfile(p: Produit) {
  const sriLevel = p.sri ?? 0
  return {
    clientType:    p.categorie === 'PER' ? 'Grand public' : sriLevel <= 3 ? 'Grand public' : sriLevel <= 5 ? 'Investisseur averti' : 'Investisseur professionnel',
    connaissance:  sriLevel <= 2 ? 'Basique' : sriLevel <= 4 ? 'Informé' : 'Avancé',
    capacitePerte: sriLevel <= 2 ? 'Aucune perte' : sriLevel <= 4 ? 'Perte partielle acceptable' : 'Perte totale possible',
    objectifs:     p.categorie === 'PER' ? 'Retraite / Préparation long terme' : p.categorie === 'SCPI' ? 'Revenu régulier / Diversification immobilière' : p.categorie === 'AV' ? 'Croissance / Transmission / Épargne' : 'Croissance / Optimisation fiscale',
    horizon:       p.categorie === 'PER' ? '> 15 ans' : sriLevel <= 3 ? '3 à 8 ans' : sriLevel <= 5 ? '5 à 10 ans' : '> 8 ans',
    sriRange:      p.categorie === 'AV' ? '1 à 7 selon UC' : p.categorie === 'SCPI' ? '3 à 5' : p.categorie === 'PER' ? '1 à 7' : '1 à 5',
  }
}

// ─── Types locaux ─────────────────────────────────────────────────────────────

// PostgREST retourne un objet (pas un tableau) pour les relations 1-to-1 (UNIQUE FK)
type ProduitWithGouv = Produit & { produits_gouvernance: ProduitGouvernance | null }

type ExtraitLite = {
  id: string
  document_id: string
  statut_analyse: StatutAnalyseIA
  nb_pages: number | null
  date_extraction: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProduitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id }          = await params
  const { tab = 'produit' } = await searchParams
  const supabase        = await createServerSupabase()
  await logAccess('produit_view', `produit:${id}`)

  const { data: produitData, error: produitError } = await supabase
    .from('produits')
    .select('*, produits_gouvernance(*)')
    .eq('id', id)
    .single()

  if (produitError || !produitData) notFound()

  const raw     = produitData as ProduitWithGouv
  const produit = raw as Produit
  let gouvernance: ProduitGouvernance | null = raw.produits_gouvernance ?? null

  // Fallback : si malgré le trigger la gouvernance n'existe pas encore, upsert idempotent
  if (!gouvernance) {
    const service = createServiceSupabase()
    await service.from('produits_gouvernance').upsert({
      produit_id:          id,
      statut_conformite:   'conforme',
      statut_validation:   'a_valider',
      source_marche_cible: 'manuel',
      alerte_revue:        false,
    }, { onConflict: 'produit_id', ignoreDuplicates: true })
    const { data: govData } = await service
      .from('produits_gouvernance')
      .select('*')
      .eq('produit_id', id)
      .maybeSingle()
    gouvernance = (govData as ProduitGouvernance | null)
  }

  // Documents — chargés uniquement pour l'onglet Documents
  let docs: ProduitDocument[]         = []
  let extraitsParDoc                  = new Map<string, ExtraitLite>()
  let docSignedUrls                   = new Map<string, string>()

  if (tab === 'documents') {
    const { data } = await supabase
      .from('produits_documents')
      .select('*')
      .eq('produit_id', id)
      .order('date_document', { ascending: false })
    docs = (data ?? []) as ProduitDocument[]

    if (docs.length > 0) {
      await Promise.all(
        docs
          .filter(d => d.storage_path)
          .map(async d => {
            const url = await getSignedDocumentUrl(d.storage_path!)
            if (url) docSignedUrls.set(d.id, url)
          })
      )
      const docIds = docs.map(d => d.id)
      const { data: extraitsData } = await supabase
        .from('documents_extraits')
        .select('id, document_id, statut_analyse, nb_pages, date_extraction')
        .in('document_id', docIds)
        .order('created_at', { ascending: false })

      for (const e of (extraitsData ?? []) as ExtraitLite[]) {
        if (!extraitsParDoc.has(e.document_id)) {
          extraitsParDoc.set(e.document_id, e)
        }
      }
    }
  }

  // Historique — chargé uniquement pour l'onglet Historique
  let historique: ProduitGouvernanceHistorique[] = []
  if (tab === 'historique' && gouvernance) {
    const { data } = await supabase
      .from('produits_gouvernance_historique')
      .select('*')
      .eq('gouvernance_id', gouvernance.id)
      .order('modifie_le', { ascending: false })
    historique = (data ?? []) as ProduitGouvernanceHistorique[]
  }

  const dda = ddaProfile(produit)

  return (
    <div>
      {/* Fil d'Ariane */}
      <div style={s.breadcrumb}>
        <Link href="/produits" style={s.breadLink}>← Produits</Link>
        <span style={s.breadSep}>/</span>
        <span style={s.breadCurrent}>{produit.nom}</span>
      </div>

      {/* En-tête produit */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.eyebrow}>
            <div style={s.rule} />
            <span style={s.eyebrowText}>{produit.categorie}</span>
            {produit.categorie_reglementaire && (
              <span style={{ ...statusBadge.info, marginLeft: spacing[2] }}>
                {CATEGORIE_REG_LABELS[produit.categorie_reglementaire]}
              </span>
            )}
          </div>
          <h1 style={s.title}>{produit.nom}</h1>
          {produit.societe_gestion && <p style={s.societe}>{produit.societe_gestion}</p>}
          <div style={{ marginTop: spacing[4] }}><SriBar sri={produit.sri} /></div>
        </div>
        <div style={s.headerRight}>
          {gouvernance && (
            <>
              <span style={conformiteBadgeStyle(gouvernance.statut_conformite)}>
                {CONFORMITE_LABELS[gouvernance.statut_conformite]}
              </span>
              <span style={validationBadgeStyle(gouvernance.statut_validation)}>
                {VALIDATION_LABELS[gouvernance.statut_validation]}
              </span>
              {gouvernance.alerte_revue && (
                <span style={{ ...statusBadge.warning, fontSize: fontSizes.xs }}>⚠ Alerte revue</span>
              )}
            </>
          )}
          {produit.dici_url && (
            <a href={produit.dici_url} target="_blank" rel="noopener noreferrer" style={s.diciLink}>
              DICI ↗
            </a>
          )}
          <div style={{ marginTop: spacing[3], display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: spacing[2] }}>
            <ArchiverProduit produitId={produit.id} estActif={produit.actif ?? true} nomProduit={produit.nom} />
            <SupprimerProduit produitId={produit.id} nomProduit={produit.nom} />
          </div>
        </div>
      </div>

      {/* Bannière produit archivé */}
      {!produit.actif && (
        <div style={{
          padding: `${spacing[4]} ${spacing[5]}`,
          backgroundColor: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
          marginBottom: spacing[6],
          display: 'flex', alignItems: 'center', gap: spacing[3],
        }}>
          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.warning, fontWeight: fontWeights.semibold }}>
            Ce produit a été retiré du catalogue.
          </span>
          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>
            Il n&apos;est plus visible dans le catalogue actif. Utilisez « Réactiver le produit » pour le remettre en ligne.
          </span>
        </div>
      )}

      {/* Onglets */}
      <ProduitTabs activeTab={tab} produitId={id} />

      {/* ── Produit ────────────────────────────────────────────────────────── */}
      {tab === 'produit' && (
        <div>
          {/* Stats performance */}
          <div style={s.statsGrid}>
            <StatCard
              label="Rendement N-1"
              value={produit.rendement_n1 !== null ? `${produit.rendement_n1} %` : '—'}
              sub="Performance année précédente"
            />
            <StatCard
              label="Rendement 3 ans annualisé"
              value={produit.rendement_3ans !== null ? `${produit.rendement_3ans} %` : '—'}
              sub="Moyenne annuelle sur 3 ans"
            />
            <StatCard
              label="Ratio de Sharpe 3 ans"
              value={produit.ratio_sharpe_3ans !== null ? produit.ratio_sharpe_3ans.toFixed(2) : '—'}
              sub="Rendement ajusté du risque"
            />
          </div>

          <div style={s.twoCol}>
            {/* Colonne gauche */}
            <div style={s.colMain}>
              {/* Présentation IA */}
              <div style={{ ...cardBase, ...s.card }}>
                <div style={s.cardHead}>
                  <h2 style={s.cardTitle}>Présentation</h2>
                  <GenerateDescriptionButton produitId={produit.id} hasDescription={!!produit.description_ia} />
                </div>
                {produit.description_ia ? (
                  <div style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, lineHeight: 1.8 }}>
                    {produit.description_ia.split('\n\n').map((para, i, arr) => (
                      <p key={i} style={{ marginBottom: i < arr.length - 1 ? spacing[4] : 0 }}>{para}</p>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: spacing[6], backgroundColor: colors.offWhite, border: `1px dashed ${colors.border}`, textAlign: 'center' as const }}>
                    <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textLight, fontStyle: 'italic' }}>
                      Aucune description générée. Cliquez sur « Générer la fiche IA » pour créer automatiquement une présentation.
                    </p>
                  </div>
                )}
              </div>

              {/* Commentaire SRI */}
              {produit.commentaire_sri_ia && (
                <div style={{ ...cardBase, ...s.card, borderLeft: `3px solid ${colors.gold}` }}>
                  <h2 style={{ ...s.cardTitle, marginBottom: spacing[3] }}>Commentaire SRI</h2>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, lineHeight: 1.7 }}>
                    {produit.commentaire_sri_ia}
                  </p>
                </div>
              )}

              {/* Marché cible DDA indicatif */}
              <div style={{ ...cardBase, ...s.card }}>
                <div style={s.cardHead}>
                  <h2 style={s.cardTitle}>Marché cible DDA</h2>
                  <span style={{ ...statusBadge.neutral, fontSize: fontSizes.xs }}>MIF2 / IDD</span>
                </div>
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, lineHeight: 1.6, fontStyle: 'italic', marginBottom: spacing[3] }}>
                  Profil indicatif basé sur la catégorie et le SRI. À compléter selon la fiche DDA de la société de gestion.
                </p>
                <DdaRow label="Type de client" value={dda.clientType} />
                <DdaRow label="Connaissances" value={dda.connaissance} />
                <DdaRow label="Capacité à supporter des pertes" value={dda.capacitePerte} />
                <DdaRow label="Objectifs & besoins" value={dda.objectifs} />
                <DdaRow label="Horizon recommandé" value={dda.horizon} />
                <DdaRow label="Plage SRI indicative" value={dda.sriRange} />
              </div>
            </div>

            {/* Colonne droite */}
            <div style={s.colSide}>
              {/* Informations produit */}
              <div style={{ ...cardBase, ...s.card }}>
                <h2 style={s.cardTitle}>Informations</h2>
                <ChampEditable label="Nom" valeur={produit.nom} champ="nom" type="text" routeApi={`/api/produits/${id}`} nullable={false} />
                <ChampEditable label="Société de gestion" valeur={produit.societe_gestion} champ="societe_gestion" type="text" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Catégorie" valeur={produit.categorie} champ="categorie" type="select" options={OPTS_CATEGORIE} routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Catégorie réglementaire" valeur={produit.categorie_reglementaire} champ="categorie_reglementaire" type="select" options={OPTS_CATEGORIE_REG} routeApi={`/api/produits/${id}`} />
                <ChampEditable label="ISIN" valeur={produit.isin} champ="isin" type="text" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="SRI" valeur={produit.sri} champ="sri" type="select" options={OPTS_SRI} routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Rendement N-1" valeur={produit.rendement_n1} champ="rendement_n1" type="percentage" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Rendement 3 ans annualisé" valeur={produit.rendement_3ans} champ="rendement_3ans" type="percentage" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Ratio de Sharpe 3 ans" valeur={produit.ratio_sharpe_3ans} champ="ratio_sharpe_3ans" type="number" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Frais de gestion" valeur={produit.frais_gestion} champ="frais_gestion" type="percentage" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Frais d'entrée" valeur={produit.frais_entree} champ="frais_entree" type="percentage" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Frais de sortie" valeur={produit.frais_sortie} champ="frais_sortie" type="percentage" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Durée min. conseillée (ans)" valeur={produit.duree_detention_min} champ="duree_detention_min" type="number" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Date d'agrément" valeur={produit.date_agrement} champ="date_agrement" type="date" routeApi={`/api/produits/${id}`} />
                <ChampEditable label="Encours gérés (€)" valeur={produit.encours_geres} champ="encours_geres" type="number" routeApi={`/api/produits/${id}`} />
                <InfoLine label="Référencé le" value={new Intl.DateTimeFormat('fr-FR').format(new Date(produit.created_at))} />
                <InfoLine label="Mis à jour le" value={new Intl.DateTimeFormat('fr-FR').format(new Date(produit.updated_at))} />
                {produit.dici_url && (
                  <div style={{ marginTop: spacing[4] }}>
                    <a href={produit.dici_url} target="_blank" rel="noopener noreferrer" style={{
                      fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue,
                      textDecoration: 'none', fontWeight: fontWeights.medium, display: 'block',
                      textAlign: 'center', padding: `${spacing[3]} 0`,
                      border: `1px solid ${colors.infoBorder}`,
                    }}>
                      Accéder au DICI officiel ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Documents ───────────────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
          <UploadDocument produitId={id} />
          <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[5] }}>Documents produit</h2>
            {docs.length === 0 ? (
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic', padding: spacing[4] }}>
                Aucun document référencé pour ce produit.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {docs.map(doc => {
                  const extrait = extraitsParDoc.get(doc.id)
                  return (
                    <div key={doc.id} style={{
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: `${spacing[4]} 0`, borderBottom: `1px solid ${colors.border}`,
                      gap: spacing[4],
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.text }}>
                          {doc.type}
                          {doc.version && (
                            <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginLeft: spacing[2] }}>
                              v{doc.version}
                            </span>
                          )}
                        </p>
                        <div style={{ display: 'flex', gap: spacing[3], marginTop: spacing[2], alignItems: 'center', flexWrap: 'wrap' as const }}>
                          {doc.date_document && (
                            <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>
                              {new Intl.DateTimeFormat('fr-FR').format(new Date(doc.date_document))}
                            </span>
                          )}
                          {doc.statut && doc.statut !== 'actif' && (
                            <span style={doc.statut === 'expire' ? statusBadge.danger : statusBadge.neutral}>
                              {doc.statut === 'archive' ? 'Archivé' : 'Expiré'}
                            </span>
                          )}
                          {doc.date_expiration && (
                            <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight }}>
                              Expire le {new Intl.DateTimeFormat('fr-FR').format(new Date(doc.date_expiration))}
                            </span>
                          )}
                          {extrait ? (
                            <span style={{ ...STATUT_ANALYSE_STYLE[extrait.statut_analyse], display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {STATUT_ANALYSE_LABEL[extrait.statut_analyse]}
                              {extrait.nb_pages ? ` · ${extrait.nb_pages}p` : ''}
                            </span>
                          ) : doc.storage_path ? (
                            <span style={{ ...statusBadge.neutral, fontStyle: 'italic' }}>Texte non extrait</span>
                          ) : null}
                        </div>
                        {!extrait && doc.storage_path && (
                          <ExtraireButton documentId={doc.id} />
                        )}
                        {extrait && (extrait.statut_analyse === 'en_attente' || extrait.statut_analyse === 'erreur') && (
                          <AnalyserClaude extraitId={extrait.id} produitId={id} />
                        )}
                        <SupprimerDocument documentId={doc.id} />
                      </div>
                      {(() => {
                        const href = doc.storage_path
                          ? docSignedUrls.get(doc.id) ?? null
                          : doc.url
                        return href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" style={{
                            fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue,
                            fontWeight: fontWeights.medium, textDecoration: 'none',
                            whiteSpace: 'nowrap' as const, flexShrink: 0,
                          }}>
                            Ouvrir ↗
                          </a>
                        ) : (
                          <span style={{
                            fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight,
                            fontStyle: 'italic', flexShrink: 0,
                          }}>
                            Non disponible
                          </span>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Gouvernance ─────────────────────────────────────────────────────── */}
      {tab === 'gouvernance' && gouvernance && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[5] }}>

            {/* Export PDF */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <a href={`/api/gouvernance/${id}/pdf`} style={s.pdfBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                Exporter PDF
              </a>
            </div>

            <div style={s.twoCol}>
              {/* Colonne gauche */}
              <div style={s.colMain}>

                {/* Texte source émetteur */}
                <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm, borderLeft: `3px solid ${colors.gold}` }}>
                  <p style={{
                    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
                    letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.gold, marginBottom: spacing[3],
                  }}>
                    Texte source émetteur
                  </p>
                  {gouvernance.mc_emetteur_texte ? (
                    <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text, lineHeight: 1.7, marginBottom: spacing[3] }}>
                      {gouvernance.mc_emetteur_texte}
                    </p>
                  ) : null}
                  <ChampEditable label="Texte émetteur" valeur={gouvernance.mc_emetteur_texte} champ="mc_emetteur_texte" type="textarea" routeApi={`/api/produits/${id}/gouvernance`} />
                </div>

                {/* Marché cible positif + négatif */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[5] }}>
                  <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm, borderTop: `3px solid ${colors.success}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[5] }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.success }} />
                      <h2 style={s.cardTitle}>Marché cible positif</h2>
                    </div>
                    <ChampEditable label="Connaissances" valeur={gouvernance.mc_pos_connaissance} champ="mc_pos_connaissance" type="select" options={OPTS_CONNAISSANCE} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Expérience" valeur={gouvernance.mc_pos_experience} champ="mc_pos_experience" type="select" options={OPTS_EXPERIENCE} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Capacité à supporter des pertes" valeur={gouvernance.mc_pos_capacite_pertes} champ="mc_pos_capacite_pertes" type="select" options={OPTS_CAPACITE} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Tolérance au risque" valeur={gouvernance.mc_pos_tolerance_risque} champ="mc_pos_tolerance_risque" type="select" options={OPTS_TOLERANCE} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Horizon d'investissement" valeur={gouvernance.mc_pos_horizon} champ="mc_pos_horizon" type="select" options={OPTS_HORIZON} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Sensibilité ESG" valeur={gouvernance.mc_pos_sensibilite_esg} champ="mc_pos_sensibilite_esg" type="select" options={OPTS_ESG} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                  </div>

                  <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm, borderTop: `3px solid ${colors.danger}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[5] }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.danger }} />
                      <h2 style={s.cardTitle}>Marché cible négatif</h2>
                    </div>
                    <ChampEditable label="Connaissances" valeur={gouvernance.mc_neg_connaissance} champ="mc_neg_connaissance" type="select" options={OPTS_CONNAISSANCE} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Expérience" valeur={gouvernance.mc_neg_experience} champ="mc_neg_experience" type="select" options={OPTS_EXPERIENCE} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Capacité à supporter des pertes" valeur={gouvernance.mc_neg_capacite_pertes} champ="mc_neg_capacite_pertes" type="select" options={OPTS_CAPACITE} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Tolérance au risque" valeur={gouvernance.mc_neg_tolerance_risque} champ="mc_neg_tolerance_risque" type="select" options={OPTS_TOLERANCE} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Horizon d'investissement" valeur={gouvernance.mc_neg_horizon} champ="mc_neg_horizon" type="select" options={OPTS_HORIZON} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                    <ChampEditable label="Sensibilité ESG" valeur={gouvernance.mc_neg_sensibilite_esg} champ="mc_neg_sensibilite_esg" type="select" options={OPTS_ESG} routeApi={`/api/produits/${id}/gouvernance`} variant="dim" />
                  </div>
                </div>

                {/* Mapping IA */}
                {gouvernance.mapping_ia && (
                  <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm }}>
                    <p style={{
                      fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
                      letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.textMid, marginBottom: spacing[3],
                    }}>
                      Détail du mapping IA
                    </p>
                    <pre style={{
                      fontFamily: 'monospace', fontSize: '0.7rem', color: colors.textMid,
                      backgroundColor: colors.offWhite, padding: spacing[4],
                      border: `1px solid ${colors.border}`, overflow: 'auto', maxHeight: '300px',
                      lineHeight: 1.6,
                    }}>
                      {JSON.stringify(gouvernance.mapping_ia, null, 2)}
                    </pre>
                  </div>
                )}

                {/* MarquerRevu */}
                <MarquerRevu
                  gouvernanceId={gouvernance.id}
                  frequenceRevue={gouvernance.frequence_revue}
                  dateDerniereRevue={gouvernance.date_derniere_revue}
                  dateProchaine={gouvernance.date_prochaine_revue}
                />

                {/* Revues périodiques */}
                <div style={{ ...cardBase, ...s.card }}>
                  <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Revues périodiques</h2>
                  <ChampEditable label="Fréquence" valeur={gouvernance.frequence_revue} champ="frequence_revue" type="select" options={OPTS_FREQUENCE} routeApi={`/api/produits/${id}/gouvernance`} />
                  <ChampEditable label="Dernière revue" valeur={gouvernance.date_derniere_revue} champ="date_derniere_revue" type="date" routeApi={`/api/produits/${id}/gouvernance`} />
                  <ChampEditable label="Prochaine revue" valeur={gouvernance.date_prochaine_revue} champ="date_prochaine_revue" type="date" routeApi={`/api/produits/${id}/gouvernance`} />
                  <ChampEditable label="Responsable" valeur={gouvernance.responsable_revue} champ="responsable_revue" type="text" routeApi={`/api/produits/${id}/gouvernance`} />
                  <ChampEditable label="Alerte active" valeur={gouvernance.alerte_revue} champ="alerte_revue" type="boolean" routeApi={`/api/produits/${id}/gouvernance`} nullable={false} />
                </div>

                {/* Notes et restrictions */}
                <div style={{ ...cardBase, ...s.card }}>
                  <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Notes et restrictions</h2>
                  <ChampEditable label="Public exclu" valeur={gouvernance.public_exclu} champ="public_exclu" type="textarea" routeApi={`/api/produits/${id}/gouvernance`} />
                  <ChampEditable label="Conditions d'accès" valeur={gouvernance.conditions_acces} champ="conditions_acces" type="textarea" routeApi={`/api/produits/${id}/gouvernance`} />
                  <ChampEditable label="Conflits d'intérêt" valeur={gouvernance.conflits_interet} champ="conflits_interet" type="textarea" routeApi={`/api/produits/${id}/gouvernance`} />
                  <ChampEditable label="Notes de gouvernance" valeur={gouvernance.notes_gouvernance} champ="notes_gouvernance" type="textarea" routeApi={`/api/produits/${id}/gouvernance`} />
                </div>

                {/* Document de gouvernance officiel */}
                {gouvernance.document_gouvernance_url && (
                  <div style={{ ...cardBase, padding: spacing[5], boxShadow: shadows.sm }}>
                    <a href={gouvernance.document_gouvernance_url} target="_blank" rel="noopener noreferrer" style={{
                      fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue,
                      fontWeight: fontWeights.medium, textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: spacing[2],
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      Document de gouvernance officiel ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Colonne droite */}
              <div style={s.colSide}>
                <ValidationActions gouvernanceId={gouvernance.id} statut={gouvernance.statut_validation} />

                {/* Statuts éditables */}
                <div style={{ ...cardBase, ...s.card, marginTop: spacing[4] }}>
                  <h2 style={{ ...s.cardTitle, marginBottom: spacing[3] }}>Statuts</h2>
                  <ChampEditable label="Conformité" valeur={gouvernance.statut_conformite} champ="statut_conformite" type="select" options={OPTS_CONFORMITE} routeApi={`/api/produits/${id}/gouvernance`} nullable={false} />
                  <ChampEditable label="Validation" valeur={gouvernance.statut_validation} champ="statut_validation" type="select" options={OPTS_VALIDATION} routeApi={`/api/produits/${id}/gouvernance`} nullable={false} />
                </div>

                {/* Source des données */}
                <div style={{ ...cardBase, ...s.card, marginTop: spacing[4] }}>
                  <h2 style={{ ...s.cardTitle, marginBottom: spacing[3] }}>Source des données</h2>
                  <InfoLine label="Source" value={SOURCE_LABELS[gouvernance.source_marche_cible]} />
                  {gouvernance.modele_ia && (
                    <InfoLine label="Modèle IA" value={gouvernance.modele_ia} />
                  )}
                  {gouvernance.date_analyse_ia && (
                    <InfoLine
                      label="Analysé le"
                      value={new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(gouvernance.date_analyse_ia))}
                    />
                  )}
                  {gouvernance.score_confiance_ia !== null && (
                    <InfoLine
                      label="Score de confiance"
                      value={`${Math.round(gouvernance.score_confiance_ia * 100)} %`}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
      )}

      {/* ── Historique ──────────────────────────────────────────────────────── */}
      {tab === 'historique' && gouvernance && (
        <div style={{ ...cardBase, boxShadow: shadows.sm, overflow: 'hidden' }}>
            {historique.length === 0 ? (
              <p style={{
                fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight,
                fontStyle: 'italic', padding: spacing[8], textAlign: 'center',
              }}>
                Aucune modification enregistrée. L'historique est alimenté automatiquement à chaque mise à jour de la gouvernance.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderCell}>Date</th>
                    <th style={tableHeaderCell}>Origine</th>
                    <th style={tableHeaderCell}>Conformité</th>
                    <th style={tableHeaderCell}>Validation</th>
                    <th style={tableHeaderCell}>Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map(h => (
                    <tr key={h.id}>
                      <td style={tableCell}>
                        <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text }}>
                          {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(h.modifie_le))}
                        </span>
                      </td>
                      <td style={tableCell}>
                        {h.modifie_par ? (
                          <span style={{ ...statusBadge.neutral, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                            Conseiller
                          </span>
                        ) : (
                          <span style={{ ...statusBadge.info, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            Analyse IA
                          </span>
                        )}
                      </td>
                      <td style={tableCell}>
                        {h.statut_conformite_avant !== h.statut_conformite_apres ? (
                          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>
                            {h.statut_conformite_avant ?? '?'} → {h.statut_conformite_apres ?? '?'}
                          </span>
                        ) : (
                          <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>—</span>
                        )}
                      </td>
                      <td style={tableCell}>
                        {h.statut_validation_avant !== h.statut_validation_apres ? (
                          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>
                            {h.statut_validation_avant ?? '?'} → {h.statut_validation_apres ?? '?'}
                          </span>
                        ) : (
                          <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>—</span>
                        )}
                      </td>
                      <td style={tableCell}>
                        {h.motif ? (
                          <span style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text }}>
                            {h.motif}
                          </span>
                        ) : (
                          <span style={{ color: colors.textLight, fontSize: fontSizes.xs }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  breadcrumb: { display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[6] },
  breadLink:  { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue, textDecoration: 'none' },
  breadSep:   { color: colors.textLight, fontSize: fontSizes.sm },
  breadCurrent: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacing[8], gap: spacing[6],
  },
  headerLeft: { flex: 1 },
  headerRight: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: spacing[2] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.8rem)',
    fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em',
    marginBottom: spacing[2],
  },
  societe: {
    fontFamily: fonts.body, fontSize: fontSizes.base,
    color: colors.textMid, fontWeight: fontWeights.light,
  },
  diciLink: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue,
    textDecoration: 'none', fontWeight: fontWeights.medium,
    border: `1px solid ${colors.infoBorder}`, padding: `${spacing[2]} ${spacing[4]}`,
  } as React.CSSProperties,
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[5],
    marginBottom: spacing[6],
  },
  twoCol: { display: 'flex', gap: spacing[5], alignItems: 'flex-start' },
  colMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: spacing[5] },
  colSide: { width: '300px', flexShrink: 0 },
  card: { padding: spacing[6], boxShadow: shadows.sm } as React.CSSProperties,
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[5] },
  cardTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep, letterSpacing: letterSpacings.wide, marginBottom: spacing[4],
  },
  pdfBtn: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide, textTransform: 'uppercase',
    color: colors.gold, border: `1px solid ${colors.gold}`,
    padding: `${spacing[2]} ${spacing[4]}`, textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', gap: spacing[2],
  } as React.CSSProperties,
  th: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const,
    color: colors.blueDeep, backgroundColor: colors.bluePale, padding: `${spacing[3]} ${spacing[4]}`,
    textAlign: 'left' as const, borderBottom: `2px solid ${colors.blueLight}`,
  },
  td: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text,
    padding: `${spacing[3]} ${spacing[4]}`, borderBottom: `1px solid ${colors.border}`,
    verticalAlign: 'middle' as const,
  },
}
