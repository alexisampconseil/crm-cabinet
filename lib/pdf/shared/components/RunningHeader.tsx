import { View, Text } from '@react-pdf/renderer'
import { RS } from '../report-styles'
import type { DocumentMeta } from '../types'

// En-tête courant discret pour les pages de contenu — à utiliser avec
// `fixed`, répété automatiquement par react-pdf à chaque saut de page.
// Comble le repère manquant sur les pages suivant la couverture : sans lui,
// un lecteur qui ouvre le document au milieu n'a aucune indication du
// cabinet, du client ou de la nature du document avant le pied de page.
export function RunningHeader({
  meta,
  docType,
  fixed,
}: {
  meta: DocumentMeta
  docType: string
  // À true sur une page à pagination automatique : react-pdf répète alors
  // ce bloc sur chaque page générée, comme pour DocumentFooter.
  fixed?: boolean
}) {
  return (
    <View style={RS.runningHeader} fixed={fixed}>
      <Text style={RS.runningHeaderText}>
        {meta.cabinetNom} — {meta.clientNomComplet}
      </Text>
      <Text style={RS.runningHeaderDocType}>{docType}</Text>
    </View>
  )
}
