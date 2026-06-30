import { View } from '@react-pdf/renderer'
import { SectionBand } from '@/lib/pdf/shared/atoms'
import { DataTable } from '@/lib/pdf/shared/components/DataTable'
import { fmtMontant } from '@/lib/pdf/shared/format'
import { translate, HORIZON_OBJECTIF } from '@/lib/pdf/shared/labels'
import type { SnapshotPrefillObjectif } from '@/lib/collecte'

export function ObjectifsSection({
  objectifs,
  chapterNumber,
}: {
  objectifs: SnapshotPrefillObjectif[]
  chapterNumber?: string
}) {
  const sorted = [...objectifs].sort((a, b) => a.priorite - b.priorite)
  return (
    <View>
      <SectionBand number={chapterNumber}>Objectifs patrimoniaux</SectionBand>
      <DataTable<SnapshotPrefillObjectif>
        columns={[
          { key: 'priorite', header: 'Priorité',      width: '15%', render: o => String(o.priorite) },
          { key: 'libelle',  header: 'Libellé',        width: '40%', render: o => o.libelle },
          { key: 'horizon',  header: 'Horizon',        width: '20%', render: o => translate(HORIZON_OBJECTIF, o.horizon) },
          { key: 'montant',  header: 'Montant cible',  width: '25%', align: 'right', render: o => fmtMontant(o.montant_cible) },
        ]}
        rows={sorted}
        rowKey={o => o.id}
        emptyMessage="Aucun objectif déclaré"
      />
    </View>
  )
}
