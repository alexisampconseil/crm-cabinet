import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendBrevoEmail, type BrevoEmailPayload } from '@/lib/email/brevo'

function buildCollecteEmail(
  prenom: string,
  nom: string,
  url: string,
  expiresAt: string
): BrevoEmailPayload {
  const dateExpiration = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(expiresAt))

  const htmlContent = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f8f7f5;margin:0;padding:0;">
<div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2ddd6;">
  <div style="background:#2d4462;padding:28px 32px;">
    <p style="font-family:Arial,sans-serif;font-size:1rem;font-weight:500;letter-spacing:0.18em;color:rgba(255,255,255,0.9);margin:0;">AMP <span style="color:#cdb47a;">CONSEIL</span></p>
    <p style="font-size:0.65rem;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin:4px 0 0;">Gestion de patrimoine</p>
  </div>
  <div style="padding:32px;">
    <div style="width:40px;height:2px;background:#b69957;margin-bottom:20px;"></div>
    <h1 style="font-size:1.4rem;font-weight:300;color:#2d4462;margin-bottom:12px;line-height:1.3;">Bonjour ${prenom} ${nom},</h1>
    <p style="font-size:0.88rem;color:#5a6a7e;line-height:1.9;font-weight:300;margin-bottom:20px;">Nous vous invitons à compléter votre questionnaire patrimonial afin de mettre à jour votre dossier.</p>
    <p style="font-size:0.88rem;color:#5a6a7e;line-height:1.9;font-weight:300;margin-bottom:28px;">Ce questionnaire confidentiel vous permettra de disposer d'un bilan patrimonial complet et de bénéficier de recommandations adaptées à votre situation.</p>
    <a href="${url}" style="display:inline-block;background:#b69957;color:#fff;text-decoration:none;font-size:0.68rem;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;padding:13px 28px;">Accéder au questionnaire →</a>
    <p style="font-size:0.72rem;color:#8a9aac;margin-top:20px;line-height:1.7;">Ce lien est valable jusqu'au <strong>${dateExpiration}</strong>. En cas de problème, contactez-nous au <strong>06 82 18 18 45</strong>.</p>
  </div>
  <div style="background:#f8f7f5;padding:16px 32px;border-top:1px solid #e2ddd6;">
    <p style="font-size:0.65rem;color:#8a9aac;line-height:1.6;margin:0;">AMP CONSEIL — CIF/CGP — 15 route de Frangy, Annecy<br/>contact@ampconseil.com · 06 82 18 18 45</p>
  </div>
</div>
</body></html>
  `.trim()

  return {
    sender: { name: 'AMP CONSEIL', email: process.env.BREVO_FROM_EMAIL ?? 'contact@ampconseil.com' },
    to: [{ email: '', name: `${prenom} ${nom}` }],
    subject: 'AMP CONSEIL — Votre questionnaire patrimonial',
    htmlContent,
  }
}

// POST /api/collecte/sessions/:id/notifier
// Envoie par email le lien de collecte déjà généré pour cette session.
// Action manuelle conseiller — jamais déclenchée automatiquement à la création du lien.
// Ne régénère jamais de token : réutilise celui déjà lié à la session.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!userRole || userRole.role !== 'conseiller') {
    return NextResponse.json({ error: 'Accès réservé aux conseillers' }, { status: 403 })
  }

  const { data: session } = await supabaseAdmin
    .from('collecte_sessions')
    .select('id, client_id, kyc_token_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  if (!session.kyc_token_id) {
    return NextResponse.json(
      { error: 'Aucun lien de collecte généré pour cette session' },
      { status: 409 }
    )
  }

  const { data: token } = await supabaseAdmin
    .from('kyc_tokens')
    .select('token, expires_at')
    .eq('id', session.kyc_token_id)
    .maybeSingle()

  if (!token) {
    return NextResponse.json({ error: 'Lien introuvable pour cette session' }, { status: 404 })
  }

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, nom, prenom, email')
    .eq('id', session.client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  if (!client.email) {
    return NextResponse.json({ error: "Ce client n'a pas d'adresse email" }, { status: 422 })
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/collecte/${token.token}`

  try {
    const emailPayload = buildCollecteEmail(client.prenom, client.nom, url, token.expires_at)
    emailPayload.to[0].email = client.email

    await sendBrevoEmail(emailPayload)

    await supabaseAdmin.from('access_logs').insert({
      user_id: user.id,
      role: 'conseiller',
      action: 'collecte_email_envoye',
      resource: `client:${session.client_id}`,
    })

    return NextResponse.json({
      success:        true,
      email_sent_to:  client.email,
      url,
      expires_at:     token.expires_at,
    })
  } catch (err) {
    console.error('[collecte/notifier]', err)
    const message = err instanceof Error ? err.message : 'Erreur lors de l\'envoi de l\'email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
