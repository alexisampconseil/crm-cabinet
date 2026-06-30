import { View, Text } from '@react-pdf/renderer'
import { RS } from '../report-styles'

export interface KeyValueItem {
  label: string
  value: string | null
}

// Liste clé/valeur réutilisable par toute section de tout template de rapport
// patrimonial. Remplace l'ancien InfoRow (une bordure sous chaque ligne) par
// un espacement généreux sans séparateur systématique — effet rapport plutôt
// qu'export de données.
export function KeyValueList({ items }: { items: KeyValueItem[] }) {
  return (
    <View>
      {items.map(item => (
        <View key={item.label} style={RS.kvRow}>
          <Text style={RS.kvLabel}>{item.label}</Text>
          {item.value
            ? <Text style={RS.kvValue}>{item.value}</Text>
            : <Text style={RS.kvValueEmpty}>—</Text>}
        </View>
      ))}
    </View>
  )
}
