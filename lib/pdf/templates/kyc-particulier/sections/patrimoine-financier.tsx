import { View } from '@react-pdf/renderer'
import { SectionBand } from '@/lib/pdf/shared/atoms'
import { DataTable } from '@/lib/pdf/shared/components/DataTable'
import { fmtMontant, fmtDate } from '@/lib/pdf/shared/format'
import { translate, NATURE_FINANCIER, DETENU_PAR } from '@/lib/pdf/shared/labels'
import type { SnapshotPrefillActif } from '@/lib/collecte'

export function PatrimoineFinancierSection({
  items,
  chapterNumber,
}: {
  items: SnapshotPrefillActif[]
  chapterNumber?: string
}) {
  return (
    <View>
      <SectionBand number={chapterNumber}>Épargne</SectionBand>
      <DataTable<SnapshotPrefillActif>
        columns={[
          { key: 'nature',     header: 'Nature',        width: '18%', render: i => translate(NATURE_FINANCIER, i.nature) },
          { key: 'libelle',    header: 'Désignation',   width: '27%', render: i => i.libelle },
          { key: 'ouverture',  header: 'Ouverture',      width: '15%', render: i => fmtDate(i.date_souscription) },
          { key: 'souscrit',   header: 'Souscrit par',  width: '20%', render: i => translate(DETENU_PAR, i.souscrit_par) },
          { key: 'valeur',     header: 'Valeur estimée', width: '20%', align: 'right', render: i => fmtMontant(i.montant) },
        ]}
        rows={items}
        rowKey={i => i.id}
        emptyMessage="Aucun actif financier déclaré"
      />
    </View>
  )
}
