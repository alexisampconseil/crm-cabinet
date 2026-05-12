import { createServerSupabase, logAccess } from '@/lib/supabase'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, statusBadge,
} from '@/lib/design-tokens'

interface RelanceRow {
  id: string
  client_id: string
  type: string
  sent_at: string
  email: string | null
  clients: { nom: string; prenom: string } | null
}

interface DossierRow {
  id: string
  client_id: string
  titre: string
  statut: string
  updated_at: string
  clients: { nom: string; prenom: string } | null
}

interface ClientAlerte {
  id: string
  nom: string
  prenom: string
  email: string | null
  kyc_status: string
  derniere_relance: string | null
}

function formatDate(d: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR', opts ?? { dateStyle: 'short' }).format(new Date(d))
}

function daysAgo(d: string | null) {
  if (!d) return null
  const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Aujourd\'hui'
  if (days === 1) return 'Hier'
  return `Il y a ${days} jours`
}

const TYPE_LABELS: Record<string, string> = {
  kyc_initial: 'KYC initial',
  kyc_renouvellement: 'KYC renouvellement',
  anniversaire: 'Bilan anniversaire',
  relance_rdv: 'Relance RDV',
}

const KYC_LABELS: Record<string, string> = {
  non_fait: 'Questionnaire manquant',
  a_renouveler: 'Mise à jour requise',
}

