import { Document, Page } from '@react-pdf/renderer'
import { RS } from '@/lib/pdf/shared/report-styles'
import { CoverPage } from '@/lib/pdf/shared/components/CoverPage'
import { RunningHeader } from '@/lib/pdf/shared/components/RunningHeader'
import { DocumentReferences } from '@/lib/pdf/shared/document-references'
import { DocumentFooter } from '@/lib/pdf/shared/document-footer'
import { SignatureBlock } from '@/lib/pdf/shared/signature-block'
import { SectionBand } from '@/lib/pdf/shared/atoms'
import { SyntheseSection, KYC_CHAPITRES } from './sections/synthese'
import { SituationFamilialeSection } from './sections/situation-familiale'
import { PatrimoineImmobilierSection } from './sections/patrimoine-immobilier'
import { PatrimoineFinancierSection } from './sections/patrimoine-financier'
import { CreditsSection } from './sections/credits'
import { RevenusChargesSection } from './sections/revenus-charges'
import { PrevoyanceSection } from './sections/prevoyance'
import { FiscaliteSection } from './sections/fiscalite'
import { ObjectifsSection } from './sections/objectifs'
import type { KycParticulierPdfData } from './types'

const DOC_TYPE = 'Document de connaissance client (KYC)'

function chapitre(i: number): string {
  return KYC_CHAPITRES[i] ? String(i + 1).padStart(2, '0') : ''
}

// Composant racine du template 'kyc_particulier'. Reçoit le snapshot patrimonial
// finalisé (jamais le référentiel live) et les métadonnées du document
// (cabinet, conseiller, références, checksums) assemblées par le service
// lib/documents-generes avant le rendu.
//
// Dossier en trois temps, pensé pour la remise physique à un client : une
// page de couverture (accueil), une page de synthèse (vue d'ensemble
// chiffrée avant le détail), puis le contenu détaillé avec un en-tête
// courant répété sur chaque page — pas un long export tabulaire continu.
// Système visuel défini dans lib/pdf/shared/report-styles.ts, partagé avec
// les futurs templates de rapports patrimoniaux (rapport d'adéquation,
// bilan, ESG…) — indépendant de lib/pdf/pdf-styles.ts (gouvernance produit).
export function KycParticulierDocument({ data }: { data: KycParticulierPdfData }) {
  const { snapshot, meta } = data

  return (
    <Document
      title={`KYC — ${meta.clientNomComplet}`}
      author={meta.cabinetNom}
      subject="Connaissance client (KYC) — document réglementaire"
      creator="CRM Cabinet"
    >
      {/* Page 1 — Couverture */}
      <Page size="A4" style={RS.page}>
        <CoverPage
          meta={meta}
          documentEyebrow="Connaissance client"
          documentTitle="Document de Connaissance Client"
        />
        <DocumentFooter meta={meta} />
      </Page>

      {/* Page 2 — Synthèse */}
      <Page size="A4" style={RS.page}>
        <RunningHeader meta={meta} docType={DOC_TYPE} />
        <SyntheseSection snapshot={snapshot} />
        <DocumentFooter meta={meta} />
      </Page>

      {/* Pages 3+ — Contenu détaillé (pagination automatique) */}
      <Page size="A4" style={RS.page}>
        <RunningHeader meta={meta} docType={DOC_TYPE} fixed />

        <SituationFamilialeSection
          identite={snapshot.identite}
          foyer={snapshot.foyer}
          situationPro={snapshot.situation_professionnelle}
          chapterNumber={chapitre(0)}
        />
        <PatrimoineImmobilierSection items={snapshot.patrimoine_immobilier} chapterNumber={chapitre(1)} />
        <PatrimoineFinancierSection items={snapshot.patrimoine_financier} chapterNumber={chapitre(2)} />
        <CreditsSection passifs={snapshot.passifs} chapterNumber={chapitre(3)} />
        <RevenusChargesSection budget={snapshot.budget} chapterNumber={chapitre(4)} />
        <PrevoyanceSection prevoyance={snapshot.prevoyance} chapterNumber={chapitre(5)} />
        <FiscaliteSection fiscalite={snapshot.fiscalite} chapterNumber={chapitre(6)} />
        <ObjectifsSection objectifs={snapshot.objectifs} chapterNumber={chapitre(7)} />

        <SectionBand>Validation du document</SectionBand>
        <SignatureBlock meta={meta} />
        <DocumentReferences meta={meta} />

        <DocumentFooter meta={meta} />
      </Page>
    </Document>
  )
}
