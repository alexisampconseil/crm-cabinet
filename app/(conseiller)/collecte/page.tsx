import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, tableHeaderCell, tableCell, statusBadge,
} from '@/lib/design-tokens'
import SessionActiveActions from './_components/SessionActiveActions'

type SessionRow = {
  id: string
  type: string
  statut: string
  date_soumission: string | null
  nb_ecarts_detectes: number
  client: { nom: string; prenom: string } | null
}

type SessionActiveRow = {
  id: string
  type: string
  statut: string
  client_id: string
  created_at: string
  date_ouverture: string | null
  client: { nom: string; prenom: string; email: string | null } | null
}

const TYPE_LABELS: Record<string, string> = {
  bilan_initial:        'Bilan initial',
  mise_a_jour:          'Mise à jour',
  pre_conseil:          'Pré-conseil',
  verification_annuelle: 'Vérification annuelle',
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

export default async function CollectePage() {
  const [{ data: sessionsRaw }, { data: activesRaw }] = await Promise.all([
    supabaseAdmin
      .from('collecte_sessions')
      .select('id, type, statut, date_soumission, nb_ecarts_detectes, client:clients!client_id(nom, prenom)')
      .in('statut', ['soumis', 'en_revue', 'valide'])
      .order('date_soumission', { ascending: true }),
    supabaseAdmin
      .from('collecte_sessions')
      .select('id, type, statut, client_id, created_at, date_ouverture, client:clients!client_id(nom, prenom, email)')
      .in('statut', ['brouillon', 'en_cours'])
      .order('created_at', { ascending: false }),
  ])

  const sessions = (sessionsRaw ?? []) as unknown as SessionRow[]
  const actives  = (activesRaw ?? []) as unknown as SessionActiveRow[]

  // L'email "principal" est saisi dans l'onglet Famille (famille.email), pas
  // forcément dans clients.email — même règle de priorité que la notification
  // (app/api/collecte/sessions/[id]/notifier/route.ts).
  const clientIds = [...new Set(actives.map(a => a.client_id))]
  const { data: famillesRaw } = clientIds.length > 0
    ? await supabaseAdmin.from('famille').select('client_id, email').in('client_id', clientIds)
    : { data: [] }
  const emailParClient = new Map((famillesRaw ?? []).map(f => [f.client_id, f.email]))

  return (
    <div>
      <div style={s.pageHeader}>
        <div style={s.eyebrow}>
          <div style={s.rule} />
          <span style={sectionLabel}>Référentiel client</span>
        </div>
        <h1 style={s.title}>Collecte — Revue & Application</h1>
        <p style={s.sub}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} en attente d'action
        </p>
      </div>

      {sessions.length === 0 ? (
        <div style={{ ...cardBase, ...s.emptyCard }}>
          <p style={s.emptyText}>Aucune session en attente d'action.</p>
        </div>
      ) : (
        <div style={{ ...cardBase, boxShadow: shadows.sm }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={tableHeaderCell}>Client</th>
                <th style={tableHeaderCell}>Type</th>
                <th style={tableHeaderCell}>Soumis le</th>
                <th style={tableHeaderCell}>Écarts</th>
                <th style={tableHeaderCell}>Statut</th>
                <th style={tableHeaderCell}></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(sess => {
                const nbE = sess.nb_ecarts_detectes ?? 0
                return (
                  <tr key={sess.id}>
                    <td style={tableCell}>
                      <span style={s.clientName}>
                        {sess.client ? `${sess.client.prenom} ${sess.client.nom}` : '—'}
                      </span>
                    </td>
                    <td style={tableCell}>{TYPE_LABELS[sess.type] ?? sess.type}</td>
                    <td style={tableCell}>{formatDate(sess.date_soumission)}</td>
                    <td style={tableCell}>
                      <span style={nbE > 0 ? statusBadge.warning : statusBadge.neutral}>
                        {nbE} écart{nbE !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td style={tableCell}>
                      <span style={
                        sess.statut === 'soumis'   ? statusBadge.danger  :
                        sess.statut === 'en_revue' ? statusBadge.warning :
                        statusBadge.info
                      }>
                        {sess.statut === 'soumis'   ? 'Détection en attente' :
                         sess.statut === 'en_revue' ? 'En revue'             :
                         'À appliquer'}
                      </span>
                    </td>
                    <td style={{ ...tableCell, textAlign: 'right' as const }}>
                      <Link href={`/collecte/sessions/${sess.id}`} style={s.reviserLink}>
                        {sess.statut === 'soumis'   ? 'Relancer →' :
                         sess.statut === 'en_revue' ? 'Réviser →'  :
                         'Appliquer →'}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Collectes ouvertes ou abandonnées — brouillon / en_cours */}
      <div style={s.pageHeader2}>
        <div style={s.eyebrow}>
          <div style={s.rule} />
          <span style={sectionLabel}>Collectes ouvertes ou abandonnées</span>
        </div>
        <p style={s.sub}>
          {actives.length} session{actives.length !== 1 ? 's' : ''} non finalisée{actives.length !== 1 ? 's' : ''}
        </p>
      </div>

      {actives.length === 0 ? (
        <div style={{ ...cardBase, ...s.emptyCard }}>
          <p style={s.emptyText}>Aucune collecte ouverte ou abandonnée.</p>
        </div>
      ) : (
        <div style={{ ...cardBase, boxShadow: shadows.sm }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={tableHeaderCell}>Client</th>
                <th style={tableHeaderCell}>Type</th>
                <th style={tableHeaderCell}>Statut</th>
                <th style={tableHeaderCell}>Créée le</th>
                <th style={tableHeaderCell}>Ouverte le</th>
                <th style={tableHeaderCell}></th>
              </tr>
            </thead>
            <tbody>
              {actives.map(sess => {
                const email = emailParClient.get(sess.client_id) ?? sess.client?.email ?? null
                return (
                  <tr key={sess.id}>
                    <td style={tableCell}>
                      <span style={s.clientName}>
                        {sess.client ? `${sess.client.prenom} ${sess.client.nom}` : '—'}
                      </span>
                    </td>
                    <td style={tableCell}>{TYPE_LABELS[sess.type] ?? sess.type}</td>
                    <td style={tableCell}>
                      <span style={sess.statut === 'brouillon' ? statusBadge.neutral : statusBadge.info}>
                        {sess.statut === 'brouillon' ? 'Brouillon' : 'En cours'}
                      </span>
                    </td>
                    <td style={tableCell}>{formatDate(sess.created_at)}</td>
                    <td style={tableCell}>{formatDate(sess.date_ouverture)}</td>
                    <td style={{ ...tableCell, textAlign: 'right' as const }}>
                      <SessionActiveActions sessionId={sess.id} clientEmail={email} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const s = {
  pageHeader: { marginBottom: spacing[8] },
  pageHeader2: { marginTop: spacing[10], marginBottom: spacing[6] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  title: {
    fontFamily: fonts.heading,
    fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: '-0.01em',
    marginBottom: spacing[2],
  } as React.CSSProperties,
  sub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textMid,
  },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  clientName: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    color: colors.blueDeep,
    fontSize: fontSizes.base,
  },
  emptyCard: {
    padding: spacing[8],
    textAlign: 'center' as const,
    boxShadow: shadows.sm,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textLight,
    fontStyle: 'italic' as const,
  },
  reviserLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide,
    color: colors.blue,
    textDecoration: 'none',
  } as React.CSSProperties,
}
