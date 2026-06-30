import { View, Text } from '@react-pdf/renderer'
import { RS } from '../report-styles'
import { fmtDate } from '../format'
import type { DocumentMeta } from '../types'

// Page de garde générique, réutilisable par tout template de rapport
// patrimonial (KYC aujourd'hui ; rapport d'adéquation, bilan, ESG demain).
// Donne au document son accueil — premier contact du lecteur avec le
// dossier, avant tout contenu.
export function CoverPage({
  meta,
  documentTitle,
  documentEyebrow,
}: {
  meta: DocumentMeta
  documentTitle: string
  documentEyebrow: string
}) {
  return (
    <View>
      <Text style={RS.coverCabinetName}>{meta.cabinetNom}</Text>
      <View style={RS.coverGoldRule} />

      <Text style={RS.coverEyebrow}>{documentEyebrow}</Text>
      <Text style={RS.coverTitle}>{documentTitle}</Text>
      <Text style={RS.coverClientName}>{meta.clientNomComplet}</Text>

      <View style={RS.coverMetaRow}>
        <Text style={RS.coverMetaLabel}>Date de génération</Text>
        <Text style={RS.coverMetaValue}>{fmtDate(meta.genereLe)}</Text>
      </View>
      <View style={RS.coverMetaRow}>
        <Text style={RS.coverMetaLabel}>Référence du document</Text>
        <Text style={RS.coverMetaValue}>
          {meta.clientCode ?? meta.clientNomComplet} — n°{meta.numeroSequence}
        </Text>
      </View>
      <View style={RS.coverMetaRow}>
        <Text style={RS.coverMetaLabel}>Conseiller</Text>
        <Text style={RS.coverMetaValue}>{meta.conseillerNom}</Text>
      </View>

      <Text style={RS.coverConfidentiel}>
        Document confidentiel — usage strictement personnel et réservé au
        destinataire.
      </Text>
    </View>
  )
}
