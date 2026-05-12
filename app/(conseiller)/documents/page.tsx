import { createServerSupabase, logAccess } from '@/lib/supabase'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, statusBadge,
} from '@/lib/design-tokens'

interface DocRow {
  id: string
  client_id: string
  type: string
  date_realisation: string | null
  url: string | null
  created_at: string
  clients: { nom: string; prenom: string } | null
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

const DOC_TYPES = Object.keys(DOC_LABELS)

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d))
}

export default async function DocumentsPage() {
  const supabase = await createServerSupabase()
  await logAccess('documents_view')

  const { data } = await supabase
    .from('documents_reglementaires')
    .select('*, clients(nom, prenom)')
    .order('created_at', { ascending: false })
    .limit(200)

  const docs = (data ?? []) as DocRow[]

  // Stats par type
  const statsByType: Record<string, number> = {}
  DOC_TYPES.forEach(t => { statsByType[t] = docs.filter(d => d.type === t).length })

  const totalDocs = docs.length
  const docsAvecUrl = docs.filter(d => d.url).length

  return (
    <div>
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Conformité réglementaire</span></div>
          <h1 style={s.title}>Documents réglementaires</h1>
        </div>
        <div style={{ display: 'flex', gap: spacing[5] }}>
          <DocKpi label="Total documents" value={String(totalDocs)} />
          <DocKpi label="Avec fichier joint" value={String(docsAvecUrl)} highlight />
        </div>
      </div>

      {/* Compteurs par type */}
      <div style={s.typesGrid}>
        {DOC_TYPES.map(type => (
          <div key={type} style={{ ...cardBase, padding: spacing[4], boxShadow: shadows.sm }}>
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const, color: colors.textMid, marginBottom: spacing[1] }}>{type}</p>
            <p style={{ fontFamily: fonts.heading, fontSize: '1.8rem', fontWeight: fontWeights.light, color: colors.blueDeep, lineHeight: 1 }}>{statsByType[type] ?? 0}</p>
            <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, marginTop: spacing[1] }}>{DOC_LABELS[type]}</p>
          </div>
        ))}
      </div>

      {/* Tableau des documents */}
      <div style={{ ...cardBase, boxShadow: shadows.sm, overflow: 'hidden' } as React.CSSProperties}>
        <div style={s.tableHeader}>
          <h2 style={s.cardTitle}>Tous les documents</h2>
          <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight }}>
            Ajoutez des documents depuis la fiche de chaque client.
          </p>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              <TH>Client</TH>
              <TH>Type</TH>
              <TH>Date d'émission</TH>
              <TH>Fichier</TH>
              <TH>Ajouté le</TH>
              <TH />
            </tr>
          </thead>
          <tbody>
            {docs.map(doc => (
              <tr key={doc.id}>
                <TD>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colors.text }}>
                    {doc.clients ? `${doc.clients.prenom} ${doc.clients.nom}` : '—'}
                  </p>
                </TD>
                <TD>
                  <span style={statusBadge.info}>{doc.type}</span>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, marginTop: '2px' }}>{DOC_LABELS[doc.type] ?? doc.type}</p>
                </TD>
                <TD>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text }}>{formatDate(doc.date_realisation)}</p>
                </TD>
                <TD>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" style={s.fileLink}>
                      Ouvrir ↗
                    </a>
                  ) : (
                    <span style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight, fontStyle: 'italic' }}>En attente</span>
                  )}
                </TD>
                <TD>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLight }}>{formatDate(doc.created_at)}</p>
                </TD>
                <TD>
                  <Link href={`/clients/${doc.client_id}`} style={s.clientLink}>Fiche →</Link>
                </TD>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: spacing[10], textAlign: 'center', fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textLight, fontStyle: 'italic' }}>
                  Aucun document réglementaire enregistré. Ajoutez-en depuis les fiches clients.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Note réglementaire */}
      <div style={s.legalNote}>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMid, lineHeight: 1.8 }}>
          <strong>Archivage réglementaire</strong> — Conformément aux exigences AMF/ACPR, tous les documents contractuels doivent être conservés pendant une durée minimale de 5 ans après la fin de la relation client (directives MIF2, LCB-FT, DDA). Les documents estampillés « En attente » nécessitent l'ajout d'un fichier joint.
        </p>
      </div>
    </div>
  )
}

function DocKpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'right' as const }}>
      <p style={{ fontFamily: fonts.heading, fontSize: '2rem', fontWeight: fontWeights.light, color: highlight ? colors.gold : colors.blueDeep, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMid, letterSpacing: letterSpacings.wide, textTransform: 'uppercase' as const }}>{label}</p>
    </div>
  )
}

const TH = ({ children }: { children?: React.ReactNode }) => (
  <th style={{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.bold, letterSpacing: letterSpacings.wider, textTransform: 'uppercase' as const, color: colors.blueDeep, backgroundColor: colors.bluePale, padding: `${spacing[2]} ${spacing[4]}`, textAlign: 'left', borderBottom: `2px solid ${colors.blueLight}` }}>{children}</th>
)

const TD = ({ children }: { children: React.ReactNode }) => (
  <td style={{ padding: `${spacing[3]} ${spacing[4]}`, borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle' }}>{children}</td>
)

const s = {
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing[6] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: { fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)', fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em' },
  typesGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: spacing[3], marginBottom: spacing[6] },
  tableHeader: { padding: `${spacing[4]} ${spacing[5]}`, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.blueDeep, letterSpacing: letterSpacings.wide },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  fileLink: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue, textDecoration: 'none', fontWeight: fontWeights.medium },
  clientLink: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.blue, textDecoration: 'none' },
  legalNote: { marginTop: spacing[6], backgroundColor: colors.bluePale, border: `1px solid ${colors.blueLight}`, borderLeft: `3px solid ${colors.blue}`, padding: spacing[5] },
}
