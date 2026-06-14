import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import { C } from './pdf-styles'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GouvernanceLiteGPdf {
  id:                      string
  statut_conformite:       string
  statut_validation:       string
  source_marche_cible:     string
  modele_ia:               string | null
  date_analyse_ia:         string | null
  score_confiance_ia:      number | null
  mc_pos_connaissance:     string | null
  mc_pos_experience:       string | null
  mc_pos_capacite_pertes:  string | null
  mc_pos_tolerance_risque: string | null
  mc_pos_horizon:          string | null
  mc_pos_sensibilite_esg:  string | null
  mc_neg_connaissance:     string | null
  mc_neg_experience:       string | null
  mc_neg_capacite_pertes:  string | null
  mc_neg_tolerance_risque: string | null
  mc_neg_horizon:          string | null
  mc_neg_sensibilite_esg:  string | null
  date_derniere_revue:     string | null
  date_prochaine_revue:    string | null
  alerte_revue:            boolean
}

export interface DocumentGPdf {
  type:          string
  date_document: string | null
}

export interface ProduitCatPdf {
  id:                      string
  nom:                     string
  societe_gestion:         string | null
  categorie_reglementaire: string | null
  sri:                     number | null
  gouvernance:             GouvernanceLiteGPdf | null
  documents:               DocumentGPdf[]
  version_prompt:          string | null
}

export interface CatSectionData {
  label:                  string
  objectifsCompatibles:   string[]
  objectifsIncompatibles: string[]
  produits:               ProduitCatPdf[]
}

export interface GouvernanceProduitsData {
  categories:  CatSectionData[]
  generatedAt: string
}

// ── Labels ────────────────────────────────────────────────────────────────────

const CONN: Record<string, string> = { basique: 'Basique', informe: 'Informé', expert: 'Expert' }
const EXP:  Record<string, string> = { faible: 'Faible', moyenne: 'Moyenne', elevee: 'Élevée' }
const TOL:  Record<string, string> = {
  tres_faible: 'Très faible (SRI 1)', faible: 'Faible (SRI 2-3)', moyenne: 'Moyenne (SRI 4)',
  elevee: 'Élevée (SRI 5-6)', tres_elevee: 'Très élevée (SRI 7)',
}
const CAP: Record<string, string> = {
  aucune_perte: 'Aucune perte', pertes_limitees: 'Pertes limitées',
  perte_capital: 'Perte du capital', pertes_superieures: 'Pertes supérieures au capital',
}
const ESG: Record<string, string> = { aucune: 'Aucune exigence', moderee: 'Modérée', forte: 'Forte' }
const HOR: Record<string, string> = { moins_2_ans: '< 2 ans', entre_2_et_5_ans: '2 à 5 ans', plus_5_ans: '> 5 ans' }
const CONF: Record<string, string> = {
  conforme: 'Conforme', en_revision: 'En révision', suspendu: 'Suspendu', non_conforme: 'Non conforme',
}
const VALID: Record<string, string>  = { a_valider: 'À valider', valide: 'Validé', a_revoir: 'À revoir' }
const DOC_TYPE: Record<string, string> = {
  DICI: 'DIC / DICI', Brochure: 'Brochure commerciale',
  Rapport: 'Rapport périodique', Autre: 'Document annexe',
}

const lv = (map: Record<string, string>, v: string | null) => v ? (map[v] ?? v) : '—'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

function fmtDateTime(d: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(d))
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

type CatStats = {
  total: number; valides: number; aValider: number; enAlerte: number
  derniere: string | null; prochaine: string | null
}

function catStats(produits: ProduitCatPdf[]): CatStats {
  const today   = new Date().toISOString().split('T')[0]
  const valides  = produits.filter(p => p.gouvernance?.statut_validation === 'valide').length
  const aValider = produits.filter(p => p.gouvernance?.statut_validation === 'a_valider').length
  const enAlerte = produits.filter(p => p.gouvernance?.alerte_revue === true).length
  const dDates   = produits.map(p => p.gouvernance?.date_derniere_revue).filter((d): d is string => !!d).sort()
  const pDates   = produits.map(p => p.gouvernance?.date_prochaine_revue).filter((d): d is string => !!d && d > today).sort()
  return {
    total: produits.length, valides, aValider, enAlerte,
    derniere: dDates.at(-1) ?? null,
    prochaine: pDates[0] ?? null,
  }
}

