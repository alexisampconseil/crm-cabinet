import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'
import { logAccess } from '@/lib/supabase'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, statusBadge, sectionLabel,
} from '@/lib/design-tokens'

function formatEuros(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

export default async function ClientTableauDeBordPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'client' || !roleData.client_id) redirect('/login')

  const clientId = roleData.client_id
  await logAccess('client_tableau_bord', `client:${clientId}`)

  const [clientRes, actifsRes, biensRes, passifsRes, dossiersRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('actifs_financiers').select('nature, montant').eq('client_id', clientId),
    supabase.from('patrimoine_immobilier').select('nature, valeur').eq('client_id', clientId),
    supabase.from('passifs').select('montant').eq('client_id', clientId),
    supabase.from('dossiers').select('id, titre, statut, progression, updated_at')
      .eq('client_id', clientId).order('updated_at', { ascending: false }).limit(5),
  ])

  const client = clientRes.data
  if (!client) redirect('/login')

  const actifs = actifsRes.data ?? []
  const biens = biensRes.data ?? []
  const passifs = passifsRes.data ?? []
  const dossiers = dossiersRes.data ?? []

  const totalActifs = actifs.reduce((acc, a) => acc + (a.montant ?? 0), 0)
  const totalImmobilier = biens.reduce((acc, b) => acc + (b.valeur ?? 0), 0)
  const totalPassifs = passifs.reduce((acc, p) => acc + (p.montant ?? 0), 0)
  const patrimoineNet = totalActifs + totalImmobilier - totalPassifs

  const KYC_LABELS: Record<string, string> = {
    non_fait: 'Non fait', en_cours: 'En cours', complet: 'Complet', a_renouveler: 'À renouveler',
  }
  const KYC_STYLE: Record<string, React.CSSProperties> = {
    non_fait: statusBadge.neutral, en_cours: statusBadge.warning,
    complet: statusBadge.success, a_renouveler: statusBadge.danger,
  }

  const DOSSIER_STYLE: Record<string, React.CSSProperties> = {
    en_cours: statusBadge.info, suspendu: statusBadge.warning,
    cloture: statusBadge.success, annule: statusBadge.neutral,
  }

  return (
    <div>
      {/* En-tête */}
      <div style={s.header}>
        <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Mon espace</span></div>
        <h1 style={s.title}>Bonjour, {client.prenom}&nbsp;👋</h1>
        <p style={s.subtitle}>Voici un résumé de votre situation patrimoniale au {formatDate(new Date().toISOString())}.</p>
      </div>

      {/* KYC alert */}
      {client.kyc_status !== 'complet' && (
        <div style={s.kycAlert}>
          <span style={KYC_STYLE[client.kyc_status]}>KYC — {KYC_LABELS[client.kyc_status]}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.text }}>
              {client.kyc_status === 'a_renouveler'
                ? 'Votre questionnaire patrimonial doit être mis à jour.'
                : 'Votre questionnaire patrimonial n\'est pas encore complété.'}
            </p>
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, marginTop: '4px' }}>
              Contactez votre conseiller ou attendez son invitation par email.
            </p>
          </div>
          <Link href="/mon-kyc" style={s.kycLink}>Voir →</Link>
        </div>
      )}

      {/* Patrimoine */}
      <div style={s.patrimoineGrid}>
        <PatriCard label="Actifs financiers" value={formatEuros(totalActifs)} color={colors.blue} />
        <PatriCard label="Patrimoine immobilier" value={formatEuros(totalImmobilier)} color={colors.blueDeep} />
        <PatriCard label="Passifs / Emprunts" value={formatEuros(totalPassifs)} color={colors.danger} />
        <PatriCard label="Patrimoine net estimé" value={formatEuros(patrimoineNet)} color={colors.gold} bold />
      </div>

      <div style={s.bottom}>
        {/* Dossiers en cours */}
        <div style={{ ...cardBase, ...s.card, flex: 1 }}>
          <h2 style={s.cardTitle}>Mes dossiers en cours</h2>
          {dossiers.length === 0 ? (
            <p style={s.empty}>Aucun dossier en cours</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
              {dossiers.map(d => (
                <div key={d.id} style={s.dossierRow}>
                  <div style={{ flex: 1 }}>
                    <div style={s.dossierHead}>
                      <p style={s.dossierTitle}>{d.titre}</p>
                      <span style={DOSSIER_STYLE[d.statut] ?? statusBadge.neutral}>{d.statut}</span>
                    </div>
                    <div style={s.progressBar}>
                      <div style={{ ...s.progressFill, width: `${d.progression}%` }} />
                    </div>
                    <p style={s.dossierMeta}>{d.progression} % — màj {formatDate(d.updated_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liens rapides */}
        <div style={{ ...cardBase, ...s.card, width: '280px', flexShrink: 0 }}>
          <h2 style={s.cardTitle}>Accès rapide</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            <QuickLink href="/mon-kyc" label="Mon questionnaire KYC" icon="📋" />
            <QuickLink href="/mes-documents" label="Mes documents" icon="📁" />
            <QuickLink href="/messagerie" label="Contacter mon conseiller" icon="💬" />
          </div>
          <div style={s.contactBlock}>
            <p style={s.contactLabel}>Votre conseiller</p>
            <p style={s.contactName}>AMP CONSEIL</p>
            <a href="tel:+33682181845" style={s.contactTel}>06 82 18 18 45</a>
          </div>
        </div>
      </div>
    </div>
  )
}

function PatriCard({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{ ...cardBase, ...s.patriCard }}>
      <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, height: '3px', backgroundColor: color }} />
      <p style={s.patriLabel}>{label}</p>
      <p style={{ ...s.patriValue, color: bold ? color : colors.blueDeep, fontWeight: bold ? fontWeights.medium : fontWeights.light }}>
        {value}
      </p>
    </div>
  )
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} style={s.quickLink}>
      <span>{icon}</span>
      {label}
      <span style={{ marginLeft: 'auto', color: colors.textLight }}>→</span>
    </Link>
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
    marginBottom: spacing[2],
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textMid,
    fontWeight: fontWeights.light,
  },
  kycAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.warningBg,
    border: `1px solid ${colors.warningBorder}`,
    borderLeft: `3px solid ${colors.warning}`,
    padding: spacing[5],
    marginBottom: spacing[6],
  },
  kycLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.blue,
    textDecoration: 'none',
    fontWeight: fontWeights.medium,
    flexShrink: 0,
  },
  patrimoineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: spacing[5],
    marginBottom: spacing[6],
  },
  patriCard: {
    padding: `${spacing[5]} ${spacing[6]}`,
    position: 'relative' as const,
    overflow: 'hidden',
    boxShadow: shadows.sm,
  } as React.CSSProperties,
  patriLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  patriValue: {
    fontFamily: fonts.heading,
    fontSize: '1.5rem',
    lineHeight: 1,
  },
  bottom: {
    display: 'flex',
    gap: spacing[5],
    alignItems: 'flex-start',
  },
  card: {
    padding: spacing[6],
    boxShadow: shadows.sm,
  } as React.CSSProperties,
  cardTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.blueDeep,
    letterSpacing: letterSpacings.wide,
    marginBottom: spacing[5],
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  dossierRow: { display: 'flex', gap: spacing[3] },
  dossierHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  dossierTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  progressBar: {
    height: '4px',
    backgroundColor: colors.bluePale,
    marginBottom: '6px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  dossierMeta: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textLight,
  },
  quickLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.text,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[3]} 0`,
    borderBottom: `1px solid ${colors.border}`,
  } as React.CSSProperties,
  contactBlock: {
    marginTop: spacing[5],
    paddingTop: spacing[5],
    borderTop: `1px solid ${colors.border}`,
  },
  contactLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
    marginBottom: spacing[1],
  },
  contactName: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.blueDeep,
  },
  contactTel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.blue,
    textDecoration: 'none',
    display: 'block',
    marginTop: '4px',
  },
}
