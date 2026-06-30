import { View, Text } from '@react-pdf/renderer'
import { RS } from '@/lib/pdf/shared/report-styles'
import { SectionBand, SubBand } from '@/lib/pdf/shared/atoms'
import { DataTable } from '@/lib/pdf/shared/components/DataTable'
import { fmtMontant } from '@/lib/pdf/shared/format'
import { translate, NATURE_REVENU } from '@/lib/pdf/shared/labels'
import type { SnapshotPrefillBudget, SnapshotPrefillBudgetPoste } from '@/lib/collecte'

function PosteTable({
  postes,
  emptyMessage,
  translateNature,
}: {
  postes: SnapshotPrefillBudgetPoste[]
  emptyMessage: string
  // Le questionnaire ne propose une liste de natures codées que pour les
  // revenus (rev_nature) — les charges n'ont qu'un libellé libre (chg_libelle),
  // pas de code à traduire.
  translateNature: boolean
}) {
  return (
    <DataTable<SnapshotPrefillBudgetPoste>
      columns={[
        { key: 'nature',  header: 'Nature',         width: '35%', render: p => translateNature ? translate(NATURE_REVENU, p.nature) : p.nature },
        { key: 'libelle', header: 'Désignation',    width: '40%', render: p => p.libelle },
        { key: 'montant', header: 'Montant annuel', width: '25%', align: 'right', render: p => fmtMontant(p.montant_annuel) },
      ]}
      rows={postes}
      rowKey={p => p.id}
      emptyMessage={emptyMessage}
    />
  )
}

export function RevenusChargesSection({
  budget,
  chapterNumber,
}: {
  budget: SnapshotPrefillBudget
  chapterNumber?: string
}) {
  return (
    <View>
      <SectionBand number={chapterNumber}>Budget</SectionBand>

      <SubBand>Revenus</SubBand>
      <PosteTable postes={budget.revenus} emptyMessage="Aucun revenu déclaré" translateNature />

      <SubBand>Impôts et dépenses courantes</SubBand>
      <PosteTable postes={budget.charges} emptyMessage="Aucune charge déclarée" translateNature={false} />

      <View style={RS.kvRow}>
        <Text style={RS.kvLabel}>Solde annuel</Text>
        <Text style={RS.kvValue}>{fmtMontant(budget.solde_annuel)}</Text>
      </View>
    </View>
  )
}
