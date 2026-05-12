'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, inputBase, labelBase,
  buttonPrimary, buttonGhost, sectionLabel,
} from '@/lib/design-tokens'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function NouveauClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    ville: '',
    statut: 'prospect' as 'prospect' | 'client',
    code: '',
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.prenom.trim() || !form.nom.trim()) {
      setError('Le prénom et le nom sont obligatoires.')
      return
    }
    setSaving(true)
    setError(null)

    const { data, error: dbError } = await supabase
      .from('clients')
      .insert({
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        email: form.email.trim() || null,
        telephone: form.telephone.trim() || null,
        ville: form.ville.trim() || null,
        statut: form.statut,
        code: form.code.trim() || null,
      })
      .select()
      .single()

    if (dbError) {
      setError(dbError.message)
      setSaving(false)
      return
    }

    router.push(`/clients/${data.id}`)
  }

  return (
    <div>
      {/* En-tête */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.eyebrow}>
            <div style={s.rule} />
            <span style={s.eyebrowText}>Clients</span>
          </div>
          <h1 style={s.title}>Nouveau client / prospect</h1>
        </div>
        <Link href="/clients" style={{ ...buttonGhost, padding: `${spacing[3]} ${spacing[5]}` }}>
          ← Retour à la liste
        </Link>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit}>
        <div style={{ ...cardBase, ...s.card }}>
          <h2 style={s.cardTitle}>Informations de base</h2>
          <p style={s.cardSub}>Les autres informations (patrimoine, famille, etc.) seront complétées dans la fiche client.</p>

          {error && <div style={s.errorBox}>{error}</div>}

          <div style={s.formGrid}>
            <div style={s.field}>
              <label style={labelBase}>Prénom *</label>
              <input
                type="text" required value={form.prenom} onChange={set('prenom')}
                style={inputBase}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
            <div style={s.field}>
              <label style={labelBase}>Nom *</label>
              <input
                type="text" required value={form.nom} onChange={set('nom')}
                style={inputBase}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
            <div style={s.field}>
              <label style={labelBase}>Email</label>
              <input
                type="email" value={form.email} onChange={set('email')}
                style={inputBase}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
            <div style={s.field}>
              <label style={labelBase}>Téléphone</label>
              <input
                type="tel" value={form.telephone} onChange={set('telephone')}
                style={inputBase}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
            <div style={s.field}>
              <label style={labelBase}>Ville</label>
              <input
                type="text" value={form.ville} onChange={set('ville')}
                style={inputBase}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
            <div style={s.field}>
              <label style={labelBase}>Code client</label>
              <input
                type="text" value={form.code} onChange={set('code')}
                placeholder="ex: AMP-001"
                style={inputBase}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, { borderColor: colors.border, boxShadow: 'none' })}
              />
            </div>
            <div style={{ ...s.field, gridColumn: '1 / -1' }}>
              <label style={labelBase}>Statut initial</label>
              <select
                value={form.statut}
                onChange={set('statut')}
                style={{ ...inputBase, cursor: 'pointer', width: 'auto' }}
              >
                <option value="prospect">Prospect</option>
                <option value="client">Client</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={s.actions}>
          <Link href="/clients" style={{ ...buttonGhost, padding: `${spacing[3]} ${spacing[6]}` }}>
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            style={{ ...buttonPrimary, padding: `${spacing[3]} ${spacing[8]}`, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Création...' : 'Créer le client'}
          </button>
        </div>
      </form>
    </div>
  )
}

const focusStyle = {
  borderColor: colors.blue,
  boxShadow: `0 0 0 3px rgba(99,129,168,0.12)`,
}

const s = {
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
  },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading,
    fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light,
    color: colors.blueDeep,
    letterSpacing: '-0.01em',
  },
  card: {
    padding: spacing[8],
    boxShadow: shadows.sm,
    marginBottom: spacing[5],
  } as React.CSSProperties,
  cardTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.blueDeep,
    marginBottom: spacing[1],
  },
  cardSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMid,
    fontWeight: fontWeights.light,
    marginBottom: spacing[6],
  },
  errorBox: {
    backgroundColor: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    color: colors.danger,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    marginBottom: spacing[5],
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing[5],
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[1],
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[3],
  },
}
