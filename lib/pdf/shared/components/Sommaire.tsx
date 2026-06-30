import { View, Text } from '@react-pdf/renderer'
import { RS } from '../report-styles'

// Liste numérotée des chapitres du document — réutilisable par toute page de
// synthèse d'un rapport patrimonial.
export function Sommaire({ chapitres }: { chapitres: string[] }) {
  return (
    <View>
      {chapitres.map((titre, i) => (
        <View key={titre} style={RS.sommaireRow}>
          <Text style={RS.sommaireNumber}>{String(i + 1).padStart(2, '0')}</Text>
          <Text style={RS.sommaireText}>{titre}</Text>
        </View>
      ))}
    </View>
  )
}
