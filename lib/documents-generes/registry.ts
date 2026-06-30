import React from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { SnapshotPrefill } from '@/lib/collecte'
import type { DocumentMeta } from '@/lib/pdf/shared/types'
import { KycParticulierDocument } from '@/lib/pdf/templates/kyc-particulier/kyc-document'
import type { KycParticulierPdfData } from '@/lib/pdf/templates/kyc-particulier/types'
import type { DocumentTemplateCode } from './types'

export interface TemplateRegistryEntry {
  // QUELLE version de mise en page de ce modèle — copiée dans
  // documents_generes.template_version à chaque génération.
  version: string
  render: (
    snapshot: SnapshotPrefill,
    meta: DocumentMeta
  ) => React.ReactElement<DocumentProps>
}

// Dispatch template_code → renderer. Une seule entrée aujourd'hui ; l'ajout
// d'un futur modèle (bilan_annuel, esg_annexe…) n'ajoute qu'une entrée ici,
// sans toucher au service ni à la table.
export const TEMPLATE_REGISTRY: Record<DocumentTemplateCode, TemplateRegistryEntry> = {
  kyc_particulier: {
    version: '1.0',
    render: (snapshot, meta) =>
      React.createElement(KycParticulierDocument, {
        data: { snapshot, meta } satisfies KycParticulierPdfData,
      }) as React.ReactElement<DocumentProps>,
  },
}
