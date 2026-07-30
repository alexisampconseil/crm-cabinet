'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, fonts, fontSizes, fontWeights, spacing, cardBase, inputBase, labelBase, buttonGold } from '@/lib/design-tokens'
import { api, StateMsg } from './lib'

interface Famille { id: string; libelle: string }
interface Type { id: string; famille_id: string; libelle: string }
interface Partenaire { id: string; nom: string }
interface Ref { familles: Famille[]; types: Type[]; partenaires: Partenaire[]; frisesActives: { famille_id: string }[] }

export default function AffaireCreateClient({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [ref, setRef] = useState<Ref | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [familleId, setFamilleId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [frais, setFrais] = useState('')
  const [revenu, setRevenu] = useState('')
  const [produitId, setProduitId] = useState('')
  const [partenaireId, setPartenaireId] = useState('')

  useEffect(() => {
    api<Ref>('/api/affaires/referentiel').then(setRef).catch((e) => setError(e.message))
  }, [])

  if (error) return <StateMsg kind="error">{error}</StateMsg>
  if (!ref) return <StateMsg kind="loading">Chargement…</StateMsg>

  const famillesAvecFrise = new Set(ref.frisesActives.map((f) => f.famille_id))
  const typesFamille = ref.types.filter((t) => t.famille_id === familleId)
  const familleSansFrise = familleId !== '' && !famillesAvecFrise.has(familleId)
  const num = (s: string) => (s.trim() === '' ? null : Number(s))

  const submit = async () => {
    setSaving(true); setError(null)
    try {
      const res = await api<{ affaire_id: string }>('/api/affaires', {
        method: 'POST',
        body: JSON.stringify({
          clientId, familleId, typeId, libelle,
          montant: num(montant), frais: num(frais), revenuPrevisionnel: num(revenu),
          produitId: produitId || null, partenaireId: partenaireId || null,
        }),
      })
      router.push(`/affaires/${res.affaire_id}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); setSaving(false) }
  }

  const canSubmit = familleId && typeId && libelle.trim() && !familleSansFrise && !saving

  return (
    <div style={{ ...cardBase, padding: spacing[6], maxWidth: 680 }}>
      <h2 style={{ fontFamily: fonts.heading, fontSize: fontSizes.xl, color: colors.blueDeep, marginBottom: spacing[5] }}>Nouvelle affaire</h2>

      <div style={grid}>
        <div>
          <label style={labelBase}>Famille réglementaire *</label>
          <select style={inputBase} value={familleId} onChange={(e) => { setFamilleId(e.target.value); setTypeId('') }}>
            <option value="">— Choisir —</option>
            {ref.familles.map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
          </select>
        </div>
        <div>
          <label style={labelBase}>Type d’affaire *</label>
          <select style={inputBase} value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={!familleId}>
            <option value="">— Choisir —</option>
            {typesFamille.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
          </select>
        </div>
      </div>

      {familleSansFrise && (
        <StateMsg kind="error">Aucune frise active publiée pour cette famille. Publiez d’abord une frise dans le paramétrage.</StateMsg>
      )}

      <div style={{ marginTop: spacing[4] }}>
        <label style={labelBase}>Libellé de suivi *</label>
        <input style={inputBase} value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex : Versement ponctuel 50 000 €" />
      </div>

      <div style={grid}>
        <div><label style={labelBase}>Montant (€)</label><input style={inputBase} type="number" value={montant} onChange={(e) => setMontant(e.target.value)} /></div>
        <div><label style={labelBase}>Frais (€)</label><input style={inputBase} type="number" value={frais} onChange={(e) => setFrais(e.target.value)} /></div>
      </div>
      <div style={grid}>
        <div><label style={labelBase}>Revenu prévisionnel (€)</label><input style={inputBase} type="number" value={revenu} onChange={(e) => setRevenu(e.target.value)} /></div>
        <div>
          <label style={labelBase}>Partenaire</label>
          <select style={inputBase} value={partenaireId} onChange={(e) => setPartenaireId(e.target.value)}>
            <option value="">— Aucun —</option>
            {ref.partenaires.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: spacing[4] }}>
        <label style={labelBase}>Produit (UUID, facultatif)</label>
        <input style={inputBase} value={produitId} onChange={(e) => setProduitId(e.target.value)} placeholder="id produit" />
      </div>

      {error && <StateMsg kind="error">{error}</StateMsg>}

      <div style={{ marginTop: spacing[5], display: 'flex', justifyContent: 'flex-end' }}>
        <button style={{ ...buttonGold, fontSize: fontSizes.sm, padding: '10px 24px', opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit} onClick={submit}>
          {saving ? 'Création…' : 'Créer l’affaire'}
        </button>
      </div>
    </div>
  )
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[4], marginTop: spacing[4] }
