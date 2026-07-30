'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type {
  Client, Famille, Enfant, Objectif, ActifFinancier,
  BienImmobilier, Passif, BudgetPoste, Fiscalite, Prevoyance,
  ContratPrevoyance,
} from './supabase'
import type { CollecteSession } from './collecte'

// ============================================================
// TYPES
// ============================================================

export interface ClientContextData {
  client: Client
  famille: Famille | null
  enfants: Enfant[]
  objectifs: Objectif[]
  actifsFinanciers: ActifFinancier[]
  biensImmobiliers: BienImmobilier[]
  passifs: Passif[]
  budgetPostes: BudgetPoste[]
  fiscalite: Fiscalite | null
  prevoyance: Prevoyance | null
  contratsPrevoyance: ContratPrevoyance[]
  // Session brouillon/en_cours la plus récente, si elle existe — lecture seule,
  // jamais modifiée via update/saveAll (pas de notion de "dirty" applicable).
  collecteActive: CollecteSession | null
}

export interface SaveHandlers {
  saveClient: (data: Partial<Client>) => Promise<void>
  saveFamille: (data: Partial<Famille>) => Promise<void>
  saveEnfants: (data: Enfant[]) => Promise<void>
  saveObjectifs: (data: Objectif[]) => Promise<void>
  saveActifs: (data: ActifFinancier[]) => Promise<void>
  saveBiens: (data: BienImmobilier[]) => Promise<void>
  savePassifs: (data: Passif[]) => Promise<void>
  saveBudget: (data: BudgetPoste[]) => Promise<void>
  saveFiscalite: (data: Partial<Fiscalite>) => Promise<void>
  savePrevoyance: (data: Partial<Prevoyance>) => Promise<void>
  saveContratsPrevoyance: (data: ContratPrevoyance[]) => Promise<void>
}

interface ClientContextValue {
  data: ClientContextData
  dirty: Set<keyof ClientContextData>
  saving: boolean
  saveErrors: string[]
  update: <K extends keyof ClientContextData>(key: K, value: ClientContextData[K]) => void
  saveAll: () => Promise<{ errors: string[] }>
  clearErrors: () => void
}

// ============================================================
// CONTEXTE
// ============================================================

const ClientCtx = createContext<ClientContextValue | null>(null)

export function useClient() {
  const ctx = useContext(ClientCtx)
  if (!ctx) throw new Error('useClient doit être utilisé dans un ClientProvider')
  return ctx
}

// ============================================================
// PROVIDER
// ============================================================

interface ClientProviderProps {
  initial: ClientContextData
  handlers: SaveHandlers
  children: ReactNode
}

export function ClientProvider({ initial, handlers, children }: ClientProviderProps) {
  const [data, setData] = useState<ClientContextData>(initial)
  const [dirty, setDirty] = useState<Set<keyof ClientContextData>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveErrors, setSaveErrors] = useState<string[]>([])

  const update = useCallback(<K extends keyof ClientContextData>(
    key: K,
    value: ClientContextData[K],
  ) => {
    setData(prev => ({ ...prev, [key]: value }))
    setDirty(prev => new Set([...prev, key]))
  }, [])

  const saveAll = useCallback(async () => {
    if (dirty.size === 0) return { errors: [] }
    setSaving(true)
    setSaveErrors([])

    // Paires [tâche, libellé] pour les sections modifiées
    const tasks: Array<[Promise<void>, string]> = []

    if (dirty.has('client'))           tasks.push([handlers.saveClient(data.client),            'Informations client'])
    if (dirty.has('famille'))          tasks.push([handlers.saveFamille(data.famille ?? {}),    'Famille'])
    if (dirty.has('enfants'))          tasks.push([handlers.saveEnfants(data.enfants),          'Enfants'])
    if (dirty.has('objectifs'))        tasks.push([handlers.saveObjectifs(data.objectifs),      'Objectifs'])
    if (dirty.has('actifsFinanciers')) tasks.push([handlers.saveActifs(data.actifsFinanciers),  'Actifs financiers'])
    if (dirty.has('biensImmobiliers')) tasks.push([handlers.saveBiens(data.biensImmobiliers),   'Patrimoine immobilier'])
    if (dirty.has('passifs'))          tasks.push([handlers.savePassifs(data.passifs),          'Passifs'])
    if (dirty.has('budgetPostes'))     tasks.push([handlers.saveBudget(data.budgetPostes),      'Budget'])
    if (dirty.has('fiscalite'))        tasks.push([handlers.saveFiscalite(data.fiscalite ?? {}), 'Fiscalité'])
    if (dirty.has('prevoyance'))          tasks.push([handlers.savePrevoyance(data.prevoyance ?? {}),             'Prévoyance'])
    if (dirty.has('contratsPrevoyance'))  tasks.push([handlers.saveContratsPrevoyance(data.contratsPrevoyance), 'Contrats prévoyance'])

    const results = await Promise.allSettled(tasks.map(([p]) => p))
    const errors: string[] = []

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const label = tasks[i][1]
        const msg = result.reason instanceof Error ? result.reason.message : 'Erreur inconnue'
        errors.push(`${label} : ${msg}`)
      }
    })

    if (errors.length === 0) {
      setDirty(new Set())
    } else {
      setSaveErrors(errors)
    }

    setSaving(false)
    return { errors }
  }, [data, dirty, handlers])

  const clearErrors = useCallback(() => setSaveErrors([]), [])

  return (
    <ClientCtx.Provider value={{ data, dirty, saving, saveErrors, update, saveAll, clearErrors }}>
      {children}
    </ClientCtx.Provider>
  )
}
