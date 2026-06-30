import { View } from '@react-pdf/renderer'
import { SectionBand, BulletRow } from '@/lib/pdf/shared/atoms'
import { KeyValueList } from '@/lib/pdf/shared/components/KeyValueList'
import { fmtMontant, fmtBool } from '@/lib/pdf/shared/format'
import type { SnapshotPrefillFiscalite } from '@/lib/collecte'

export function FiscaliteSection({
  fiscalite,
  chapterNumber,
}: {
  fiscalite: SnapshotPrefillFiscalite
  chapterNumber?: string
}) {
  return (
    <View>
      <SectionBand number={chapterNumber}>Fiscalité</SectionBand>
      <KeyValueList items={[
        { label: 'Tranche IR',      value: fiscalite.tranche_ir ? `${fiscalite.tranche_ir} %` : null },
        { label: 'Revenu fiscal',   value: fmtMontant(fiscalite.revenu_fiscal) },
        { label: 'Nombre de parts', value: fiscalite.nombre_parts !== null ? String(fiscalite.nombre_parts) : null },
        { label: 'Option barème',   value: fmtBool(fiscalite.option_bareme) },
        { label: 'IFI',             value: fmtMontant(fiscalite.ifi) },
      ]} />
      {fiscalite.dispositifs.length > 0 && (
        <View style={{ marginTop: 8 }}>
          {fiscalite.dispositifs.map(d => <BulletRow key={d}>{d}</BulletRow>)}
        </View>
      )}
    </View>
  )
}
