import { StyleSheet } from '@react-pdf/renderer'

export const C = {
  navy:      '#2d4462',
  blue:      '#6381a8',
  gold:      '#b69957',
  text:      '#2a3645',
  textMid:   '#5a6a7e',
  textLight: '#8a9aac',
  border:    '#e2ddd6',
  offWhite:  '#f8f7f5',
  white:     '#ffffff',
  success:   '#3d6b4f',
  successBg: '#edf5f0',
  warning:   '#8a6d2a',
  warningBg: '#f7f2e8',
  danger:    '#7a3636',
  dangerBg:  '#f5eded',
  infoBg:    '#edf1f7',
} as const

export const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 40,
    backgroundColor: C.white,
  },

  // ── En-tête ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.gold,
    borderBottomStyle: 'solid',
  },
  cabinetName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: C.navy,
    letterSpacing: 1.5,
  },
  docType: {
    fontSize: 8,
    color: C.gold,
    letterSpacing: 1,
    marginTop: 3,
  },
  genDate: {
    fontSize: 7.5,
    color: C.textLight,
    textAlign: 'right',
  },

  // ── Sections ───────────────────────────────────────────────────────────────
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.navy,
    letterSpacing: 1.5,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },

  // ── Produit ────────────────────────────────────────────────────────────────
  productName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: C.navy,
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 3,
  },
  metaItem: {
    flexDirection: 'row',
    marginRight: 16,
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 7.5,
    color: C.textLight,
    letterSpacing: 0.5,
    marginRight: 3,
  },
  metaValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.textMid,
  },

  // ── Badges ─────────────────────────────────────────────────────────────────
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
    borderRadius: 2,
  },
  badgeText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 0.5,
  },
  warningBox: {
    backgroundColor: C.warningBg,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderLeftStyle: 'solid',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  warningBoxText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.warning,
  },

  // ── Tableau marché cible ───────────────────────────────────────────────────
  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.navy,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
  },
  tableRowAlt: {
    backgroundColor: C.offWhite,
  },
  tCell: {
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  tHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: C.white,
    letterSpacing: 0.5,
  },
  tBodyText: {
    fontSize: 8.5,
    color: C.text,
  },
  tBodyNull: {
    fontSize: 8.5,
    color: C.textLight,
    fontStyle: 'italic',
  },
  colDim: { width: '37%' },
  colMC:  { width: '31.5%' },

  // ── Lignes info clé/valeur ─────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  infoLabel: {
    width: '40%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: C.textMid,
    letterSpacing: 0.5,
  },
  infoValue: {
    flex: 1,
    fontSize: 8.5,
    color: C.text,
  },
  infoValueNull: {
    flex: 1,
    fontSize: 8.5,
    color: C.textLight,
    fontStyle: 'italic',
  },

  // ── Justifications IA ──────────────────────────────────────────────────────
  justifBlock: {
    marginBottom: 7,
  },
  justifLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: C.textMid,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  justifText: {
    fontSize: 8.5,
    color: C.text,
    lineHeight: 1.5,
  },

  // ── Liste à puces ──────────────────────────────────────────────────────────
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
    fontSize: 8.5,
    color: C.text,
  },

  // ── Pied de page ──────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: C.textLight,
  },
})
