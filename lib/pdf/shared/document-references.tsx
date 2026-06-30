import { View, Text } from '@react-pdf/renderer'
import { RS } from './report-styles'
import type { DocumentMeta } from './types'

// Bloc de références techniques — affiché en fin de document (traçabilité
// réglementaire : conseiller, cabinet, snapshot, collecte, version, checksum).
export function DocumentReferences({ meta }: { meta: DocumentMeta }) {
  return (
    <View style={RS.refBlock}>
      <View style={RS.refRow}>
        <Text style={RS.refLabel}>CONSEILLER</Text>
        <Text style={RS.refValue}>{meta.conseillerNom}</Text>
      </View>
      <View style={RS.refRow}>
        <Text style={RS.refLabel}>RÉF. CLIENT</Text>
        <Text style={RS.refValue}>{meta.clientCode ?? meta.clientNomComplet}</Text>
      </View>
      <View style={RS.refRow}>
        <Text style={RS.refLabel}>RÉF. COLLECTE</Text>
        <Text style={RS.refValue}>{meta.sessionId ?? '—'}</Text>
      </View>
      <View style={RS.refRow}>
        <Text style={RS.refLabel}>RÉF. SNAPSHOT</Text>
        <Text style={RS.refValue}>{meta.snapshotId}</Text>
      </View>
      <View style={RS.refRow}>
        <Text style={RS.refLabel}>VERSION DOC.</Text>
        <Text style={RS.refValue}>
          n°{meta.numeroSequence} — schéma {meta.versionSchema} — modèle {meta.templateVersion}
        </Text>
      </View>
      <View style={RS.refRow}>
        <Text style={RS.refLabel}>CHECKSUM</Text>
        <Text style={RS.refValue}>{meta.checksumSource}</Text>
      </View>
    </View>
  )
}
