import { View } from '@react-pdf/renderer'
import { SectionBand } from '@/lib/pdf/shared/atoms'
import { DataTable } from '@/lib/pdf/shared/components/DataTable'
import { fmtMontant, fmtDate } from '@/lib/pdf/shared/format'
import { translate, detailString, NATURE_IMMOBILIER, DETENU_PAR, MODE_DETENTION } from '@/lib/pdf/shared/labels'
import type { SnapshotPrefillImmobilier } from '@/lib/collecte'

export function PatrimoineImmobilierSection({
  items,
  chapterNumber,
}: {
  items: SnapshotPrefillImmobilier[]
  chapterNumber?: string
}) {
  return (
    <View>
      <SectionBand number={chapterNumber}>Patrimoine immobilier</SectionBand>
      <DataTable<SnapshotPrefillImmobilier>
        columns={[
          { key: 'nature',      header: 'Nature',             width: '18%', render: i => translate(NATURE_IMMOBILIER, i.nature) },
          { key: 'detenu',      header: 'Détenu par',         width: '16%', render: i => translate(DETENU_PAR, i.detenu_par) },
          { key: 'mode',        header: 'Mode de détention',  width: '18%', render: i => translate(MODE_DETENTION, detailString(i.detail, 'mode_detention')) },
          { key: 'acquisition', header: 'Acquisition',        width: '15%', render: i => fmtDate(i.date_acquisition) },
          { key: 'revenus',     header: 'Revenus annuels',    width: '16%', align: 'right', render: i => fmtMontant(i.revenus_annuels) },
          { key: 'valeur',      header: 'Valeur',              width: '17%', align: 'right', render: i => fmtMontant(i.valeur) },
        ]}
        rows={items}
        rowKey={i => i.id}
        emptyMessage="Aucun bien immobilier déclaré"
      />
    </View>
  )
}
