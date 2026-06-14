import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { S, C } from './pdf-styles'

// ── Types données ──────────────────────────────────────────────────────────────

export interface GouvernancePdf {
  id: string
  statut_conformite: string
  statut_validation: string
  source_marche_cible: string
  source_document_id: string | null
  mc_pos_connaissance: string | null
  mc_pos_experience: string | null
  mc_pos_capacite_pertes: string | null
  mc_pos_tolerance_risque: string | null
  mc_pos_horizon: string | null
  mc_pos_sensibilite_esg: string | null
  mc_neg_connaissance: string | null
  mc_neg_experience: string | null
  mc_neg_capacite_pertes: string | null
  mc_neg_tolerance_risque: string | null
  mc_neg_horizon: string | null
  mc_neg_sensibilite_esg: string | null
  frequence_revue: string | null
  date_derniere_revue: string | null
  date_prochaine_revue: string | null
  responsable_revue: string | null
  alerte_revue: boolean
  justifications_ia: Record<string, string> | null
  score_confiance_ia: number | null
  modele_ia: string | null
  date_analyse_ia: string | null
  notes_gouvernance: string | null
  public_exclu: string | null
  conditions_acces: string | null
  conflits_interet: string | null
  motif_signalement: string | null
}

export interface ProduitPdf {
  nom: string
  isin: string | null
  societe_gestion: string | null
  categorie: string
  categorie_reglementaire: string | null
  sri: number | null
  frais_entree: number | null
  frais_gestion: number | null
  frais_sortie: number | null
  duree_detention_min: number | null
}

export interface DocumentPdf {
  id: string
  type: string
  date_document: string | null
  statut: string
}

export interface ExtraitPdf {
  version_prompt: string | null
  modele_ia: string | null
  date_analyse_ia: string | null
  tokens_entree: number | null
  tokens_sortie: number | null
}

export interface PdfData {
  produit: ProduitPdf
  gouvernance: GouvernancePdf
  documents: DocumentPdf[]
  sourceDoc: DocumentPdf | null
  extrait: ExtraitPdf | null
  generatedAt: string
}

// ── Labels ─────────────────────────────────────────────────────────────────────

const CONFORMITE: Record<string, string> = {
  conforme:     'Conforme',
  en_revision:  'En révision',
  suspendu:     'Suspendu',
  non_conforme: 'Non conforme',
}
const CONFORMITE_BADGE: Record<string, { bg: string; fg: string }> = {
  conforme:     { bg: C.successBg, fg: C.success },
  en_revision:  { bg: C.warningBg, fg: C.warning },
  suspendu:     { bg: '#f3f4f6',   fg: '#4b5563' },
  non_conforme: { bg: C.dangerBg,  fg: C.danger  },
}
const VALIDATION: Record<string, string> = {
  a_valider: 'À valider',
  valide:    'Validé',
  a_revoir:  'À revoir',
}
const VALIDATION_BADGE: Record<string, { bg: string; fg: string }> = {
  a_valider: { bg: C.infoBg,    fg: C.blue    },
  valide:    { bg: C.successBg, fg: C.success },
  a_revoir:  { bg: C.warningBg, fg: C.warning },
}
const SOURCE: Record<string, string> = {
  emetteur:   'Émetteur',
  deduit_ia:  'Déduit par IA',
  manuel:     'Saisie manuelle',
}
const FREQUENCE: Record<string, string> = {
  trimestrielle: 'Trimestrielle',
  semestrielle:  'Semestrielle',
  annuelle:      'Annuelle',
}
const CAT_REG: Record<string, string> = {
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
const DOC_TYPE: Record<string, string> = {
  DICI:      'DICI',
  Brochure:  'Brochure commerciale',
  Rapport:   'Rapport annuel',
  Autre:     'Document',
}

// ── Dimensions marché cible ────────────────────────────────────────────────────

const MC_ROWS: Array<{
  posKey: string
  negKey: string
  label: string
  labels: Record<string, string>
}> = [
  {
    posKey: 'mc_pos_connaissance', negKey: 'mc_neg_connaissance',
    label: 'Connaissances',
    labels: { basique: 'Basique', informe: 'Informé', expert: 'Expert' },
  },
  {
    posKey: 'mc_pos_experience', negKey: 'mc_neg_experience',
    label: 'Expérience',
    labels: { faible: 'Faible', moyenne: 'Moyenne', elevee: 'Élevée' },
  },
  {
    posKey: 'mc_pos_capacite_pertes', negKey: 'mc_neg_capacite_pertes',
    label: 'Capacité à subir des pertes',
    labels: {
      aucune_perte:      'Aucune perte',
      pertes_limitees:   'Pertes limitées',
      perte_capital:     'Perte totale du capital',
      pertes_superieures:'Pertes > capital investi',
    },
  },
  {
    posKey: 'mc_pos_tolerance_risque', negKey: 'mc_neg_tolerance_risque',
    label: 'Tolérance au risque',
    labels: {
      tres_faible: 'Très faible (SRI 1)',
      faible:      'Faible (SRI 2-3)',
      moyenne:     'Moyenne (SRI 4)',
      elevee:      'Élevée (SRI 5-6)',
      tres_elevee: 'Très élevée (SRI 7)',
    },
  },
  {
    posKey: 'mc_pos_horizon', negKey: 'mc_neg_horizon',
    label: "Horizon d'investissement",
    labels: {
      moins_2_ans:      '< 2 ans',
      entre_2_et_5_ans: '2 à 5 ans',
      plus_5_ans:       '> 5 ans',
    },
  },
  {
    posKey: 'mc_pos_sensibilite_esg', negKey: 'mc_neg_sensibilite_esg',
    label: 'Sensibilité ESG',
    labels: { aucune: 'Aucune exigence', moderee: 'Modérée', forte: 'Forte' },
  },
]

const JUSTIF_LABELS: Record<string, string> = {
  connaissance:     'Connaissances',
  experience:       'Expérience',
  capacite_pertes:  'Capacité à subir des pertes',
  tolerance_risque: 'Tolérance au risque',
  horizon:          "Horizon d'investissement",
  sensibilite_esg:  'Sensibilité ESG',
}

// ── Utilitaires ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(iso))
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))
}

