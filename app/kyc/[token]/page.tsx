import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { colors, fonts, fontSizes, fontWeights, spacing } from '@/lib/design-tokens'

interface Props {
  params: Promise<{ token: string }>
}

export default async function KycPublicPage({ params }: Props) {
  const { token } = await params

  // Vérifier le token côté serveur avant de montrer le formulaire
  const { data: tokenRow, error } = await supabaseAdmin
    .from('kyc_tokens')
    .select('*, clients(id, nom, prenom)')
    .eq('token', token)
    .single()

  if (error || !tokenRow) {
    return <ErrorPage message="Lien invalide ou introuvable. Contactez votre conseiller AMP CONSEIL." />
  }

  if (tokenRow.used_at) {
    return <ErrorPage message="Ce lien a déjà été utilisé. Si vous avez besoin d'une mise à jour, contactez votre conseiller." />
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return <ErrorPage message="Ce lien a expiré. Contactez votre conseiller AMP CONSEIL pour recevoir un nouveau lien." />
  }

  const client = tokenRow.clients as { id: string; nom: string; prenom: string }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.offWhite }}>
      <iframe
        src={`/kyc-form.html?token=${token}&client_id=${tokenRow.client_id}&contexte=${tokenRow.contexte}`}
        style={{
          width: '100%',
          height: '100vh',
          border: 'none',
          display: 'block',
        }}
        title={`Questionnaire patrimonial — ${client.prenom} ${client.nom}`}
      />
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.blueDeep,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[5],
      fontFamily: fonts.body,
    }}>
      <div style={{
        backgroundColor: colors.white,
        maxWidth: '480px',
        width: '100%',
        padding: spacing[8],
      }}>
        <div style={{ width: '40px', height: '2px', backgroundColor: colors.gold, marginBottom: spacing[5] }} />
        <h1 style={{
          fontFamily: fonts.heading,
          fontSize: '1.6rem',
          fontWeight: fontWeights.light,
          color: colors.blueDeep,
          marginBottom: spacing[3],
          lineHeight: 1.2,
        }}>
          Lien non disponible
        </h1>
        <p style={{
          fontSize: fontSizes.base,
          color: colors.textMid,
          lineHeight: 1.8,
          fontWeight: fontWeights.light,
          marginBottom: spacing[6],
        }}>
          {message}
        </p>
        <p style={{
          fontSize: fontSizes.xs,
          color: colors.textLight,
          letterSpacing: '0.06em',
        }}>
          AMP CONSEIL — 06 82 18 18 45 — contact@ampconseil.com
        </p>
      </div>
    </div>
  )
}
