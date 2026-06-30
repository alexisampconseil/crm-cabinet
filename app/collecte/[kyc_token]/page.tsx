import type { ReactNode } from 'react'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSession, getVersionById } from '@/lib/collecte'
import type {
  CollecteSession,
  CollecteSessionStatut,
  QuestionnaireVersion,
} from '@/lib/collecte'
import {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  letterSpacings,
  lineHeights,
  spacing,
  statusBadge,
} from '@/lib/design-tokens'
import QuestionnaireForm from './_components/QuestionnaireForm'
import MiseAJourAnnuelleForm from './_components/MiseAJourAnnuelleForm'

interface Props {
  params: Promise<{ kyc_token: string }>
}

interface KycTokenClient {
  id: string
  nom: string
  prenom: string
  email: string | null
}

const ETAT_INFO: Record<
  CollecteSessionStatut,
  { label: string; badge: keyof typeof statusBadge; description: string }
> = {
  brouillon: {
    label: 'En préparation',
    badge: 'neutral',
    description: 'Votre conseiller prépare votre questionnaire. Merci de revenir un peu plus tard.',
  },
  en_cours: {
    label: 'Ouvert',
    badge: 'info',
    description: 'Votre questionnaire est ouvert. Vous pouvez consulter et compléter vos informations.',
  },
  soumis: {
    label: 'Soumis',
    badge: 'warning',
    description: 'Vos réponses ont été transmises à votre conseiller, qui va les examiner.',
  },
  en_revue: {
    label: 'En cours de revue',
    badge: 'warning',
    description: 'Votre conseiller vérifie vos informations. Vous serez recontacté si besoin.',
  },
  valide: {
    label: 'Validé',
    badge: 'success',
    description: 'Votre dossier a été validé par votre conseiller.',
  },
  archive: {
    label: 'Clôturé',
    badge: 'neutral',
    description: 'Cette collecte est clôturée.',
  },
}

