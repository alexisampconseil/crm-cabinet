import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'
import { logAccess } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, statusBadge, sectionLabel,
} from '@/lib/design-tokens'
import { getDocumentsByClient } from '@/lib/documents-generes'
import DownloadKycButton from './_components/DownloadKycButton'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(d))
}

export default async function MonKycPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role, client_id').eq('user_id', user.id).single()
  if (roleData?.role !== 'client' || !roleData.client_id) redirect('/login')

  const clientId = roleData.client_id
  await logAccess('client_kyc_view', `client:${clientId}`)

  const [clientRes, familleRes, responsesRes, documentsKyc] = await Promise.all([
    supabase.from('clients').select('kyc_status, kyc_submitted_at, profil').eq('id', clientId).single(),
    supabase.from('famille').select('civilite, nom, prenom, situation, profession, ville').eq('client_id', clientId).single(),
    supabase.from('kyc_responses').select('submitted_at').eq('client_id', clientId).order('submitted_at', { ascending: false }).limit(3),
    getDocumentsByClient(clientId, supabase, 'kyc_particulier'),
  ])

  const client = clientRes.data
  const famille = familleRes.data
  const responses = responsesRes.data ?? []

  const KYC_LABELS: Record<string, string> = {
    non_fait: 'Questionnaire non complété',
    en_cours: 'Questionnaire en cours',
    complet: 'Questionnaire complété',
    a_renouveler: 'Mise à jour requise',
  }
  const KYC_STYLE: Record<string, React.CSSProperties> = {
    non_fait: statusBadge.neutral, en_cours: statusBadge.warning,
    complet: statusBadge.success, a_renouveler: statusBadge.danger,
  }

  const kycStatus = client?.kyc_status ?? 'non_fait'

  return (
    <div>
      <div style={s.header}>
        <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Conformité réglementaire</span></div>
        <h1 style={s.title}>Mon questionnaire KYC</h1>
      </div>

      {/* Statut */}
      <div style={{ ...cardBase, ...s.statusCard }}>
        <div style={s.statusLeft}>
          <span style={KYC_STYLE[kycStatus]}>{KYC_LABELS[kycStatus]}</span>
          {client?.kyc_submitted_at && (
            <p style={s.statusDate}>Dernière soumission : {formatDate(client.kyc_submitted_at)}</p>
          )}
          {client?.profil && (
            <p style={s.profilText}>Profil investisseur : <strong>{client.profil}</strong></p>
          )}
        </div>
        <div style={s.statusRight}>
          {kycStatus === 'complet' ? (
            <p style={s.completMsg}>✓ Votre dossier est à jour. Merci.</p>
          ) : (
            <p style={s.pendingMsg}>
              {kycStatus === 'a_renouveler'
                ? 'Votre conseiller vous enverra prochainement un lien de mise à jour par email.'
                : 'Votre conseiller vous enverra un lien par email pour compléter ce questionnaire.'}
            </p>
          )}
        </div>
      </div>

      {/* Informations actuelles */}
      {famille && (
        <div style={{ ...cardBase, ...s.card }}>
          <h2 style={s.cardTitle}>Informations enregistrées</h2>
          <div style={s.infoGrid}>
            <InfoRow label="Nom" value={`${famille.civilite ?? ''} ${famille.prenom ?? ''} ${famille.nom ?? ''}`.trim() || '—'} />
            <InfoRow label="Situation" value={famille.situation ?? '—'} />
            <InfoRow label="Profession" value={famille.profession ?? '—'} />
            <InfoRow label="Ville" value={famille.ville ?? '—'} />
          </div>
        </div>
      )}

      {/* Historique */}
      {responses.length > 0 && (
        <div style={{ ...cardBase, ...s.card }}>
          <h2 style={s.cardTitle}>Historique des soumissions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
            {responses.map((r, i) => (
              <div key={i} style={s.historyRow}>
                <span style={s.historyDot} />
                <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text }}>
                  Questionnaire soumis le {formatDate(r.submitted_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents KYC archivés */}
      {documentsKyc.length > 0 && (
        <div style={{ ...cardBase, ...s.card }}>
          <h2 style={s.cardTitle}>Mes documents KYC</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
            {documentsKyc.map(doc => (
              <div key={doc.id} style={s.documentRow}>
                <div>
                  <p style={s.documentLabel}>KYC n°{doc.numero_sequence}</p>
                  <p style={s.documentDate}>Généré le {formatDate(doc.genere_le)}</p>
                </div>
                <DownloadKycButton archiveId={doc.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explication RGPD */}
      <div style={s.rgpdNote}>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, lineHeight: 1.8 }}>
          <strong>Vos données et confidentialité</strong> — Les informations collectées dans ce questionnaire sont utilisées exclusivement par AMP CONSEIL pour établir votre bilan patrimonial et vous fournir des recommandations personnalisées. Elles sont protégées conformément au RGPD et ne sont jamais transmises à des tiers sans votre accord explicite. Vous disposez d'un droit d'accès, de rectification et de suppression.
        </p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: spacing[1] }}>
      <span style={{
        fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
        letterSpacing: letterSpacings.label, textTransform: 'uppercase' as const, color: colors.textMid,
      }}>{label}</span>
      <span style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text }}>{value}</span>
    </div>
  )
}

const s = {
  header: { marginBottom: spacing[8] },
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
  statusCard: {
    display: 'flex',
    gap: spacing[6],
    padding: spacing[6],
    marginBottom: spacing[5],
    boxShadow: shadows.sm,
  } as React.CSSProperties,
  statusLeft: { display: 'flex', flexDirection: 'column' as const, gap: spacing[3] },
  statusDate: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid,
  },
  profilText: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text,
  },
  statusRight: { flex: 1, display: 'flex', alignItems: 'center' },
  completMsg: {
    fontFamily: fonts.body, fontSize: fontSizes.base,
    color: colors.success, fontWeight: fontWeights.medium,
  },
  pendingMsg: {
    fontFamily: fonts.body, fontSize: fontSizes.base,
    color: colors.textMid, fontWeight: fontWeights.light, lineHeight: 1.7,
  },
  card: { padding: spacing[6], boxShadow: shadows.sm, marginBottom: spacing[5] } as React.CSSProperties,
  cardTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold,
    color: colors.blueDeep, letterSpacing: letterSpacings.wide, marginBottom: spacing[5],
  },
  infoGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing[5]} ${spacing[6]}`,
  },
  historyRow: { display: 'flex', alignItems: 'center', gap: spacing[3] },
  historyDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    backgroundColor: colors.gold, flexShrink: 0,
  },
  documentRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing[3], padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.border}`,
  },
  documentLabel: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.text,
  },
  documentDate: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px',
  },
  rgpdNote: {
    backgroundColor: colors.bluePale,
    border: `1px solid ${colors.blueLight}`,
    borderLeft: `3px solid ${colors.blue}`,
    padding: spacing[5],
  },
}
