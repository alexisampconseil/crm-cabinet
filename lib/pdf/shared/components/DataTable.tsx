import { View, Text } from '@react-pdf/renderer'
import { RS } from '../report-styles'

// Tableau générique réutilisable par toute section de tout template de
// rapport patrimonial (KYC aujourd'hui ; rapport d'adéquation, bilan, ESG
// demain) — évite de dupliquer la mise en page d'un tableau dans chaque
// fichier de section.
export interface DataTableColumn<Row> {
  key: string
  header: string
  width: string
  align?: 'left' | 'right'
  // Retourne la valeur déjà formatée pour l'affichage, ou null — une valeur
  // null s'affiche comme un tiret discret plutôt qu'une case vide ambiguë.
  render: (row: Row) => string | null
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  emptyMessage: string
}

export function DataTable<Row>({ columns, rows, rowKey, emptyMessage }: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <Text style={RS.tableEmpty}>{emptyMessage}</Text>
  }

  return (
    <View style={RS.table}>
      <View style={RS.tableHeaderRow}>
        {columns.map(col => (
          <View key={col.key} style={[RS.tCell, { width: col.width }]}>
            <Text style={[RS.tHeaderText, ...(col.align === 'right' ? [{ textAlign: 'right' as const }] : [])]}>
              {col.header}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row, i) => {
        const rowStyle = i % 2 === 1 ? [RS.tableRow, RS.tableRowAlt] : [RS.tableRow]
        return (
          <View key={rowKey(row)} style={rowStyle}>
            {columns.map(col => {
              const value = col.render(row)
              return (
                <View key={col.key} style={[RS.tCell, { width: col.width }]}>
                  {value
                    ? <Text style={col.align === 'right' ? RS.tBodyTextRight : RS.tBodyText}>{value}</Text>
                    : <Text style={RS.tBodyNull}>—</Text>}
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}
