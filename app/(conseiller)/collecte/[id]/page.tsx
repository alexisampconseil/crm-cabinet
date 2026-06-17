import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { SessionEcart, CollecteSession } from '@/lib/collecte'
import EcartsClient from './_components/EcartsClient'
import RelanceDetectionButton from './_components/RelanceDetectionButton'
import {
  colors, fonts, fontSizes, fontWeights, spacing,
  sectionLabel, letterSpacings, cardBase, shadows,
} from '@/lib/design-tokens'

type SessionWithClient = CollecteSession & {
  client: { nom: string; prenom: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  bilan_initial:        'Bilan initial',
  mise_a_jour:          'Mise à jour',
  pre_conseil:          'Pré-conseil',
  verification_annuelle: 'Vérification annuelle',
}

const IMPACT_PRIORITY: Record<string, number> = { critique: 0, fort: 1, moyen: 2, faible: 3 }
const STATUT_PRIORITY: Record<string, number> = { a_revoir: 0, accepte: 1, rejete: 2, traite: 3 }

function sortEcarts(ecarts: SessionEcart[]): SessionEcart[] {
  return [...ecarts].sort((a, b) => {
    const sp = (STATUT_PRIORITY[a.statut] ?? 99) - (STATUT_PRIORITY[b.statut] ?? 99)
    if (sp !== 0) return sp
    return (IMPACT_PRIORITY[a.niveau_impact] ?? 99) - (IMPACT_PRIORITY[b.niveau_impact] ?? 99)
  })
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

export default async function CollecteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: sessionId } = await params

  const sessionRes = await supabaseAdmin
    .from('collecte_sessions')
    .select('*, client:clients!client_id(nom, prenom)')
    .eq('id', sessionId)
    .in('statut', ['soumis', 'en_revue', 'valide'])
    .maybeSingle()

  if (!sessionRes.data) notFound()

  const session   = sessionRes.data as SessionWithClient
  const isSoumis  = session.statut === 'soumis'

  // Écarts non chargés pour les sessions soumis (détection incomplète)
  let ecarts: SessionEcart[] = []
  if (!isSoumis) {
    const ecartsRes = await supabaseAdmin
      .from('session_ecarts')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    ecarts = sortEcarts((ecartsRes.data ?? []) as SessionEcart[])
  }

  const nbTotal   = ecarts.length
  const nbARevoir = ecarts.filter(e => e.statut === 'a_revoir').length

  return (
    <div>
      <div style={s.pageHeader}>
        <Link href="/collecte" style={s.backLink}>← Retour à la liste</Link>

        <div style={s.eyebrow}>
          <div style={s.rule} />
          <span style={sectionLabel}>
            {isSoumis ? 'Collecte — Détection en attente' : 'Revue des écarts'}
          </span>
        </div>

        <h1 style={s.title}>
          {session.client
            ? `${session.client.prenom} ${session.client.nom}`
            : 'Client'}
        </h1>

        <div style={s.meta}>
          <span style={s.metaItem}>{TYPE_LABELS[session.type] ?? session.type}</span>
          <span style={s.metaDot}>·</span>
          <span style={s.metaItem}>Soumis le {formatDate(session.date_soumission)}</span>
          <span style={s.metaDot}>·</span>
          <span style={s.metaItem}>
            {isSoumis
              ? 'Détection des écarts en attente'
              : nbARevoir > 0
                ? `${nbARevoir} / ${nbTotal} écart${nbTotal !== 1 ? 's' : ''} à décider`
                : `${nbTotal} écart${nbTotal !== 1 ? 's' : ''} — tous décidés`}
          </span>
        </div>
      </div>

      {isSoumis ? (
        <div style={{ ...cardBase, ...s.relanceCard }}>
          <p style={s.relanceText}>
            La détection automatique des écarts n&apos;a pas abouti lors de la soumission.
            Relancez-la pour poursuivre la revue.
          </p>
          <RelanceDetectionButton sessionId={sessionId} />
        </div>
      ) : (
        <EcartsClient
          initialEcarts={ecarts}
          sessionId={sessionId}
          initialStatut={session.statut as 'en_revue' | 'valide'}
        />
      )}
    </div>
  )
}

const s = {
  pageHeader: { marginBottom: spacing[8] },
  relanceCard: {
    padding: spacing[8],
    boxShadow: shadows.sm,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[5],
  },
  relanceText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textMid,
    margin: 0,
  },
  backLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide,
    color: colors.blue,
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: spacing[5],
  } as React.CSSProperties,
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  title: {
    fontFamily: fonts.heading,
    fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: '-0.01em',
    marginBottom: spacing[3],
  } as React.CSSProperties,
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap' as const,
  },
  metaItem: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
  },
  metaDot: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textLight,
  },
}
