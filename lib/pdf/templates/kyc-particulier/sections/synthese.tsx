import { View } from '@react-pdf/renderer'
import { SectionBand, SubBand } from '@/lib/pdf/shared/atoms'
import { KpiRow } from '@/lib/pdf/shared/components/KpiRow'
import { Sommaire } from '@/lib/pdf/shared/components/Sommaire'
import { fmtMontant } from '@/lib/pdf/shared/format'
import type { SnapshotPrefill } from '@/lib/collecte'

// Titres des chapitres du template kyc_particulier, dans l'ordre d'affichage.
// Source unique pour la numérotation des SectionBand (kyc-document.tsx) ET
// le sommaire de la page de synthèse — évite toute dérive entre les deux.
export const KYC_CHAPITRES = [
  'Votre situation familiale et professionnelle',
  'Patrimoine immobilier',
  'Épargne',
  'Vos passifs',
  'Budget',
  'Prévoyance',
  'Fiscalité',
  'Objectifs patrimoniaux',
] as const

// Photographie globale du patrimoine, calculée à la volée à partir du
// snapshot déjà collecté — agrégation d'affichage, aucune nouvelle donnée
// saisie ni stockée. Donne au lecteur la vue d'ensemble avant le détail
// poste par poste, comme tout rapport patrimonial sérieux.
export function SyntheseSection({ snapshot }: { snapshot: SnapshotPrefill }) {
  const totalFinancier   = snapshot.patrimoine_financier.reduce((acc, a) => acc + (a.montant ?? 0), 0)
  const totalImmobilier  = snapshot.patrimoine_immobilier.reduce((acc, i) => acc + (i.valeur ?? 0), 0)
  const totalPassifs     = snapshot.passifs.reduce((acc, p) => acc + (p.capital_restant_du ?? p.montant ?? 0), 0)
  const patrimoineNet    = totalFinancier + totalImmobilier - totalPassifs

  const revenusAnnuels   = snapshot.budget.revenus.reduce((acc, r) => acc + (r.montant_annuel ?? 0), 0)
  const chargesAnnuelles = snapshot.budget.charges.reduce((acc, c) => acc + (c.montant_annuel ?? 0), 0)

  return (
    <View>
      <SectionBand>Vue d&apos;ensemble</SectionBand>

      <KpiRow items={[
        { label: 'Patrimoine financier',  value: fmtMontant(totalFinancier) },
        { label: 'Patrimoine immobilier', value: fmtMontant(totalImmobilier) },
        { label: 'Passifs',               value: fmtMontant(totalPassifs) },
        { label: 'Patrimoine net',        value: fmtMontant(patrimoineNet) },
      ]} />

      <KpiRow items={[
        { label: 'Revenus annuels',        value: fmtMontant(revenusAnnuels) },
        { label: 'Charges annuelles',       value: fmtMontant(chargesAnnuelles) },
        { label: "Capacité d'épargne",      value: fmtMontant(snapshot.budget.solde_annuel) },
      ]} />

      <View style={{ marginTop: 16 }}>
        <SubBand>Sommaire</SubBand>
        <Sommaire chapitres={[...KYC_CHAPITRES]} />
      </View>
    </View>
  )
}