function globalStats(categories: CatSectionData[]) {
  const all = categories.flatMap(c => c.produits)
  return {
    total:      all.length,
    valides:    all.filter(p => p.gouvernance?.statut_validation === 'valide').length,
    aValider:   all.filter(p => p.gouvernance?.statut_validation === 'a_valider').length,
    enAlerte:   all.filter(p => p.gouvernance?.alerte_revue === true).length,
    categories: categories.length,
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const T = StyleSheet.create({
  // Pages
  page: {
    fontFamily: 'Helvetica', fontSize: 9, color: C.text,
    paddingTop: 36, paddingBottom: 52, paddingHorizontal: 40, backgroundColor: C.white,
  },

  // En-tête document
  docHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 20, paddingBottom: 8,
    borderBottomWidth: 2, borderBottomColor: C.gold, borderBottomStyle: 'solid',
  },
  cabinetName: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: C.navy, letterSpacing: 1.2 },
  docTitle:    { fontSize: 8, color: C.gold, letterSpacing: 0.8, marginTop: 3 },
  genDate:     { fontSize: 7, color: C.textLight, textAlign: 'right' },

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  coverMainTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 20, color: C.navy,
    letterSpacing: 0.5, marginBottom: 4, marginTop: 8,
  },
  coverSubTitle: { fontSize: 10, color: C.textMid, marginBottom: 24 },
  coverSectionTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.textMid,
    letterSpacing: 1.5, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: C.border, borderBottomStyle: 'solid', paddingBottom: 3,
  },

  // Stats globales (5 boîtes)
  coverStatsRow: { flexDirection: 'row', marginBottom: 20 },
  coverStatBox: {
    flex: 1, padding: 10, backgroundColor: C.offWhite,
    borderTopWidth: 3, borderTopStyle: 'solid', marginRight: 6,
  },
  coverStatBoxLast: { marginRight: 0 },
  coverStatNum: { fontFamily: 'Helvetica-Bold', fontSize: 22, color: C.navy, lineHeight: 1 },
  coverStatLabel: { fontSize: 7, color: C.textMid, letterSpacing: 0.3, marginTop: 3 },

  // Tableau récap catégories
  coverTable: { borderWidth: 1, borderColor: C.border, borderStyle: 'solid', marginBottom: 20 },
  coverTableHRow: { flexDirection: 'row', backgroundColor: C.navy },
  coverTableRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.border, borderTopStyle: 'solid' },
  coverTableRowAlt: { backgroundColor: C.offWhite },
  coverTHCell: { paddingVertical: 5, paddingHorizontal: 8 },
  coverTHText: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.white, letterSpacing: 0.5 },
  coverTCell: { paddingVertical: 5, paddingHorizontal: 8 },
  coverTText: { fontSize: 8.5, color: C.text },
  coverTNum:  { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.navy, textAlign: 'center' },
  coverTWarn: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.warning, textAlign: 'center' },

  // Responsable
  coverResponsableBox: {
    backgroundColor: C.infoBg, padding: 10, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: C.blue, borderLeftStyle: 'solid',
  },
  coverResponsableTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.textMid, letterSpacing: 0.8, marginBottom: 4 },
  coverResponsableText: { fontSize: 8.5, color: C.text, marginBottom: 2 },
  coverLegal: { fontSize: 7.5, color: C.textLight, fontStyle: 'italic', marginTop: 8 },

  // ── BADGES STATUT ──────────────────────────────────────────────────────────
  badgeValide:   { backgroundColor: C.successBg, paddingHorizontal: 7, paddingVertical: 3 },
  badgeAValider: { backgroundColor: C.warningBg, paddingHorizontal: 7, paddingVertical: 3 },
  badgeARevoir:  { backgroundColor: C.dangerBg,  paddingHorizontal: 7, paddingVertical: 3 },
  badgeNeutral:  { backgroundColor: C.offWhite,  paddingHorizontal: 7, paddingVertical: 3 },
  badgeTextValide:   { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.success,  letterSpacing: 0.5 },
  badgeTextAValider: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.warning,  letterSpacing: 0.5 },
  badgeTextARevoir:  { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.danger,   letterSpacing: 0.5 },
  badgeTextNeutral:  { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.textMid,  letterSpacing: 0.5 },

  // Badge compact (pour la GovTable)
  badgeSmallValide:   { backgroundColor: C.successBg, paddingHorizontal: 4, paddingVertical: 1 },
  badgeSmallAValider: { backgroundColor: C.warningBg, paddingHorizontal: 4, paddingVertical: 1 },
  badgeSmallARevoir:  { backgroundColor: C.dangerBg,  paddingHorizontal: 4, paddingVertical: 1 },
  badgeSmallNeutral:  { backgroundColor: C.offWhite,  paddingHorizontal: 4, paddingVertical: 1 },
  badgeSmallTextValide:   { fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.success },
  badgeSmallTextAValider: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.warning },
  badgeSmallTextARevoir:  { fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.danger  },
  badgeSmallTextNeutral:  { fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.textMid },

  // ── RÉSUMÉ CATÉGORIE ───────────────────────────────────────────────────────
  catTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.navy,
    marginBottom: 6, paddingBottom: 4,
    borderBottomWidth: 1.5, borderBottomColor: C.navy, borderBottomStyle: 'solid',
  },
  catSummaryRow: {
    flexDirection: 'row', backgroundColor: C.infoBg,
    paddingVertical: 6, paddingHorizontal: 8, marginBottom: 10,
  },
  catSummaryItem: { marginRight: 20 },
  catSummaryNum:  { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.navy, lineHeight: 1 },
  catSummaryLabel:{ fontSize: 6.5, color: C.textMid, letterSpacing: 0.3, marginTop: 2 },
  catSummaryWarn: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.warning, lineHeight: 1 },
  catSummaryDates:{ fontSize: 7, color: C.textLight, marginLeft: 'auto', textAlign: 'right' },

  // ── OBJECTIFS ──────────────────────────────────────────────────────────────
  subLabel: {
    fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.textMid,
    letterSpacing: 1, marginBottom: 4, marginTop: 10,
  },
  objRow:    { flexDirection: 'row', marginBottom: 10 },
  objColPos: { flex: 1, backgroundColor: C.successBg, padding: 7, marginRight: 6 },
  objColNeg: { flex: 1, backgroundColor: C.dangerBg,  padding: 7 },
  objTitle:  { fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 0.7, marginBottom: 5 },
  objTitlePos: { color: C.success },
  objTitleNeg: { color: C.danger },
  bulletRow: { flexDirection: 'row', marginBottom: 2 },
  bullet:    { width: 8, fontSize: 8, color: C.gold },
  bulletText:{ flex: 1, fontSize: 7.5, color: C.text, lineHeight: 1.4 },

  // ── GOV TABLE (vue d'ensemble) ─────────────────────────────────────────────
  table: { borderWidth: 1, borderColor: C.border, borderStyle: 'solid', marginBottom: 8 },
  tableHRow: { flexDirection: 'row', backgroundColor: C.navy },
  tHCell: { paddingVertical: 4, paddingHorizontal: 4 },
  tHText: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.white, letterSpacing: 0.3 },
  tableRow:    { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.border, borderTopStyle: 'solid' },
  tableRowAlt: { backgroundColor: C.offWhite },
  tCell:       { paddingVertical: 4, paddingHorizontal: 4 },
  mcPos:  { fontSize: 7, color: C.success, lineHeight: 1.3 },
  mcNeg:  { fontSize: 7, color: C.danger,  lineHeight: 1.3 },
  mcNull: { fontSize: 7, color: C.textLight, fontStyle: 'italic' },
  solName: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.navy, marginBottom: 1 },
  solMeta: { fontSize: 6.5, color: C.textMid, marginBottom: 2 },

  // ── PRODUCT DETAIL CARD ────────────────────────────────────────────────────
  prodCard: {
    marginBottom: 8, paddingBottom: 8,
    borderBottomWidth: 0.5, borderBottomColor: C.border, borderBottomStyle: 'solid',
  },
  prodCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  prodCardLeft:   { flex: 1 },
  prodCardRight:  { width: 90, alignItems: 'flex-end' },
  prodCardName:   { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: C.navy, marginBottom: 2 },
  prodCardMeta:   { fontSize: 7.5, color: C.textMid },
  alertBox: {
    backgroundColor: C.warningBg, paddingHorizontal: 7, paddingVertical: 4,
    borderLeftWidth: 2.5, borderLeftColor: C.warning, borderLeftStyle: 'solid',
    marginBottom: 5,
  },
  alertBoxText: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.warning },

  // ── MC TABLE (détail) ─────────────────────────────────────────────────────
  mcTable: {
    borderWidth: 0.5, borderColor: C.border, borderStyle: 'solid', marginBottom: 6,
  },
  mcHRow: { flexDirection: 'row' },
  mcHCell:{ paddingVertical: 3, paddingHorizontal: 6 },
  mcHText:{ fontFamily: 'Helvetica-Bold', fontSize: 7, letterSpacing: 0.3 },
  mcRow:    { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.border, borderTopStyle: 'solid' },
  mcRowAlt: { backgroundColor: C.offWhite },
  mcCell:   { paddingVertical: 3, paddingHorizontal: 6 },
  mcCellLabel: { fontSize: 7.5, color: C.textMid },
  mcCellPos:   { fontSize: 7.5, color: C.success },
  mcCellNeg:   { fontSize: 7.5, color: C.danger  },
  mcCellNull:  { fontSize: 7.5, color: C.textLight, fontStyle: 'italic' },

  // ── SOURCES DOCUMENTAIRES ─────────────────────────────────────────────────
  docsLabel: {
    fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.textMid,
    letterSpacing: 1, marginBottom: 3,
  },
  docRow: { flexDirection: 'row', marginBottom: 2 },
  docBullet: { width: 10, fontSize: 7, color: C.gold },
  docType:   { width: '50%', fontSize: 7.5, color: C.text },
  docDate:   { fontSize: 7.5, color: C.textMid },

  // ── ANALYSE IA ────────────────────────────────────────────────────────────
  aiBox: {
    backgroundColor: C.infoBg, paddingVertical: 5, paddingHorizontal: 7,
    marginBottom: 6, flexDirection: 'row', flexWrap: 'wrap',
    borderLeftWidth: 2, borderLeftColor: C.blue, borderLeftStyle: 'solid',
  },
  aiLabel: {
    fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.blue,
    letterSpacing: 0.8, marginRight: 12, marginBottom: 2, width: '100%',
  },
  aiItem:  { marginRight: 16 },
  aiKey:   { fontSize: 6.5, color: C.textLight },
  aiVal:   { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.textMid },

  // ── RESPONSABLE ───────────────────────────────────────────────────────────
  responsableLine: { flexDirection: 'row', marginTop: 5 },
  responsableItem: { marginRight: 16 },
  responsableKey:  { fontSize: 6.5, color: C.textLight },
  responsableVal:  { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.textMid },

  // ── FOOTER ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 18, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.5, borderTopColor: C.border, borderTopStyle: 'solid', paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: C.textLight },
})

