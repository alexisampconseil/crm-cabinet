import { View, Text } from '@react-pdf/renderer'
import { RS } from './report-styles'

// Petits composants d'affichage réutilisés par toutes les sections de tous
// les templates de rapports patrimoniaux générés (KYC aujourd'hui ; rapport
// d'adéquation, bilan, ESG demain).

// Bande pleine identifiant une section majeure du document (ex : "Patrimoine
// immobilier") — élément principal de hiérarchie visuelle. Le numéro de
// chapitre (ex: "02") renforce la structure narrative du document — purement
// présentationnel, ne modifie aucune donnée. Wrap: false évite qu'une bande
// ne se retrouve seule en bas de page, séparée de son contenu, lors d'un
// saut de page automatique.
export function SectionBand({ children, number }: { children: string; number?: string }) {
  return (
    <View style={RS.sectionBand} wrap={false}>
      {number && <Text style={RS.sectionBandNumber}>{number}</Text>}
      <Text style={RS.sectionBandText}>{children}</Text>
    </View>
  )
}

// Sous-titre à l'intérieur d'une section (ex : "Vous", "Votre conjoint",
// "Coordonnées", "Disposition", "Vos enfants") — accentué par un filet or
// court, jamais par une coloration du texte.
export function SubBand({ children }: { children: string }) {
  return (
    <View style={RS.subBandWrap} wrap={false}>
      <View style={RS.subBandRule} />
      <Text style={RS.subBandText}>{children}</Text>
    </View>
  )
}

export function BulletRow({ children }: { children: string }) {
  return (
    <View style={RS.bulletRow}>
      <Text style={RS.bullet}>—</Text>
      <Text style={RS.bulletText}>{children}</Text>
    </View>
  )
}

export function EmptySection({ message }: { message: string }) {
  return <Text style={RS.tableEmpty}>{message}</Text>
}
