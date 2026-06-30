'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  colors, fonts, fontSizes, fontWeights, spacing,
  shadows, letterSpacings, transitions, radii, inputBase, buttonGold
} from '@/lib/design-tokens'
import Image from 'next/image'

type Step = 'credentials' | 'mfa' | 'reset-password'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials'))  return 'Email ou mot de passe incorrect.'
  if (msg.includes('Email not confirmed'))         return 'Email non confirmé. Vérifiez votre boîte mail.'
  if (msg.includes('Too many requests'))           return 'Trop de tentatives. Veuillez patienter quelques minutes.'
  if (msg.includes('User not found'))              return 'Aucun compte associé à cet email.'
  if (msg.includes('Invalid TOTP'))                return 'Code incorrect. Vérifiez votre application d\'authentification.'
  if (msg.includes('MFA'))                         return 'Échec de la vérification MFA.'
  return 'Une erreur inattendue s\'est produite.'
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.slice(1))

    const hashError = params.get('error')
    if (hashError) {
      const desc = params.get('error_description') ?? hashError
      if (desc.includes('expired') || desc.includes('invalid'))
        setError('Le lien de récupération a expiré. Demandez un nouveau lien depuis le tableau de bord Supabase.')
      else
        setError(decodeURIComponent(desc.replace(/\+/g, ' ')))
      return
    }

    if (!hash.includes('type=recovery')) return
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) return
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) setError(translateAuthError(error.message))
      else setStep('reset-password')
    })
  }, [])

  const redirectByRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session invalide. Veuillez réessayer.'); return }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !roleData) {
      setError('Aucun accès configuré pour ce compte. Contactez l\'administrateur.')
      await supabase.auth.signOut()
      return
    }

    const role = roleData.role as 'conseiller' | 'client'
    // Stocker le rôle dans un cookie pour le proxy (non httpOnly, utilisé pour le routing)
    document.cookie = `amp_role=${role}; path=/; max-age=86400; samesite=strict`

    const destination = nextPath ||
      (role === 'conseiller' ? '/dashboard' : '/tableau-de-bord')
    // Navigation dure : garantit que les cookies Supabase nouvellement posés
    // sont envoyés dans une requête fraîche. router.push + router.refresh()
    // a une race condition en production (cache SSR servi avant que refresh()
    // n'invalide, proxy reçoit user=null et renvoie au login).
    window.location.href = destination
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(translateAuthError(signInError.message))
        return
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      if (aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.[0]

        if (!totp) {
          setError('Configuration MFA manquante. Contactez l\'administrateur.')
          return
        }

        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: totp.id,
        })

        if (challengeError || !challenge) {
          setError('Impossible de démarrer la vérification MFA.')
          return
        }

        setFactorId(totp.id)
        setChallengeId(challenge.id)
        setStep('mfa')
      } else {
        await redirectByRole()
      }
    } catch {
      setError('Une erreur inattendue s\'est produite.')
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || !challengeId) return
    setError(null)
    setLoading(true)

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      })

      if (verifyError) {
        setError(translateAuthError(verifyError.message))
        return
      }

      await redirectByRole()
    } catch {
      setError('Une erreur inattendue s\'est produite.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword !== newPasswordConfirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) { setError(translateAuthError(updateError.message)); return }
      setSuccess('Mot de passe défini. Redirection...')
      setTimeout(() => redirectByRole(), 1500)
    } catch {
      setError('Une erreur inattendue s\'est produite.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Fond décoratif */}
      <div style={styles.bg} />

      <div style={styles.container}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <Image
            src="/logo.jpg"
            alt="AMP CONSEIL"
            width={120}
            height={60}
            style={{ objectFit: 'contain', borderRadius: '4px' }}
            priority
            unoptimized
          />
        </div>

        {/* Carte */}
        <div style={styles.card}>
          {/* En-tête carte */}
          <div style={styles.cardHeader}>
            <div style={styles.rule} />
            <h1 style={styles.title}>
              {step === 'credentials' && 'Accès sécurisé'}
              {step === 'mfa' && 'Vérification en deux étapes'}
              {step === 'reset-password' && 'Définir un mot de passe'}
            </h1>
            <p style={styles.subtitle}>
              {step === 'credentials' && 'Connectez-vous à votre espace AMP CONSEIL'}
              {step === 'mfa' && 'Saisissez le code généré par votre application d\'authentification'}
              {step === 'reset-password' && 'Choisissez un mot de passe sécurisé pour votre compte.'}
            </p>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div style={styles.errorBox}>
              <span style={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}

          {/* Message de succès */}
          {success && (
            <div style={styles.successBox}>{success}</div>
          )}

          {/* Formulaire identifiants */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label htmlFor="email" style={styles.label}>Adresse e-mail</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={styles.input}
                  onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label htmlFor="password" style={styles.label}>Mot de passe</label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={styles.input}
                  onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          )}

          {/* Formulaire MFA */}
          {step === 'mfa' && (
            <form onSubmit={handleMfaSubmit} style={styles.form}>
              <div style={styles.mfaHint}>
                <span style={styles.mfaIcon}>🔐</span>
                <p style={styles.mfaText}>
                  Ouvrez votre application d&apos;authentification (Google Authenticator, Authy...)
                  et saisissez le code à 6 chiffres.
                </p>
              </div>

              <div style={styles.fieldGroup}>
                <label htmlFor="code" style={styles.label}>Code de vérification</label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{ ...styles.input, ...styles.codeInput }}
                  onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none', textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.4rem' })}
                />
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                style={{ ...styles.submitBtn, opacity: (loading || code.length !== 6) ? 0.7 : 1 }}
              >
                {loading ? 'Vérification...' : 'Confirmer'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setCode(''); setError(null) }}
                style={styles.backBtn}
              >
                ← Retour à la connexion
              </button>
            </form>
          )}

          {/* Formulaire réinitialisation mot de passe */}
          {step === 'reset-password' && (
            <form onSubmit={handleResetPassword} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label htmlFor="new-password" style={styles.label}>Nouveau mot de passe</label>
                <input
                  id="new-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={styles.input}
                  onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
                />
              </div>
              <div style={styles.fieldGroup}>
                <label htmlFor="new-password-confirm" style={styles.label}>Confirmer le mot de passe</label>
                <input
                  id="new-password-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPasswordConfirm}
                  onChange={e => setNewPasswordConfirm(e.target.value)}
                  style={styles.input}
                  onFocus={e => Object.assign(e.target.style, styles.inputFocus)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !newPassword || !newPasswordConfirm}
                style={{ ...styles.submitBtn, opacity: (loading || !newPassword || !newPasswordConfirm) ? 0.7 : 1 }}
              >
                {loading ? 'Enregistrement...' : 'Définir le mot de passe'}
              </button>
            </form>
          )}
        </div>

        <p style={styles.footer}>
          AMP CONSEIL — Cabinet de conseil en gestion de patrimoine (CGP-CIF)
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles inline — design tokens uniquement
// ---------------------------------------------------------------------------

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: colors.blueDeep,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
    position: 'relative' as const,
    overflow: 'hidden',
    fontFamily: fonts.body,
  },
  bg: {
    position: 'absolute' as const,
    inset: 0,
    backgroundImage: `radial-gradient(circle at 70% 20%, rgba(182,153,87,0.06) 0%, transparent 50%),
                      radial-gradient(circle at 20% 80%, rgba(99,129,168,0.08) 0%, transparent 40%)`,
    pointerEvents: 'none' as const,
  },
  container: {
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: spacing[6],
    position: 'relative' as const,
    zIndex: 1,
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
    width: '100%',
    padding: spacing[8],
    boxShadow: shadows.lg,
  },
  cardHeader: {
    marginBottom: spacing[6],
  },
  rule: {
    width: '44px',
    height: '2px',
    backgroundColor: colors.gold,
    marginBottom: spacing[4],
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: '1.7rem',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: letterSpacings.tight,
    marginBottom: spacing[2],
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.textMid,
    lineHeight: 1.6,
    fontWeight: fontWeights.light,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    color: colors.danger,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: fontSizes.sm,
    marginBottom: spacing[5],
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: fontSizes.sm,
    marginBottom: spacing[5],
  },
  errorIcon: {
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[4],
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[1],
  },
  label: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.label,
    textTransform: 'uppercase' as const,
    color: colors.textMid,
  },
  input: {
    ...inputBase,
    padding: `${spacing[3]} ${spacing[3]}`,
    fontSize: fontSizes.base,
  } as React.CSSProperties,
  inputFocus: {
    borderColor: colors.blue,
    boxShadow: `0 0 0 3px rgba(99,129,168,0.12)`,
  } as React.CSSProperties,
  submitBtn: {
    ...buttonGold,
    width: '100%',
    padding: `${spacing[3]} ${spacing[4]}`,
    marginTop: spacing[2],
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    transition: transitions.base,
  } as React.CSSProperties,
  mfaHint: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.bluePale,
    border: `1px solid ${colors.blueLight}`,
    padding: spacing[4],
    borderLeft: `3px solid ${colors.blue}`,
  },
  mfaIcon: {
    fontSize: '1.2rem',
    flexShrink: 0,
    marginTop: '2px',
  },
  mfaText: {
    fontSize: fontSizes.sm,
    color: colors.textMid,
    lineHeight: 1.6,
    fontWeight: fontWeights.light,
  },
  codeInput: {
    textAlign: 'center' as const,
    letterSpacing: '0.3em',
    fontSize: '1.4rem',
    fontWeight: fontWeights.medium,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: colors.textMid,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    padding: 0,
    fontFamily: fonts.body,
    textAlign: 'center' as const,
    transition: transitions.fast,
    letterSpacing: letterSpacings.wide,
  },
  footer: {
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center' as const,
    letterSpacing: letterSpacings.wide,
    fontWeight: fontWeights.light,
  },
}
