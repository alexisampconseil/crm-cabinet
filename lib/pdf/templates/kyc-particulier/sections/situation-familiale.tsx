import { View } from '@react-pdf/renderer'
import { RS } from '@/lib/pdf/shared/report-styles'
import { SectionBand, SubBand, EmptySection } from '@/lib/pdf/shared/atoms'
import { KeyValueList } from '@/lib/pdf/shared/components/KeyValueList'
import { DataTable } from '@/lib/pdf/shared/components/DataTable'
import { fmtDate, fmtBool } from '@/lib/pdf/shared/format'
import {
  translate,
  SITUATION_FAMILIALE,
  REGIME_MATRIMONIAL,
  REGIME_PACS,
  CATEGORIE_PROFESSIONNELLE,
  FILIATION,
} from '@/lib/pdf/shared/labels'
import type {
  SnapshotPrefillIdentite,
  SnapshotPrefillFoyer,
  SnapshotPrefillSituationPro,
  SnapshotPrefillEnfant,
} from '@/lib/collecte'

export function SituationFamilialeSection({
  identite,
  foyer,
  situationPro,
  chapterNumber,
}: {
  identite: SnapshotPrefillIdentite
  foyer: SnapshotPrefillFoyer
  situationPro: SnapshotPrefillSituationPro
  chapterNumber?: string
}) {
  return (
    <View>
      <SectionBand number={chapterNumber}>Votre situation familiale et professionnelle</SectionBand>

      <View style={RS.twoCol}>
        <View style={RS.twoColItem}>
          <SubBand>Vous</SubBand>
          <KeyValueList items={[
            { label: 'Nom',         value: identite.nom },
            { label: 'Prénom',      value: identite.prenom },
            { label: 'Né(e) le',    value: fmtDate(identite.date_naissance) },
            { label: 'À',           value: identite.lieu_naissance },
            { label: 'Nationalité', value: identite.nationalite },
            { label: 'Profession',  value: situationPro.client.profession },
            { label: 'Catégorie',   value: translate(CATEGORIE_PROFESSIONNELLE, situationPro.client.categorie) },
            { label: 'Employeur',   value: situationPro.client.employeur },
          ]} />
        </View>

        <View style={RS.twoColItem}>
          <SubBand>Votre conjoint</SubBand>
          {foyer.conjoint ? (
            <KeyValueList items={[
              { label: 'Nom',        value: foyer.conjoint.nom },
              { label: 'Prénom',     value: foyer.conjoint.prenom },
              { label: 'Né(e) le',  value: fmtDate(foyer.conjoint.date_naissance) },
              { label: 'À',          value: foyer.conjoint.lieu_naissance },
              { label: 'Nationalité', value: foyer.conjoint.nationalite },
              { label: 'Profession', value: situationPro.conjoint?.profession ?? foyer.conjoint.profession },
              {
                label: 'Catégorie',
                value: translate(
                  CATEGORIE_PROFESSIONNELLE,
                  situationPro.conjoint?.categorie ?? foyer.conjoint.categorie_professionnelle
                ),
              },
              { label: 'Employeur', value: situationPro.conjoint?.employeur ?? foyer.conjoint.employeur },
              { label: 'Email',     value: foyer.conjoint.email },
              { label: 'Téléphone', value: foyer.conjoint.telephone },
            ]} />
          ) : (
            <EmptySection message="Sans objet" />
          )}
        </View>
      </View>

      <SubBand>Coordonnées</SubBand>
      <KeyValueList items={[
        { label: 'Adresse', value: identite.adresse },
        {
          label: 'Code postal / Ville',
          value: [identite.code_postal, identite.ville].filter(Boolean).join(' ') || null,
        },
        { label: 'Téléphone', value: identite.telephone },
        { label: 'Email',     value: identite.email },
      ]} />

      <SubBand>Disposition</SubBand>
      <KeyValueList items={[
        { label: 'Situation', value: translate(SITUATION_FAMILIALE, foyer.situation) },
        { label: 'Régime matrimonial', value: translate(REGIME_MATRIMONIAL, foyer.regime_matrimonial) },
        { label: 'Régime PACS', value: translate(REGIME_PACS, foyer.regime_pacs) },
        { label: 'Donation au dernier vivant', value: fmtBool(foyer.donation_dernier_vivant) },
      ]} />

      <SubBand>Vos enfants</SubBand>
      <DataTable<SnapshotPrefillEnfant>
        columns={[
          { key: 'nom',       header: 'Nom',               width: '28%', render: e => e.nom },
          { key: 'prenom',    header: 'Prénom',            width: '24%', render: e => e.prenom },
          { key: 'date',      header: 'Date de naissance', width: '20%', render: e => fmtDate(e.date_naissance) },
          { key: 'charge',    header: 'À charge',          width: '13%', render: e => fmtBool(e.a_charge) },
          { key: 'filiation', header: 'Filiation',         width: '15%', render: e => translate(FILIATION, e.filiation) },
        ]}
        rows={foyer.enfants}
        rowKey={e => e.id}
        emptyMessage="Aucun enfant déclaré"
      />
    </View>
  )
}