// ── Composants atomiques ──────────────────────────────────────────────────────

function DocHeader({ genStr }: { genStr: string }) {
  return (
    <View style={T.docHeader}>
      <View>
        <Text style={T.cabinetName}>AMP CONSEIL</Text>
        <Text style={T.docTitle}>GOUVERNANCE PRODUITS — DOCUMENTATION RÉGLEMENTAIRE</Text>
      </View>
      <Text style={T.genDate}>{genStr}{'\n'}Produits actifs au catalogue uniquement</Text>
    </View>
  )
}

function Footer({ genStr }: { genStr: string }) {
  return (
    <View style={T.footer} fixed>
      <Text style={T.footerText}>Document interne de gouvernance produit — AMP CONSEIL</Text>
      <Text
        style={T.footerText}
        render={({ pageNumber, totalPages }) =>
          `${genStr} · Page ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  )
}

function StatusBadge({ statut, small }: { statut: string | null | undefined; small?: boolean }) {
  if (!statut) {
    return small
      ? <View style={T.badgeSmallNeutral}><Text style={T.badgeSmallTextNeutral}>Non configurée</Text></View>
      : <View style={T.badgeNeutral}><Text style={T.badgeTextNeutral}>NON CONFIGURÉE</Text></View>
  }
  if (statut === 'valide') return small
    ? <View style={T.badgeSmallValide}><Text style={T.badgeSmallTextValide}>VALIDÉ</Text></View>
    : <View style={T.badgeValide}><Text style={T.badgeTextValide}>VALIDÉ</Text></View>
  if (statut === 'a_valider') return small
    ? <View style={T.badgeSmallAValider}><Text style={T.badgeSmallTextAValider}>! À VALIDER</Text></View>
    : <View style={T.badgeAValider}><Text style={T.badgeTextAValider}>! À VALIDER</Text></View>
  if (statut === 'a_revoir') return small
    ? <View style={T.badgeSmallARevoir}><Text style={T.badgeSmallTextARevoir}>À REVOIR</Text></View>
    : <View style={T.badgeARevoir}><Text style={T.badgeTextARevoir}>À REVOIR</Text></View>
  return small
    ? <View style={T.badgeSmallNeutral}><Text style={T.badgeSmallTextNeutral}>{lv(VALID, statut)}</Text></View>
    : <View style={T.badgeNeutral}><Text style={T.badgeTextNeutral}>{lv(VALID, statut)}</Text></View>
}

// ── Page de couverture ────────────────────────────────────────────────────────

function CoverPageContent({ data }: { data: GouvernanceProduitsData }) {
  const gs     = globalStats(data.categories)
  const genStr = fmtDateTime(data.generatedAt)

  const statBoxes = [
    { label: 'Total produits actifs',   value: gs.total,      accent: C.navy,    warn: false },
    { label: 'Validés',                  value: gs.valides,    accent: C.success, warn: false },
    { label: 'À valider',                value: gs.aValider,   accent: C.warning, warn: gs.aValider > 0 },
    { label: 'En alerte de revue',       value: gs.enAlerte,   accent: C.danger,  warn: gs.enAlerte > 0 },
    { label: 'Catégories couvertes',     value: gs.categories, accent: C.blue,    warn: false },
  ]

  return (
    <View>
      <DocHeader genStr={genStr} />

      <Text style={T.coverMainTitle}>Gouvernance Produits</Text>
      <Text style={T.coverSubTitle}>AMP CONSEIL — Documentation réglementaire MIF2 / DDA</Text>

      <Text style={T.coverSectionTitle}>SYNTHÈSE DU CATALOGUE</Text>

      {/* 5 stat boxes */}
      <View style={T.coverStatsRow}>
        {statBoxes.map((b, i) => (
          <View
            key={b.label}
            style={[T.coverStatBox, { borderTopColor: b.accent }, i === statBoxes.length - 1 ? T.coverStatBoxLast : {}]}
          >
            <Text style={[T.coverStatNum, b.warn ? { color: b.accent } : {}]}>{b.value}</Text>
            <Text style={T.coverStatLabel}>{b.label}</Text>
          </View>
        ))}
      </View>

      {/* Tableau par catégorie */}
      <Text style={T.coverSectionTitle}>RÉPARTITION PAR CATÉGORIE</Text>
      <View style={T.coverTable}>
        <View style={T.coverTableHRow}>
          <View style={[T.coverTHCell, { width: '40%' }]}><Text style={T.coverTHText}>Catégorie</Text></View>
          <View style={[T.coverTHCell, { width: '15%' }]}><Text style={T.coverTHText}>Produits</Text></View>
          <View style={[T.coverTHCell, { width: '15%' }]}><Text style={T.coverTHText}>Validés</Text></View>
          <View style={[T.coverTHCell, { width: '15%' }]}><Text style={T.coverTHText}>À valider</Text></View>
          <View style={[T.coverTHCell, { width: '15%' }]}><Text style={T.coverTHText}>Alertes</Text></View>
        </View>
        {data.categories.map((cat, i) => {
          const s = catStats(cat.produits)
          return (
            <View key={cat.label} style={[T.coverTableRow, i % 2 === 1 ? T.coverTableRowAlt : {}]}>
              <View style={[T.coverTCell, { width: '40%' }]}><Text style={T.coverTText}>{cat.label}</Text></View>
              <View style={[T.coverTCell, { width: '15%' }]}><Text style={T.coverTNum}>{s.total}</Text></View>
              <View style={[T.coverTCell, { width: '15%' }]}><Text style={T.coverTNum}>{s.valides}</Text></View>
              <View style={[T.coverTCell, { width: '15%' }]}>
                <Text style={s.aValider > 0 ? T.coverTWarn : T.coverTNum}>{s.aValider}</Text>
              </View>
              <View style={[T.coverTCell, { width: '15%' }]}>
                <Text style={s.enAlerte > 0 ? T.coverTWarn : T.coverTNum}>{s.enAlerte}</Text>
              </View>
            </View>
          )
        })}
      </View>

      {/* Responsable */}
      <View style={T.coverResponsableBox}>
        <Text style={T.coverResponsableTitle}>RESPONSABLE GOUVERNANCE</Text>
        <Text style={T.coverResponsableText}>AMP CONSEIL</Text>
        <Text style={[T.coverResponsableText, { color: C.textMid, fontSize: 8 }]}>
          Document généré le {genStr}
        </Text>
      </View>

      <Text style={T.coverLegal}>
        Document interne de gouvernance produit — Confidentiel — Réservé à usage professionnel.
        {'\n'}Produit conformément aux exigences de la directive MIF2 (art. 16.3) et DDA (art. L. 521-1 C. assurances).
      </Text>
    </View>
  )
}

// ── Résumé catégorie ──────────────────────────────────────────────────────────

function CategorySummary({ produits }: { produits: ProduitCatPdf[] }) {
  const s = catStats(produits)
  return (
    <View style={T.catSummaryRow}>
      <View style={[T.catSummaryItem]}>
        <Text style={T.catSummaryNum}>{s.total}</Text>
        <Text style={T.catSummaryLabel}>produits</Text>
      </View>
      <View style={T.catSummaryItem}>
        <Text style={[T.catSummaryNum, { color: C.success }]}>{s.valides}</Text>
        <Text style={T.catSummaryLabel}>validés</Text>
      </View>
      <View style={T.catSummaryItem}>
        <Text style={[T.catSummaryNum, s.aValider > 0 ? T.catSummaryWarn : {}]}>{s.aValider}</Text>
        <Text style={T.catSummaryLabel}>à valider</Text>
      </View>
      <View style={T.catSummaryItem}>
        <Text style={[T.catSummaryNum, s.enAlerte > 0 ? { color: C.danger } : {}]}>{s.enAlerte}</Text>
        <Text style={T.catSummaryLabel}>en alerte</Text>
      </View>
      <View style={[T.catSummaryItem, { marginLeft: 'auto', alignItems: 'flex-end' }]}>
        {s.derniere && <Text style={T.catSummaryDates}>Dernière revue : {fmtDate(s.derniere)}</Text>}
        {s.prochaine && <Text style={T.catSummaryDates}>Prochaine revue : {fmtDate(s.prochaine)}</Text>}
      </View>
    </View>
  )
}

// ── Objectifs ─────────────────────────────────────────────────────────────────

function ObjectivesSection({ compatibles, incompatibles }: { compatibles: string[]; incompatibles: string[] }) {
  return (
    <View style={T.objRow}>
      <View style={T.objColPos}>
        <Text style={[T.objTitle, T.objTitlePos]}>A. OBJECTIFS COMPATIBLES</Text>
        {compatibles.map((o, i) => (
          <View key={i} style={T.bulletRow}>
            <Text style={T.bullet}>•</Text>
            <Text style={T.bulletText}>{o}</Text>
          </View>
        ))}
      </View>
      <View style={T.objColNeg}>
        <Text style={[T.objTitle, T.objTitleNeg]}>B. OBJECTIFS INCOMPATIBLES</Text>
        {incompatibles.map((o, i) => (
          <View key={i} style={T.bulletRow}>
            <Text style={T.bullet}>•</Text>
            <Text style={T.bulletText}>{o}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Vue d'ensemble (tableau compact) ─────────────────────────────────────────

function GovTableRow({ p, alt }: { p: ProduitCatPdf; alt: boolean }) {
  const g = p.gouvernance
  const connExpLabel = (c: string | null, e: string | null) => {
    const parts: string[] = []
    if (c) parts.push(lv(CONN, c))
    if (e) parts.push(lv(EXP, e))
    return parts.join('\n') || '—'
  }
  return (
    <View style={[T.tableRow, alt ? T.tableRowAlt : {}]}>
      <View style={[T.tCell, { width: '26%' }]}>
        <Text style={T.solName}>{p.nom}</Text>
        {p.societe_gestion && <Text style={T.solMeta}>{p.societe_gestion}</Text>}
        {p.sri !== null && <Text style={T.solMeta}>SRI {p.sri}/7</Text>}
        <StatusBadge statut={g?.statut_validation ?? null} small />
        {g?.alerte_revue && <Text style={{ fontSize: 6, color: C.danger, fontFamily: 'Helvetica-Bold', marginTop: 1 }}>Alerte revue</Text>}
      </View>
      <View style={[T.tCell, { width: '15%' }]}>
        {g ? <>
          <Text style={T.mcPos}>+ {connExpLabel(g.mc_pos_connaissance, g.mc_pos_experience)}</Text>
          <Text style={T.mcNeg}>- {connExpLabel(g.mc_neg_connaissance, g.mc_neg_experience)}</Text>
        </> : <Text style={T.mcNull}>—</Text>}
      </View>
      <View style={[T.tCell, { width: '15%' }]}>
        {g ? <>
          <Text style={T.mcPos}>+ {lv(TOL, g.mc_pos_tolerance_risque)}</Text>
          <Text style={T.mcNeg}>- {lv(TOL, g.mc_neg_tolerance_risque)}</Text>
        </> : <Text style={T.mcNull}>—</Text>}
      </View>
      <View style={[T.tCell, { width: '14%' }]}>
        {g ? <>
          <Text style={T.mcPos}>+ {lv(CAP, g.mc_pos_capacite_pertes)}</Text>
          <Text style={T.mcNeg}>- {lv(CAP, g.mc_neg_capacite_pertes)}</Text>
        </> : <Text style={T.mcNull}>—</Text>}
      </View>
      <View style={[T.tCell, { width: '14%' }]}>
        {g ? <>
          <Text style={T.mcPos}>+ {lv(ESG, g.mc_pos_sensibilite_esg)}</Text>
          <Text style={T.mcNeg}>- {lv(ESG, g.mc_neg_sensibilite_esg)}</Text>
        </> : <Text style={T.mcNull}>—</Text>}
      </View>
      <View style={[T.tCell, { width: '16%' }]}>
        {g ? <>
          <Text style={T.mcPos}>+ {lv(HOR, g.mc_pos_horizon)}</Text>
          <Text style={T.mcNeg}>- {lv(HOR, g.mc_neg_horizon)}</Text>
        </> : <Text style={T.mcNull}>—</Text>}
      </View>
    </View>
  )
}

function GovTable({ produits }: { produits: ProduitCatPdf[] }) {
  return (
    <View style={T.table}>
      <View style={T.tableHRow}>
        <View style={[T.tHCell, { width: '26%' }]}><Text style={T.tHText}>Solution</Text></View>
        <View style={[T.tHCell, { width: '15%' }]}><Text style={T.tHText}>Conn. & Expér.</Text></View>
        <View style={[T.tHCell, { width: '15%' }]}><Text style={T.tHText}>Tolérance risque</Text></View>
        <View style={[T.tHCell, { width: '14%' }]}><Text style={T.tHText}>Capacité pertes</Text></View>
        <View style={[T.tHCell, { width: '14%' }]}><Text style={T.tHText}>ESG</Text></View>
        <View style={[T.tHCell, { width: '16%' }]}><Text style={T.tHText}>Horizon</Text></View>
      </View>
      {produits.map((p, i) => <GovTableRow key={p.id} p={p} alt={i % 2 === 1} />)}
    </View>
  )
}

// ── Tableau MC détaillé ───────────────────────────────────────────────────────

function MCTableDetail({ g }: { g: GouvernanceLiteGPdf }) {
  const rows = [
    { label: 'Connaissances',                pos: lv(CONN, g.mc_pos_connaissance),     neg: lv(CONN, g.mc_neg_connaissance) },
    { label: 'Expérience',                   pos: lv(EXP,  g.mc_pos_experience),       neg: lv(EXP,  g.mc_neg_experience) },
    { label: 'Tolérance au risque',          pos: lv(TOL,  g.mc_pos_tolerance_risque), neg: lv(TOL,  g.mc_neg_tolerance_risque) },
    { label: 'Capacité à subir des pertes',  pos: lv(CAP,  g.mc_pos_capacite_pertes),  neg: lv(CAP,  g.mc_neg_capacite_pertes) },
    { label: 'Sensibilité ESG',              pos: lv(ESG,  g.mc_pos_sensibilite_esg),  neg: lv(ESG,  g.mc_neg_sensibilite_esg) },
    { label: "Horizon d'investissement",     pos: lv(HOR,  g.mc_pos_horizon),          neg: lv(HOR,  g.mc_neg_horizon) },
  ]
  return (
    <View style={T.mcTable}>
      <View style={T.mcHRow}>
        <View style={[T.mcHCell, { width: '32%' }]}><Text style={T.mcHText}>Critère</Text></View>
        <View style={[T.mcHCell, { width: '34%', backgroundColor: C.successBg }]}>
          <Text style={[T.mcHText, { color: C.success }]}>Marché cible positif</Text>
        </View>
        <View style={[T.mcHCell, { width: '34%', backgroundColor: C.dangerBg }]}>
          <Text style={[T.mcHText, { color: C.danger }]}>Marché cible négatif</Text>
        </View>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={[T.mcRow, i % 2 === 1 ? T.mcRowAlt : {}]}>
          <View style={[T.mcCell, { width: '32%' }]}><Text style={T.mcCellLabel}>{row.label}</Text></View>
          <View style={[T.mcCell, { width: '34%' }]}>
            <Text style={row.pos === '—' ? T.mcCellNull : T.mcCellPos}>{row.pos}</Text>
          </View>
          <View style={[T.mcCell, { width: '34%' }]}>
            <Text style={row.neg === '—' ? T.mcCellNull : T.mcCellNeg}>{row.neg}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Sources documentaires ─────────────────────────────────────────────────────

function DocumentsSection({ documents }: { documents: DocumentGPdf[] }) {
  if (documents.length === 0) return null
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={T.docsLabel}>SOURCES DOCUMENTAIRES</Text>
      {documents.map((d, i) => (
        <View key={i} style={T.docRow}>
          <Text style={T.docBullet}>•</Text>
          <Text style={T.docType}>{lv(DOC_TYPE, d.type)}</Text>
          <Text style={T.docDate}>{fmtDate(d.date_document)}</Text>
        </View>
      ))}
    </View>
  )
}

// ── Traçabilité IA ────────────────────────────────────────────────────────────

function AISection({ g, version_prompt }: { g: GouvernanceLiteGPdf; version_prompt: string | null }) {
  if (g.source_marche_cible !== 'deduit_ia') return null
  const score = g.score_confiance_ia !== null ? `${Math.round(g.score_confiance_ia * 100)} %` : '—'
  return (
    <View style={T.aiBox}>
      <Text style={T.aiLabel}>ANALYSE IA — TRAÇABILITÉ</Text>
      {g.modele_ia && (
        <View style={T.aiItem}>
          <Text style={T.aiKey}>Modèle</Text>
          <Text style={T.aiVal}>{g.modele_ia}</Text>
        </View>
      )}
      <View style={T.aiItem}>
        <Text style={T.aiKey}>Score de confiance</Text>
        <Text style={T.aiVal}>{score}</Text>
      </View>
      {g.date_analyse_ia && (
        <View style={T.aiItem}>
          <Text style={T.aiKey}>Date d'analyse</Text>
          <Text style={T.aiVal}>{fmtDate(g.date_analyse_ia)}</Text>
        </View>
      )}
      {version_prompt && (
        <View style={T.aiItem}>
          <Text style={T.aiKey}>Version prompt</Text>
          <Text style={T.aiVal}>{version_prompt}</Text>
        </View>
      )}
    </View>
  )
}

// ── Carte produit détaillée ───────────────────────────────────────────────────

function ProductDetailCard({ p }: { p: ProduitCatPdf }) {
  const g         = p.gouvernance
  const aValider  = g?.statut_validation === 'a_valider'
  const aRevoir   = g?.statut_validation === 'a_revoir'

  return (
    <View style={T.prodCard}>
      {/* En-tête : nom + badge statut */}
      <View style={T.prodCardHeader}>
        <View style={T.prodCardLeft}>
          <Text style={T.prodCardName}>{p.nom}</Text>
          <Text style={T.prodCardMeta}>
            {[
              p.societe_gestion,
              p.sri !== null ? `SRI ${p.sri}/7` : null,
              g ? lv(CONF, g.statut_conformite) : null,
            ].filter(Boolean).join('  ·  ')}
          </Text>
        </View>
        <View style={T.prodCardRight}>
          <StatusBadge statut={g?.statut_validation ?? null} />
          {g?.alerte_revue && (
            <View style={[T.badgeAValider, { marginTop: 3 }]}>
              <Text style={T.badgeTextAValider}>Alerte revue</Text>
            </View>
          )}
        </View>
      </View>

      {/* Avertissement visible si à valider */}
      {(aValider || aRevoir) && (
        <View style={T.alertBox}>
          <Text style={T.alertBoxText}>
            {aValider
              ? 'Ce produit est en attente de validation. La gouvernance produit doit être vérifiée avant commercialisation.'
              : 'Ce produit est signalé "À revoir". Des corrections sont requises sur la gouvernance.'}
          </Text>
        </View>
      )}

      {/* Tableau marché cible */}
      {g && <MCTableDetail g={g} />}

      {/* Sources documentaires */}
      <DocumentsSection documents={p.documents} />

      {/* Traçabilité IA */}
      {g && <AISection g={g} version_prompt={p.version_prompt} />}

      {/* Responsable & dates */}
      <View style={T.responsableLine}>
        <View style={T.responsableItem}>
          <Text style={T.responsableKey}>Responsable gouvernance</Text>
          <Text style={T.responsableVal}>AMP CONSEIL</Text>
        </View>
        {g?.date_derniere_revue && (
          <View style={T.responsableItem}>
            <Text style={T.responsableKey}>Dernière revue</Text>
            <Text style={T.responsableVal}>{fmtDate(g.date_derniere_revue)}</Text>
          </View>
        )}
        {g?.date_prochaine_revue && (
          <View style={T.responsableItem}>
            <Text style={T.responsableKey}>Prochaine revue</Text>
            <Text style={T.responsableVal}>{fmtDate(g.date_prochaine_revue)}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Document principal ────────────────────────────────────────────────────────

export function GouvernanceProduitsDocument({ data }: { data: GouvernanceProduitsData }) {
  const genStr = fmtDateTime(data.generatedAt)

  return (
    <Document>
      {/* Page 1 : synthèse */}
      <Page size="A4" style={T.page}>
        <CoverPageContent data={data} />
        <Footer genStr={genStr} />
      </Page>

      {/* Pages suivantes : détail par catégorie */}
      <Page size="A4" style={T.page}>
        <DocHeader genStr={genStr} />

        {data.categories.map((cat, i) => (
          <View key={cat.label} break={i > 0}>
            <Text style={T.catTitle}>{cat.label.toUpperCase()}</Text>

            <CategorySummary produits={cat.produits} />

            <ObjectivesSection
              compatibles={cat.objectifsCompatibles}
              incompatibles={cat.objectifsIncompatibles}
            />

            <Text style={T.subLabel}>C. VUE D'ENSEMBLE — MARCHÉ CIBLE</Text>
            <GovTable produits={cat.produits} />

            <Text style={T.subLabel}>
              {`D. DÉTAIL PAR PRODUIT — ${cat.produits.length} PRODUIT(S)`}
            </Text>
            {cat.produits.map(p => (
              <ProductDetailCard key={p.id} p={p} />
            ))}
          </View>
        ))}

        <Footer genStr={genStr} />
      </Page>
    </Document>
  )
}
