import { StyleSheet } from '@react-pdf/renderer'
import { reportColor as C, reportFont as F, reportSpace as SP } from './theme'

// Feuille de style des rapports patrimoniaux générés (KYC, et futurs
// templates : rapport d'adéquation, bilan patrimonial, ESG…). Indépendante de
// lib/pdf/pdf-styles.ts (PDF de gouvernance produit) — aucun risque de
// régression croisée entre les deux familles de documents.
//
// Principes : bandeaux gris clair comme élément principal de hiérarchie ;
// or réservé aux filets/accents (jamais en couleur de texte de titre) ;
// pas de letter-spacing ; espacement généreux plutôt que des bordures
// systématiques.
export const RS = StyleSheet.create({
  page: {
    fontFamily: F.regular,
    fontSize: 9,
    color: C.text,
    paddingTop: 40,
    paddingBottom: 150, // espace réservé au pied de page mentions légales (inchangé)
    paddingHorizontal: SP.pageMargin,
    backgroundColor: C.white,
  },

  // ── Bandeau de chapitre — élément principal de hiérarchie ───────────────────
  sectionBand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bandBg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: SP.sectionGap,
    marginBottom: 12,
  },
  sectionBandNumber: {
    fontFamily: F.bold,
    fontSize: 10.5,
    color: C.gold,
    marginRight: 10,
  },
  sectionBandText: {
    fontFamily: F.bold,
    fontSize: 10.5,
    color: C.navy,
  },

  // ── En-tête courant (pages de contenu, fixed) ───────────────────────────────
  runningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  runningHeaderText: {
    fontSize: 7.5,
    color: C.textMid,
  },
  runningHeaderDocType: {
    fontSize: 7.5,
    color: C.textLight,
  },

  // ── Page de couverture ───────────────────────────────────────────────────
  coverCabinetName: {
    fontFamily: F.bold,
    fontSize: 14,
    color: C.navy,
  },
  coverGoldRule: {
    width: 40,
    height: 2,
    backgroundColor: C.gold,
    marginTop: 10,
    marginBottom: 70,
  },
  coverEyebrow: {
    fontSize: 9.5,
    color: C.textMid,
    marginBottom: 12,
  },
  coverTitle: {
    fontFamily: F.bold,
    fontSize: 26,
    color: C.navy,
    marginBottom: 18,
  },
  coverClientName: {
    fontFamily: F.bold,
    fontSize: 16,
    color: C.text,
    marginBottom: 50,
  },
  coverMetaRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  coverMetaLabel: {
    width: 140,
    fontSize: 8,
    color: C.textLight,
  },
  coverMetaValue: {
    fontSize: 9,
    color: C.textMid,
  },
  coverConfidentiel: {
    marginTop: 280,
    fontSize: 8.5,
    color: C.textMid,
    fontStyle: 'italic',
  },

  // ── Synthèse — indicateurs clés ─────────────────────────────────────────────
  kpiRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 8,
  },
  kpiItem: {
    flex: 1,
  },
  kpiDivider: {
    width: 1,
    backgroundColor: C.border,
    marginHorizontal: 16,
  },
  kpiLabel: {
    fontSize: 7.5,
    color: C.textMid,
    marginBottom: 5,
  },
  kpiValue: {
    fontFamily: F.bold,
    fontSize: 15,
    color: C.navy,
  },
  sommaireRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  sommaireNumber: {
    width: 28,
    fontFamily: F.bold,
    fontSize: 9,
    color: C.gold,
  },
  sommaireText: {
    fontSize: 9,
    color: C.text,
  },

  // ── Sous-titre — accentué par un filet or court, texte navy ─────────────────
  subBandWrap: {
    marginTop: SP.groupGap,
    marginBottom: 6,
  },
  subBandRule: {
    width: 16,
    height: 1.5,
    backgroundColor: C.gold,
    marginBottom: 3,
  },
  subBandText: {
    fontFamily: F.bold,
    fontSize: 9,
    color: C.navy,
  },

  // ── Layout deux colonnes (Vous / Votre conjoint) ───────────────────────────
  twoCol: {
    flexDirection: 'row',
    gap: 24,
  },
  twoColItem: {
    flex: 1,
  },

  // ── Listes clé/valeur ────────────────────────────────────────────────────
  kvRow: {
    flexDirection: 'row',
    paddingVertical: 3.5,
  },
  kvLabel: {
    width: '40%',
    fontFamily: F.regular,
    fontSize: 8,
    color: C.textMid,
  },
  kvValue: {
    flex: 1,
    fontFamily: F.regular,
    fontSize: 9,
    color: C.text,
  },
  kvValueEmpty: {
    flex: 1,
    fontSize: 9,
    color: C.textLight,
    fontStyle: 'italic',
  },

  // ── Tableaux ──────────────────────────────────────────────────────────────
  table: {
    marginTop: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.2,
    borderBottomColor: C.gold,
    borderBottomStyle: 'solid',
    paddingBottom: 5,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  tableRowAlt: {
    backgroundColor: C.rowAltBg,
  },
  tCell: {
    paddingHorizontal: 8,
  },
  tHeaderText: {
    fontFamily: F.bold,
    fontSize: 8.5,
    color: C.navy,
  },
  tBodyText: {
    fontFamily: F.regular,
    fontSize: 9,
    color: C.text,
  },
  tBodyTextRight: {
    fontFamily: F.regular,
    fontSize: 9,
    color: C.text,
    textAlign: 'right',
  },
  tBodyNull: {
    fontSize: 9,
    color: C.textLight,
    fontStyle: 'italic',
  },
  tableEmpty: {
    fontSize: 9,
    color: C.textLight,
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 4,
  },

  // ── Liste à puces (dispositifs fiscaux) ─────────────────────────────────────
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bullet: {
    fontSize: 8,
    color: C.gold,
    width: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: C.text,
  },

  // ── Références techniques (fin de document) ─────────────────────────────
  refBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
  },
  refRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  refLabel: {
    width: 95,
    fontSize: 6.5,
    color: C.textLight,
  },
  refValue: {
    flex: 1,
    fontSize: 6.5,
    color: C.textMid,
    fontFamily: 'Courier',
  },

  // ── Signatures ────────────────────────────────────────────────────────────
  faitA: {
    fontSize: 9,
    color: C.textMid,
    marginTop: 26,
    marginBottom: 4,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  signatureBox: {
    width: '47%',
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    padding: 14,
  },
  signatureLabel: {
    fontFamily: F.bold,
    fontSize: 9,
    color: C.navy,
    marginBottom: 2,
  },
  signatureSubLabel: {
    fontSize: 8,
    color: C.textLight,
    marginBottom: 56, // espace généreux pour la signature manuscrite
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: C.textMid,
    borderTopStyle: 'solid',
    paddingTop: 4,
  },
  signatureLineText: {
    fontSize: 8,
    color: C.textMid,
  },
  signatureElectroniqueNote: {
    fontSize: 7.5,
    color: C.textLight,
    fontStyle: 'italic',
    marginTop: 10,
  },
})
