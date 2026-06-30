import { View } from '@react-pdf/renderer'
import { SectionBand } from '@/lib/pdf/shared/atoms'
import { DataTable } from '@/lib/pdf/shared/components/DataTable'
import { fmtMontant, fmtPct } from '@/lib/pdf/shared/format'
import { translate, NATURE_PASSIF } from '@/lib/pdf/shared/labels'
import type { SnapshotPrefillPassif } from '@/lib/collecte'

export function CreditsSection({
  passifs,
  chapterNumber,
}: {
  passifs: SnapshotPrefillPassif[]
  chapterNumber?: string
}) {
  return (
    <View>
      <SectionBand number={chapterNumber}>Vos passifs</SectionBand>
      <DataTable<SnapshotPrefillPassif>
        columns={[
          { key: 'nature',  header: 'Nature',             width: '16%', render: p => translate(NATURE_PASSIF, p.nature) },
          { key: 'banque',  header: 'Établissement',      width: '17%', render: p => p.banque },
          { key: 'montant', header: 'Montant emprunté',   width: '17%', align: 'right', render: p => fmtMontant(p.montant) },
          { key: 'crd',     header: 'Capital restant dû', width: '17%', align: 'right', render: p => fmtMontant(p.capital_restant_du) },
          { key: 'mens',    header: 'Mensualité',         width: '17%', align: 'right', render: p => fmtMontant(p.mensualite) },
          { key: 'taux',    header: 'Taux',               width: '16%', align: 'right', render: p => fmtPct(p.taux) },
        ]}
        rows={passifs}
        rowKey={p => p.id}
        emptyMessage="Aucun crédit déclaré"
      />
    </View>
  )
}
