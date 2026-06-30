import { Fragment } from 'react'
import { View, Text } from '@react-pdf/renderer'
import { RS } from '../report-styles'

export interface KpiItem {
  label: string
  value: string
}

// Rangée d'indicateurs clés — réutilisable par toute page de synthèse d'un
// rapport patrimonial (KYC aujourd'hui ; bilan patrimonial, rapport
// d'adéquation demain). Les valeurs sont déjà formatées par l'appelant
// (agrégation d'affichage à partir de données existantes, pas une nouvelle
// donnée stockée).
export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <View style={RS.kpiRow}>
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <View style={RS.kpiDivider} />}
          <View style={RS.kpiItem}>
            <Text style={RS.kpiLabel}>{item.label}</Text>
            <Text style={RS.kpiValue}>{item.value}</Text>
          </View>
        </Fragment>
      ))}
    </View>
  )
}
