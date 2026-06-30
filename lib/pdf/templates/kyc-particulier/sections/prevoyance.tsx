import { View } from '@react-pdf/renderer'
import { SectionBand, SubBand } from '@/lib/pdf/shared/atoms'
import { KeyValueList } from '@/lib/pdf/shared/components/KeyValueList'
import { DataTable } from '@/lib/pdf/shared/components/DataTable'
import { fmtBool, fmtMontant } from '@/lib/pdf/shared/format'
import { translate, NATURE_PREVOYANCE } from '@/lib/pdf/shared/labels'
import type { SnapshotPrefillPrevoyance, SnapshotPrefillContratPrevoyance } from '@/lib/collecte'

export function PrevoyanceSection({
  prevoyance,
  chapterNumber,
}: {
  prevoyance: SnapshotPrefillPrevoyance
  chapterNumber?: string
}) {
  return (
    <View>
      <SectionBand number={chapterNumber}>Prévoyance</SectionBand>
      <KeyValueList items={[
        { label: 'Testament', value: fmtBool(prevoyance.testament) },
        {
          label: 'Droits retraite estimés',
          value: prevoyance.droits_retraite_estimes !== null
            ? `${prevoyance.droits_retraite_estimes} €/mois`
            : null,
        },
      ]} />

      <SubBand>Contrats</SubBand>
      <DataTable<SnapshotPrefillContratPrevoyance>
        columns={[
          { key: 'nature',    header: 'Nature',    width: '34%', render: c => translate(NATURE_PREVOYANCE, c.nature) },
          { key: 'compagnie', header: 'Compagnie', width: '33%', render: c => c.compagnie },
          { key: 'montant',   header: 'Montant',   width: '33%', align: 'right', render: c => fmtMontant(c.montant) },
        ]}
        rows={prevoyance.contrats}
        rowKey={c => c.id}
        emptyMessage="Aucun contrat de prévoyance déclaré"
      />
    </View>
  )
}
