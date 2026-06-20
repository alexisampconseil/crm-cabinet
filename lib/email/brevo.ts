const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export interface BrevoEmailPayload {
  sender: { name: string; email: string }
  to: { email: string; name: string }[]
  subject: string
  htmlContent: string
}

export async function sendBrevoEmail(payload: BrevoEmailPayload): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY non configurée')

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo API error: ${res.status} — ${err}`)
  }
}
