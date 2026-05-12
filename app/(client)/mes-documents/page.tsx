import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'
import { logAccess } from '@/lib/supabase'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel,
} from '@/lib/design-tokens'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

const DOC_LABELS: Record<string, string> = {
  LM: 'Lettre de mission',
  DER: 'Document d\'entrée en relation',
  FICI: 'Fiche d\'information client',
  CRS: 'Déclaration CRS',
  LAB: 'Questionnaire LCB-FT',
  DICI: 'Document d\'information clé',
  autre: 'Autre document',
}

const DOC_ICONS: Record<string, string> = {
  LM: '📄', DER: '🤝', FICI: '📋', CRS: '🌍', LAB: '🔍', DICI: '📊', autre: '📎',
}

export default async function MesDocumentsPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role, client_id').eq('user_id', user.id).single()
  if (roleData?.role !== 'client' || !roleData.client_id) redirect('/login')

  const clientId = roleData.client_id
  await logAccess('client_documents_view', `client:${clientId}`)

  const { data: docs } = await supabase
    .from('documents_reglementaires')
    .select('*')
    .eq('client_id', clientId)
    .order('date_realisation', { ascending: false })

  const documents = docs ?? []

  return (
    <div>
      <div style={s.header}>
        <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Documents réglementaires</span></div>
        <h1 style={s.title}>Mes documents</h1>
      </div>

      {documents.length === 0 ? (
        <div style={{ ...cardBase, ...s.emptyCard }}>
          <p style={s.emptyIcon}>📭</p>
          <p style={s.emptyTitle}>Aucun document disponible</p>
          <p style={s.emptyText}>Vos documents réglementaires apparaîtront ici lorsque votre conseiller les aura déposés sur votre dossier.</p>
        </div>
      ) : (
        <div style={s.docsList}>
          {documents.map(doc => (
            <div key={doc.id} style={{ ...cardBase, ...s.docCard }}>
              <div style={s.docIcon}>{DOC_ICONS[doc.type] ?? '📎'}</div>
              <div style={s.docInfo}>
                <p style={s.docType}>{DOC_LABELS[doc.type] ?? doc.type}</p>
                <p style={s.docDate}>Émis le {formatDate(doc.date_realisation)}</p>
              </div>
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.docLink}
                >
                  Consulter →
                </a>
              ) : (
                <span style={s.docNoLink}>En attente</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={s.note}>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, lineHeight: 1.8 }}>
          Pour toute question concernant vos documents, contactez votre conseiller AMP CONSEIL au <strong>06 82 18 18 45</strong> ou via la messagerie sécurisée.
        </p>
      </div>
    </div>
  )
}

const s = {
  header: { marginBottom: spacing[8] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em',
  },
  emptyCard: {
    padding: spacing[10],
    boxShadow: shadows.sm,
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: spacing[3],
  } as React.CSSProperties,
  emptyIcon: { fontSize: '2.5rem' },
  emptyTitle: {
    fontFamily: fonts.body, fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium, color: colors.blueDeep,
  },
  emptyText: {
    fontFamily: fonts.body, fontSize: fontSizes.base,
    color: colors.textMid, fontWeight: fontWeights.light,
    lineHeight: 1.8, maxWidth: '420px',
  },
  docsList: { display: 'flex', flexDirection: 'column' as const, gap: spacing[3], marginBottom: spacing[6] },
  docCard: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    boxShadow: shadows.sm,
  } as React.CSSProperties,
  docIcon: {
    fontSize: '1.6rem',
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bluePale,
    flexShrink: 0,
  },
  docInfo: { flex: 1 },
  docType: {
    fontFamily: fonts.body, fontSize: fontSizes.base,
    fontWeight: fontWeights.medium, color: colors.text,
  },
  docDate: {
    fontFamily: fonts.body, fontSize: fontSizes.sm,
    color: colors.textMid, marginTop: '4px',
  },
  docLink: {
    fontFamily: fonts.body, fontSize: fontSizes.sm,
    color: colors.blue, textDecoration: 'none',
    fontWeight: fontWeights.medium, flexShrink: 0,
    letterSpacing: letterSpacings.wide,
  },
  docNoLink: {
    fontFamily: fonts.body, fontSize: fontSizes.xs,
    color: colors.textLight, flexShrink: 0,
    letterSpacing: letterSpacings.wide,
  },
  note: {
    backgroundColor: colors.offWhite,
    border: `1px solid ${colors.border}`,
    padding: spacing[4],
  },
}
