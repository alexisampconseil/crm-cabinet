import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

type RelanceType = 'kyc_initial' | 'kyc_renouvellement' | 'anniversaire' | 'relance_rdv'

interface BrevoEmailPayload {
  sender: { name: string; email: string }
  to: { email: string; name: string }[]
  subject: string
  htmlContent: string
}

async function sendBrevoEmail(payload: BrevoEmailPayload): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY non configurée')

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo API error: ${res.status} — ${err}`)
  }
}

function buildKycEmail(prenom: string, nom: string, kycUrl: string, type: RelanceType): BrevoEmailPayload {
  const isRenouvellement = type === 'kyc_renouvellement'
  const subject = isRenouvellement
    ? `AMP CONSEIL — Mise à jour de votre questionnaire patrimonial`
    : `AMP CONSEIL — Complétez votre questionnaire patrimonial`

  const intro = isRenouvellement
    ? `Dans le cadre du suivi annuel de votre dossier patrimonial, nous vous invitons à mettre à jour vos informations.`
    : `Pour finaliser la constitution de votre dossier, nous vous invitons à compléter votre questionnaire patrimonial.`

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
    <p style="font-size:0.88rem;color:#5a6a7e;line-height:1.9;font-weight:300;margin-bottom:20px;">${intro}</p>
    <p style="font-size:0.88rem;color:#5a6a7e;line-height:1.9;font-weight:300;margin-bottom:28px;">Ce questionnaire confidentiel vous permettra de disposer d'un bilan patrimonial complet et de bénéficier de recommandations adaptées à votre situation.</p>
    <a href="${kycUrl}" style="display:inline-block;background:#b69957;color:#fff;text-decoration:none;font-size:0.68rem;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;padding:13px 28px;">Accéder au questionnaire →</a>
    <p style="font-size:0.72rem;color:#8a9aac;margin-top:20px;line-height:1.7;">Ce lien est valable <strong>72 heures</strong>. En cas de problème, contactez-nous au <strong>06 82 18 18 45</strong>.</p>
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
    subject,
    htmlContent,
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth — conseiller uniquement
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (roleData?.role !== 'conseiller') {
      return NextResponse.json({ error: 'Accès réservé au conseiller' }, { status: 403 })
    }

    const body = await request.json()
    const { client_id, type = 'kyc_initial' }: { client_id: string; type: RelanceType } = body

    if (!client_id) return NextResponse.json({ error: 'client_id requis' }, { status: 400 })

    // Récupérer le client
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, nom, prenom, email')
      .eq('id', client_id)
      .single()

    if (clientErr || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }
    if (!client.email) {
      return NextResponse.json({ error: 'Ce client n\'a pas d\'adresse email' }, { status: 422 })
    }

    // Générer un token KYC
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString()
    const contexte = type === 'kyc_renouvellement' ? 'maj_annuelle' : 'prospect'

    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from('kyc_tokens')
      .insert({ client_id, contexte, expires_at: expiresAt })
      .select()
      .single()

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: 'Impossible de générer le lien KYC' }, { status: 500 })
    }

    const kycUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm.ampconseil.com'}/kyc/${tokenRow.token}`

    // Construire et envoyer l'email
    const emailPayload = buildKycEmail(client.prenom, client.nom, kycUrl, type)
    emailPayload.to[0].email = client.email

    await sendBrevoEmail(emailPayload)

    // Enregistrer la relance
    await supabaseAdmin.from('relances').insert({
      client_id,
      type,
      email: client.email,
    })

    // Mettre à jour derniere_relance
    await supabaseAdmin
      .from('clients')
      .update({ derniere_relance: new Date().toISOString(), kyc_status: 'en_cours' })
      .eq('id', client_id)

    // Log RGPD
    await supabaseAdmin.from('access_logs').insert({
      user_id: user.id,
      role: 'conseiller',
      action: `relance_${type}`,
      resource: `client:${client_id}`,
    })

    return NextResponse.json({ success: true, email_sent_to: client.email, kyc_url: kycUrl })
  } catch (err) {
    console.error('[relance]', err)
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
