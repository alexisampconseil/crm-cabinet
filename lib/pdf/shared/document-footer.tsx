import { View, Text } from '@react-pdf/renderer'
import { S } from '../pdf-styles'
import type { DocumentMeta } from './types'

// Pied de page réglementaire : reproduit verbatim le bloc de mentions légales
// du cabinet (cabinet_config.mentions_legales — formulation juridique arrêtée
// par le cabinet, jamais recomposée à partir de fragments). Affiché sur
// chaque page du document (fixed).
export function DocumentFooter({ meta }: { meta: DocumentMeta }) {
  return (
    <View style={S.legalFooter} fixed>
      <Text
        style={S.legalFooterPageNum}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
      <Text style={S.legalFooterText}>{meta.mentionsLegales}</Text>
    </View>
  )
}