export default async function AgendaPage() {
  const supabase = await createServerSupabase()
  await logAccess('agenda_view')

  const [relancesRes, dossiersRes, alertesKycRes] = await Promise.all([
    supabase
      .from('relances')
      .select('*, clients(nom, prenom)')
      .order('sent_at', { ascending: false })
      .limit(30),
    supabase
      .from('dossiers')
      .select('id, client_id, titre, statut, updated_at, clients(nom, prenom)')
      .eq('statut', 'en_cours')
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('clients')
      .select('id, nom, prenom, email, kyc_status, derniere_relance')
      .in('kyc_status', ['non_fait', 'a_renouveler'])
      .eq('statut', 'client')
      .order('derniere_relance', { ascending: true, nullsFirst: true })
      .limit(20),
  ])

  const relances = (relancesRes.data ?? []) as unknown as RelanceRow[]
  const dossiers = (dossiersRes.data ?? []) as unknown as DossierRow[]
  const alertesKyc = (alertesKycRes.data ?? []) as unknown as ClientAlerte[]

  const DOSSIER_BADGE: Record<string, React.CSSProperties> = {
    en_cours: statusBadge.info, suspendu: statusBadge.warning,
    cloture: statusBadge.success, annule: statusBadge.neutral,
  }

  return (
    <div>
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Suivi & relances</span></div>
          <h1 style={s.title}>Agenda & activité</h1>
        </div>
        <div style={{ display: 'flex', gap: spacing[5] }}>
          <AgendaKpi label="Alertes KYC" value={alertesKyc.length} color={alertesKyc.length > 0 ? colors.danger : colors.success} />
          <AgendaKpi label="Dossiers actifs" value={dossiers.length} color={colors.blue} />
          <AgendaKpi label="Relances envoyées" value={relances.length} color={colors.gold} />
        </div>
      </div>

      <div style={s.layout}>
        {/* Colonne principale */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: spacing[5] }}>

          {/* Alertes KYC prioritaires */}
          {alertesKyc.length > 0 && (
            <div style={{ ...cardBase, boxShadow: shadows.sm, overflow: 'hidden', borderLeft: `3px solid ${colors.danger}` } as React.CSSProperties}>
              <div style={{ ...s.sectionHead, borderBottom: `1px solid ${colors.border}` }}>
                <h2 style={{ ...s.cardTitle, color: colors.danger }}>Alertes KYC — Action requise</h2>
                <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>{alertesKyc.length} client{alertesKyc.length > 1 ? 's' : ''}</span>
              </div>
              <div>
                {alertesKyc.map(c => (
                  <div key={c.id} style={s.alertRow}>
                    <div style={s.alertLeft}>
                      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.text }}>
                        {c.prenom} {c.nom}
                      </p>
                      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px' }}>
                        {KYC_LABELS[c.kyc_status] ?? c.kyc_status}
                        {c.derniere_relance ? ` — Dernière relance : ${daysAgo(c.derniere_relance)}` : ' — Jamais relancé'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
                      <span style={c.kyc_status === 'a_renouveler' ? statusBadge.danger : statusBadge.neutral}>
                        {c.kyc_status === 'a_renouveler' ? 'À renouveler' : 'Non fait'}
                      </span>
                      <Link href={`/clients/${c.id}`} style={s.viewLink}>Fiche →</Link>
                      <Link href="/conformite" style={{ ...s.viewLink, color: colors.danger }}>Relancer →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alertesKyc.length === 0 && (
            <div style={{ ...cardBase, padding: spacing[6], boxShadow: shadows.sm, borderLeft: `3px solid ${colors.success}`, display: 'flex', alignItems: 'center', gap: spacing[4] } as React.CSSProperties}>
              <span style={{ fontSize: '1.4rem' }}>✓</span>
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.success, fontWeight: fontWeights.medium }}>
                Aucune alerte KYC en attente. Tous les clients actifs sont à jour.
              </p>
            </div>
          )}

          {/* Historique des relances */}
          <div style={{ ...cardBase, boxShadow: shadows.sm, overflow: 'hidden' } as React.CSSProperties}>
            <div style={{ ...s.sectionHead, borderBottom: `1px solid ${colors.border}` }}>
              <h2 style={s.cardTitle}>Relances envoyées</h2>
              <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight }}>{relances.length} au total</span>
            </div>
            {relances.length === 0 ? (
              <p style={{ padding: spacing[6], fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>
                Aucune relance envoyée. Utilisez le module Conformité pour envoyer un questionnaire KYC par email.
              </p>
            ) : (
              <div>
                {relances.map(r => (
                  <div key={r.id} style={s.relanceRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: '3px' }}>
                        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.text }}>
                          {r.clients ? `${r.clients.prenom} ${r.clients.nom}` : '—'}
                        </p>
                        <span style={statusBadge.info}>{TYPE_LABELS[r.type] ?? r.type}</span>
                      </div>
                      {r.email && (
                        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid }}>
                          Envoyée à : {r.email}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid }}>
                        {formatDate(r.sent_at, { dateStyle: 'medium' })}
                      </p>
                      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: '2px' }}>
                        {daysAgo(r.sent_at)}
                      </p>
                    </div>
                    <Link href={`/clients/${r.client_id}`} style={s.viewLink}>→</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: spacing[5] }}>

          {/* Dossiers en cours */}
          <div style={{ ...cardBase, ...s.sideCard }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Dossiers en cours</h2>
            {dossiers.length === 0 ? (
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>Aucun dossier actif.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: spacing[3] }}>
                {dossiers.map(d => (
                  <Link key={d.id} href={`/clients/${d.client_id}`} style={s.dossierLink}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{d.titre}</p>
                      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px' }}>
                        {d.clients ? `${d.clients.prenom} ${d.clients.nom}` : '—'}
                      </p>
                    </div>
                    <span style={DOSSIER_BADGE[d.statut] ?? statusBadge.neutral}>{d.statut}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Liens utiles */}
          <div style={{ ...cardBase, ...s.sideCard }}>
            <h2 style={{ ...s.cardTitle, marginBottom: spacing[4] }}>Accès rapide</h2>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: spacing[2] }}>
              <QuickLink href="/conformite" label="Gérer la conformité" icon="🛡️" />
              <QuickLink href="/clients" label="Liste des clients" icon="👥" />
              <QuickLink href="/reporting" label="Tableau de bord" icon="📊" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AgendaKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'right' as const }}>
      <p style={{ fontFamily: fonts.heading, fontSize: '2rem', fontWeight: fontWeights.light, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, letterSpacing: letterSpacings.wide, textTransform: 'uppercase' as const }}>{label}</p>
    </div>
  )
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} style={{
      fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text,
      textDecoration: 'none', display: 'flex', alignItems: 'center',
      gap: spacing[3], padding: `${spacing[3]} 0`,
      borderBottom: `1px solid ${colors.border}`,
    } as React.CSSProperties}>
      <span>{icon}</span>
      {label}
      <span style={{ marginLeft: 'auto', color: colors.textLight }}>→</span>
    </Link>
  )
}

const s = {
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing[8] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: { fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)', fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em' },
  layout: { display: 'flex', gap: spacing[6], alignItems: 'flex-start' },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing[4]} ${spacing[5]}` },
  cardTitle: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep, letterSpacing: letterSpacings.wide },
  alertRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing[4], padding: `${spacing[4]} ${spacing[5]}`,
    borderBottom: `1px solid ${colors.border}`,
  },
  alertLeft: { flex: 1, minWidth: 0 },
  relanceRow: {
    display: 'flex', alignItems: 'center', gap: spacing[4],
    padding: `${spacing[4]} ${spacing[5]}`, borderBottom: `1px solid ${colors.border}`,
  },
  viewLink: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue, textDecoration: 'none', fontWeight: fontWeights.medium, flexShrink: 0 },
  sideCard: { padding: spacing[5], boxShadow: shadows.sm } as React.CSSProperties,
  dossierLink: {
    display: 'flex', alignItems: 'center', gap: spacing[3],
    padding: `${spacing[3]} 0`, borderBottom: `1px solid ${colors.border}`,
    textDecoration: 'none',
  } as React.CSSProperties,
}
