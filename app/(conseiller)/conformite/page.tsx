import { createServerSupabase } from '@/lib/supabase'
import { logAccess } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing,
  letterSpacings, sectionLabel,
} from '@/lib/design-tokens'
import ConformiteClient from './_components/ConformiteClient'

export default async function ConformitePage() {
  const supabase = await createServerSupabase()
  await logAccess('conformite_view')

  const [clientsRes, dossiersRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, nom, prenom, email, statut, kyc_status, kyc_submitted_at, derniere_relance, encours, profil')
      .in('statut', ['prospect', 'client'])
      .order('nom'),
    supabase
      .from('documents_reglementaires')
      .select('client_id, type, date_realisation'),
  ])

  const clients = clientsRes.data ?? []
  const docs = dossiersRes.data ?? []

  return (
    <div>
      <div style={s.pageHeader}>
        <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Réglementation AMF/ACPR</span></div>
        <h1 style={s.title}>Conformité KYC</h1>
      </div>

      <ConformiteClient initialClients={clients} docs={docs} />
    </div>
  )
}

const s = {
  pageHeader: { marginBottom: spacing[8] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading,
    fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: '-0.01em',
  },
}