export default async function CollectePublicPage({ params }: Props) {
  const { kyc_token } = await params

  // 1. Vérification du kyc_token — accès non authentifié, supabaseAdmin requis
  // (le client n'a pas de session Supabase Auth sur le portail public).
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('kyc_tokens')
    .select('id, client_id, expires_at, used_at, collecte_session_id, clients(id, nom, prenom, email)')
    .eq('token', kyc_token)
    .maybeSingle()

  if (tokenError || !tokenRow) {
    return (
      <MessagePage
        title="Lien non disponible"
        message="Lien invalide ou introuvable. Contactez votre conseiller AMP CONSEIL."
      />
    )
  }

  if (tokenRow.used_at) {
    // Si le token a été consommé lors d'une soumission, afficher un message
    // contextuel plutôt que le message générique "lien déjà utilisé".
    if (tokenRow.collecte_session_id) {
      try {
        const soumisSession = await getSession(tokenRow.collecte_session_id, supabaseAdmin)
        const STATUTS_SOUMIS = ['soumis', 'en_revue', 'valide', 'archive'] as const
        if (STATUTS_SOUMIS.includes(soumisSession.statut as typeof STATUTS_SOUMIS[number])) {
          return (
            <MessagePage
              title="Questionnaire déjà transmis"
              message="Votre questionnaire a déjà été transmis à votre conseiller. Vous serez contacté prochainement."
            />
          )
        }
      } catch {
        // Session introuvable — on tombe sur le message générique ci-dessous
      }
    }
    return (
      <MessagePage
        title="Lien non disponible"
        message="Ce lien a déjà été utilisé. Contactez votre conseiller pour en obtenir un nouveau."
      />
    )
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return (
      <MessagePage
        title="Lien expiré"
        message="Ce lien a expiré. Contactez votre conseiller AMP CONSEIL pour recevoir un nouveau lien."
      />
    )
  }

  // 2. La session de collecte doit exister et être rattachée à ce token.
  if (!tokenRow.collecte_session_id) {
    return (
      <MessagePage
        title="Collecte non initialisée"
        message="Aucune collecte patrimoniale n'est encore associée à ce lien. Contactez votre conseiller."
      />
    )
  }

  let session: CollecteSession
  try {
    session = await getSession(tokenRow.collecte_session_id, supabaseAdmin)
  } catch {
    return (
      <MessagePage
        title="Collecte introuvable"
        message="La collecte associée à ce lien n'existe plus. Contactez votre conseiller."
      />
    )
  }

  // 3. Version du questionnaire rattachée à la session.
  // Toujours présente dans le nouveau flux (figée lors de la génération du lien).
  let questionnaireVersion: QuestionnaireVersion | null = null
  if (session.questionnaire_version_id) {
    try {
      questionnaireVersion = await getVersionById(session.questionnaire_version_id, supabaseAdmin)
    } catch {
      questionnaireVersion = null
    }
  }

  const client = (tokenRow.clients as unknown as KycTokenClient | null) ?? null

  // ── Mise en page commune ──────────────────────────────────────────────────

  const pageContainer: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: colors.offWhite,
    fontFamily: fonts.body,
    padding: spacing[8],
  }
  const innerContainer: React.CSSProperties = {
    maxWidth: '720px',
    margin: '0 auto',
  }
  const heading: React.CSSProperties = {
    fontFamily: fonts.heading,
    fontSize: '1.8rem',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    marginBottom: spacing[2],
  }
  const subtitle: React.CSSProperties = {
    fontSize: fontSizes.base,
    color: colors.textMid,
    marginBottom: spacing[8],
    lineHeight: lineHeights.relaxed,
  }
  const footer: React.CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textLight,
    letterSpacing: letterSpacings.wide,
    marginTop: spacing[8],
  }

  // ── Affichage du questionnaire (statut en_cours + version disponible) ─────

  if (session.statut === 'en_cours' && questionnaireVersion && session.snapshot_prefill) {
    // Parcours simplifié de mise à jour annuelle pour les clients existants :
    // affichage de la situation en lecture seule par groupe, avec question
    // "rien n'a changé / modifier". Uniquement pour type='verification_annuelle'.
    // Tous les autres types conservent le parcours complet (QuestionnaireForm).
    const isVerificationAnnuelle = session.type === 'verification_annuelle'

    return (
      <div style={pageContainer}>
        <div style={innerContainer}>
          <div style={{ width: '40px', height: '2px', backgroundColor: colors.gold, marginBottom: spacing[5] }} />
          <h1 style={heading}>
            {client ? `Bienvenue ${client.prenom} ${client.nom}` : 'Votre questionnaire patrimonial'}
          </h1>
          <p style={subtitle}>
            {isVerificationAnnuelle
              ? 'AMP CONSEIL — Mise à jour annuelle de votre situation'
              : 'AMP CONSEIL — Référentiel client patrimonial'}
          </p>

          {isVerificationAnnuelle ? (
            <MiseAJourAnnuelleForm
              structure={questionnaireVersion.structure}
              snapshot={session.snapshot_prefill}
              perimetre={session.perimetre}
              versionLibelle={questionnaireVersion.libelle}
              kycToken={kyc_token}
            />
          ) : (
            <QuestionnaireForm
              structure={questionnaireVersion.structure}
              snapshot={session.snapshot_prefill}
              perimetre={session.perimetre}
              statut={session.statut}
              versionLibelle={questionnaireVersion.libelle}
              kycToken={kyc_token}
            />
          )}

          <p style={footer}>AMP CONSEIL — 06 82 18 18 45 — contact@ampconseil.com</p>
        </div>
      </div>
    )
  }

  // ── Affichage statut pour tous les autres cas ─────────────────────────────

  const etat = ETAT_INFO[session.statut]

  return (
    <div style={pageContainer}>
      <div style={innerContainer}>
        <div style={{ width: '40px', height: '2px', backgroundColor: colors.gold, marginBottom: spacing[5] }} />
        <h1 style={heading}>
          {client ? `Bienvenue ${client.prenom} ${client.nom}` : 'Votre questionnaire patrimonial'}
        </h1>
        <p style={subtitle}>AMP CONSEIL — Référentiel client patrimonial</p>

        <Card title="État de votre collecte">
          <span style={statusBadge[etat.badge]}>{etat.label}</span>
          <p
            style={{
              fontSize: fontSizes.base,
              color: colors.textMid,
              marginTop: spacing[3],
              lineHeight: lineHeights.relaxed,
            }}
          >
            {etat.description}
          </p>
        </Card>

        <p style={footer}>AMP CONSEIL — 06 82 18 18 45 — contact@ampconseil.com</p>
      </div>
    </div>
  )
}

// ── Composants helpers (server-only, pas de state) ────────────────────────────

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.border}`,
        padding: spacing[6],
        marginBottom: spacing[5],
      }}
    >
      <p
        style={{
          fontSize: fontSizes.xs,
          fontWeight: fontWeights.bold,
          letterSpacing: letterSpacings.label,
          textTransform: 'uppercase',
          color: colors.gold,
          marginBottom: spacing[3],
        }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function MessagePage({ title, message }: { title: string; message: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: colors.blueDeep,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[5],
        fontFamily: fonts.body,
      }}
    >
      <div style={{ backgroundColor: colors.white, maxWidth: '480px', width: '100%', padding: spacing[8] }}>
        <div style={{ width: '40px', height: '2px', backgroundColor: colors.gold, marginBottom: spacing[5] }} />
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: '1.6rem',
            fontWeight: fontWeights.light,
            color: colors.blueDeep,
            marginBottom: spacing[3],
            lineHeight: lineHeights.tight,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: fontSizes.base,
            color: colors.textMid,
            lineHeight: lineHeights.relaxed,
            fontWeight: fontWeights.light,
            marginBottom: spacing[6],
          }}
        >
          {message}
        </p>
        <p style={{ fontSize: fontSizes.xs, color: colors.textLight, letterSpacing: letterSpacings.wide }}>
          AMP CONSEIL — 06 82 18 18 45 — contact@ampconseil.com
        </p>
      </div>
    </div>
  )
}
