import { View, Text } from '@react-pdf/renderer'
import { RS } from './report-styles'
import { fmtDate } from './format'
import type { DocumentMeta } from './types'

// Zones de signature client / conseiller. Prévues dès la V1 pour la signature
// manuscrite (impression papier) ; les colonnes signe_client_le/
// signe_conseiller_le de documents_generes restent modifiables après coup
// (seule exception au trigger d'immuabilité) pour brancher une signature
// électronique plus tard sans changer ce composant ni le schéma.
export function SignatureBlock({ meta }: { meta: DocumentMeta }) {
  return (
    <View>
      <Text style={RS.faitA}>
        Fait à : ..................................................................   Le : {fmtDate(meta.genereLe)}
      </Text>
      <View style={RS.signatureRow}>
        <View style={RS.signatureBox}>
          <Text style={RS.signatureLabel}>Signature du client</Text>
          <Text style={RS.signatureSubLabel}>Lu et approuvé</Text>
          <View style={RS.signatureLine}>
            <Text style={RS.signatureLineText}>{meta.clientNomComplet}</Text>
          </View>
        </View>
        <View style={RS.signatureBox}>
          <Text style={RS.signatureLabel}>Signature du conseiller</Text>
          <Text style={RS.signatureSubLabel}> </Text>
          <View style={RS.signatureLine}>
            <Text style={RS.signatureLineText}>{meta.conseillerNom}</Text>
          </View>
        </View>
      </View>
      {meta.modeSignature === 'electronique' && (
        <Text style={RS.signatureElectroniqueNote}>
          Ce document est signé électroniquement — voir l&apos;horodatage de
          signature associé dans le dossier client.
        </Text>
      )}
    </View>
  )
}