// ── Composants PDF locaux ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return <Text style={S.sectionTitle}>{children.toUpperCase()}</Text>
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={S.infoRow}>
      <Text style={S.infoLabel}>{label}</Text>
      {value
        ? <Text style={S.infoValue}>{value}</Text>
        : <Text style={S.infoValueNull}>—</Text>
      }
    </View>
  )
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[S.badge, { backgroundColor: bg }]}>
      <Text style={[S.badgeText, { color: fg }]}>{label}</Text>
    </View>
  )
}

// ── Sections du document ───────────────────────────────────────────────────────

function HeaderSection({ generatedAt }: { generatedAt: string }) {
  const dateStr = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
    .format(new Date(generatedAt))
  return (
    <View style={S.header}>
      <View>
        <Text style={S.cabinetName}>AMP CONSEIL</Text>
        <Text style={S.docType}>FICHE DE GOUVERNANCE PRODUIT</Text>
      </View>
      <Text style={S.genDate}>Généré le {dateStr}</Text>
    </View>
  )
}

function ProduitSection({ produit }: { produit: ProduitPdf }) {
  const catReg = produit.categorie_reglementaire
    ? (CAT_REG[produit.categorie_reglementaire] ?? produit.categorie_reglementaire)
    : null

  return (
    <View style={S.section}>
      <SectionTitle>Produit</SectionTitle>
      <Text style={S.productName}>{produit.nom}</Text>
      <View style={S.metaRow}>
        {produit.isin && (
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>ISIN</Text>
            <Text style={S.metaValue}>{produit.isin}</Text>
          </View>
        )}
        {produit.societe_gestion && (
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Société de gestion</Text>
            <Text style={S.metaValue}>{produit.societe_gestion}</Text>
          </View>
        )}
        {catReg && (
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Catégorie</Text>
            <Text style={S.metaValue}>{catReg}</Text>
          </View>
        )}
        {produit.sri !== null && (
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>SRI</Text>
            <Text style={S.metaValue}>{produit.sri}/7</Text>
          </View>
        )}
      </View>
      <View style={S.metaRow}>
        {produit.frais_gestion !== null && (
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Frais de gestion</Text>
            <Text style={S.metaValue}>{produit.frais_gestion} %</Text>
          </View>
        )}
        {produit.frais_entree !== null && (
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Frais d'entrée max</Text>
            <Text style={S.metaValue}>{produit.frais_entree} %</Text>
          </View>
        )}
        {produit.duree_detention_min !== null && (
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Détention min.</Text>
            <Text style={S.metaValue}>{produit.duree_detention_min} ans</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function StatutSection({ gouvernance }: { gouvernance: GouvernancePdf }) {
  const conformBadge = CONFORMITE_BADGE[gouvernance.statut_conformite] ??
    { bg: '#f3f4f6', fg: '#4b5563' }
  const validBadge = VALIDATION_BADGE[gouvernance.statut_validation] ??
    { bg: C.infoBg, fg: C.blue }
  const showIAWarning =
    gouvernance.source_marche_cible === 'deduit_ia' &&
    gouvernance.statut_validation === 'a_valider'

  return (
    <View style={S.section}>
      <SectionTitle>Statut</SectionTitle>
      <View style={S.badgeRow}>
        <Badge
          label={CONFORMITE[gouvernance.statut_conformite] ?? gouvernance.statut_conformite}
          bg={conformBadge.bg}
          fg={conformBadge.fg}
        />
        <Badge
          label={VALIDATION[gouvernance.statut_validation] ?? gouvernance.statut_validation}
          bg={validBadge.bg}
          fg={validBadge.fg}
        />
        {gouvernance.source_marche_cible === 'deduit_ia' && (
          <Badge label="Analyse IA" bg={C.infoBg} fg={C.blue} />
        )}
        {gouvernance.alerte_revue && (
          <Badge label="Alerte revue" bg={C.warningBg} fg={C.warning} />
        )}
      </View>
      {showIAWarning && (
        <View style={S.warningBox}>
          <Text style={S.warningBoxText}>
            Marché cible déduit par IA — en attente de validation par le conseiller
          </Text>
        </View>
      )}
    </View>
  )
}

function MarcheCibleSection({ gouvernance }: { gouvernance: GouvernancePdf }) {
  const g = gouvernance as unknown as Record<string, string | null>

  return (
    <View style={S.section}>
      <SectionTitle>Marché Cible (MIF2 / IDD)</SectionTitle>
      <View style={S.table}>
        {/* En-tête */}
        <View style={S.tableHeaderRow}>
          <View style={[S.tCell, S.colDim]}>
            <Text style={S.tHeaderText}>Dimension</Text>
          </View>
          <View style={[S.tCell, S.colMC]}>
            <Text style={S.tHeaderText}>Marché positif</Text>
          </View>
          <View style={[S.tCell, S.colMC]}>
            <Text style={S.tHeaderText}>Marché négatif</Text>
          </View>
        </View>
        {/* Lignes */}
        {MC_ROWS.map((row, i) => {
          const posRaw = g[row.posKey]
          const negRaw = g[row.negKey]
          const posLabel = posRaw ? (row.labels[posRaw] ?? posRaw) : null
          const negLabel = negRaw ? (row.labels[negRaw] ?? negRaw) : null
          const rowStyle = i % 2 === 1 ? [S.tableRow, S.tableRowAlt] : [S.tableRow]
          return (
            <View key={row.posKey} style={rowStyle}>
              <View style={[S.tCell, S.colDim]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.textMid }}>
                  {row.label}
                </Text>
              </View>
              <View style={[S.tCell, S.colMC]}>
                {posLabel
                  ? <Text style={S.tBodyText}>{posLabel}</Text>
                  : <Text style={S.tBodyNull}>—</Text>
                }
              </View>
              <View style={[S.tCell, S.colMC]}>
                {negLabel
                  ? <Text style={S.tBodyText}>{negLabel}</Text>
                  : <Text style={S.tBodyNull}>—</Text>
                }
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function RevueSection({ gouvernance }: { gouvernance: GouvernancePdf }) {
  return (
    <View style={S.section}>
      <SectionTitle>Revues Périodiques</SectionTitle>
      <InfoRow
        label="Fréquence"
        value={gouvernance.frequence_revue
          ? (FREQUENCE[gouvernance.frequence_revue] ?? gouvernance.frequence_revue)
          : null}
      />
      <InfoRow label="Dernière revue" value={fmtDate(gouvernance.date_derniere_revue)} />
      <InfoRow label="Prochaine revue" value={fmtDate(gouvernance.date_prochaine_revue)} />
      <InfoRow label="Responsable"     value={gouvernance.responsable_revue} />
    </View>
  )
}

function SourcesSection({
  gouvernance, documents, sourceDoc, extrait,
}: {
  gouvernance: GouvernancePdf
  documents:   DocumentPdf[]
  sourceDoc:   DocumentPdf | null
  extrait:     ExtraitPdf | null
}) {
  return (
    <View style={S.section}>
      <SectionTitle>Sources Utilisées</SectionTitle>

      {/* Documents associés au produit */}
      {documents.length > 0 && (
        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.textMid, letterSpacing: 0.5, marginBottom: 4 }}>
            DOCUMENTS PRODUIT
          </Text>
          {documents.map(doc => (
            <View key={doc.id} style={S.bulletRow}>
              <Text style={S.bullet}>›</Text>
              <Text style={S.bulletText}>
                {DOC_TYPE[doc.type] ?? doc.type}
                {doc.date_document ? ` — ${fmtDate(doc.date_document)}` : ''}
                {sourceDoc?.id === doc.id ? '  [document source IA]' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Source marché cible */}
      <InfoRow
        label="Origine marché cible"
        value={SOURCE[gouvernance.source_marche_cible] ?? gouvernance.source_marche_cible}
      />

      {/* Métadonnées IA (si source = deduit_ia) */}
      {gouvernance.source_marche_cible === 'deduit_ia' && (
        <>
          {(extrait?.modele_ia ?? gouvernance.modele_ia) && (
            <InfoRow
              label="Modèle IA"
              value={extrait?.modele_ia ?? gouvernance.modele_ia}
            />
          )}
          {(extrait?.date_analyse_ia ?? gouvernance.date_analyse_ia) && (
            <InfoRow
              label="Date d'analyse"
              value={fmtDateTime(extrait?.date_analyse_ia ?? gouvernance.date_analyse_ia)}
            />
          )}
          {gouvernance.score_confiance_ia !== null && (
            <InfoRow
              label="Score de confiance IA"
              value={`${Math.round(gouvernance.score_confiance_ia * 100)} %`}
            />
          )}
          {extrait?.version_prompt && (
            <InfoRow label="Version du prompt" value={extrait.version_prompt} />
          )}
          {extrait?.tokens_entree !== null && extrait?.tokens_entree !== undefined && (
            <InfoRow
              label="Tokens utilisés"
              value={`${extrait.tokens_entree.toLocaleString('fr-FR')} entrée · ${(extrait.tokens_sortie ?? 0).toLocaleString('fr-FR')} sortie`}
            />
          )}
        </>
      )}
    </View>
  )
}

function JustificationsSection({ justifications }: { justifications: Record<string, string> }) {
  const entries = Object.entries(justifications).filter(([, v]) => v)
  if (entries.length === 0) return null

  return (
    <View style={S.section}>
      <SectionTitle>Justifications IA</SectionTitle>
      {entries.map(([key, texte]) => (
        <View key={key} style={S.justifBlock}>
          <Text style={S.justifLabel}>
            {(JUSTIF_LABELS[key] ?? key).toUpperCase()}
          </Text>
          <Text style={S.justifText}>{texte}</Text>
        </View>
      ))}
    </View>
  )
}

// ── Document principal ─────────────────────────────────────────────────────────

export function GouvernanceDocument({ data }: { data: PdfData }) {
  const { produit, gouvernance, documents, sourceDoc, extrait, generatedAt } = data
  const shortDate = new Intl.DateTimeFormat('fr-FR').format(new Date(generatedAt))

  const hasJustifications =
    gouvernance.source_marche_cible === 'deduit_ia' &&
    gouvernance.justifications_ia !== null &&
    Object.keys(gouvernance.justifications_ia).length > 0

  return (
    <Document
      title={`Fiche Gouvernance — ${produit.nom}`}
      author="AMP CONSEIL"
      subject="Gouvernance produit MIF2/IDD"
      creator="AMP CRM"
    >
      <Page size="A4" style={S.page}>
        <HeaderSection generatedAt={generatedAt} />
        <ProduitSection produit={produit} />
        <StatutSection gouvernance={gouvernance} />
        <MarcheCibleSection gouvernance={gouvernance} />
        <RevueSection gouvernance={gouvernance} />
        <SourcesSection
          gouvernance={gouvernance}
          documents={documents}
          sourceDoc={sourceDoc}
          extrait={extrait}
        />
        {hasJustifications && (
          <JustificationsSection justifications={gouvernance.justifications_ia!} />
        )}

        {/* Pied de page */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>AMP CONSEIL — Document confidentiel</Text>
          <Text style={S.footerText}>{shortDate}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} / ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  )
}
