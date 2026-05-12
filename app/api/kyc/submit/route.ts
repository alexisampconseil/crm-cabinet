import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, client_id: bodyClientId, famille, enfants, immobilier, actifs, passifs, budget_postes, fiscalite, objectifs, commentaire, contexte } = body

    let clientId: string

    // Mode public (token) ou mode iframe (client_id direct depuis session conseiller)
    if (token) {
      // Vérifier le token
      const { data: tokenRow, error: tokenErr } = await supabaseAdmin
        .from('kyc_tokens')
        .select('*')
        .eq('token', token)
        .single()

      if (tokenErr || !tokenRow) {
        return NextResponse.json({ error: 'Token invalide' }, { status: 404 })
      }
      if (tokenRow.used_at) {
        return NextResponse.json({ error: 'Ce lien a déjà été utilisé' }, { status: 410 })
      }
      if (new Date(tokenRow.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Lien expiré' }, { status: 410 })
      }

      clientId = tokenRow.client_id

      // Marquer le token comme utilisé
      await supabaseAdmin
        .from('kyc_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token)
    } else if (bodyClientId) {
      clientId = bodyClientId
    } else {
      return NextResponse.json({ error: 'token ou client_id requis' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // ---- Synchronisation vers toutes les tables métier ----

    // 1. Famille
    if (famille) {
      const famillePayload = { ...famille, client_id: clientId }
      // Nettoyer les champs null/vides
      Object.keys(famillePayload).forEach(k => {
        if (famillePayload[k as keyof typeof famillePayload] === '') {
          (famillePayload as Record<string, unknown>)[k] = null
        }
      })
      await supabaseAdmin
        .from('famille')
        .upsert(famillePayload, { onConflict: 'client_id' })

      // Mettre à jour email/téléphone/ville dans clients depuis famille
      const clientUpdate: Record<string, string | null> = {}
      if (famille.email) clientUpdate.email = famille.email
      if (famille.telephone) clientUpdate.telephone = famille.telephone
      if (famille.ville) clientUpdate.ville = famille.ville
      if (Object.keys(clientUpdate).length > 0) {
        await supabaseAdmin.from('clients').update(clientUpdate).eq('id', clientId)
      }
    }

    // 2. Enfants — remplacement complet
    if (enfants !== undefined) {
      await supabaseAdmin.from('enfants').delete().eq('client_id', clientId)
      if (enfants.length > 0) {
        const rows = enfants
          .filter((e: { prenom?: string }) => e.prenom?.trim())
          .map((e: Record<string, unknown>) => ({ ...e, client_id: clientId }))
        if (rows.length > 0) {
          await supabaseAdmin.from('enfants').insert(rows)
        }
      }
    }

    // 3. Patrimoine immobilier
    if (immobilier !== undefined) {
      await supabaseAdmin.from('patrimoine_immobilier').delete().eq('client_id', clientId)
      if (immobilier.length > 0) {
        const rows = immobilier.map((b: Record<string, unknown>) => ({ ...b, client_id: clientId, detail: {} }))
        await supabaseAdmin.from('patrimoine_immobilier').insert(rows)
      }
    }

    // 4. Actifs financiers
    if (actifs !== undefined) {
      await supabaseAdmin.from('actifs_financiers').delete().eq('client_id', clientId)
      if (actifs.length > 0) {
        const rows = actifs
          .filter((a: { libelle?: string }) => a.libelle?.trim())
          .map((a: Record<string, unknown>) => ({ ...a, client_id: clientId, detail: {} }))
        if (rows.length > 0) {
          await supabaseAdmin.from('actifs_financiers').insert(rows)
        }
      }
    }

    // 5. Passifs
    if (passifs !== undefined) {
      await supabaseAdmin.from('passifs').delete().eq('client_id', clientId)
      if (passifs.length > 0) {
        const rows = passifs.map((p: Record<string, unknown>) => ({ ...p, client_id: clientId, detail: {} }))
        await supabaseAdmin.from('passifs').insert(rows)
      }
    }

    // 6. Budget postes
    if (budget_postes !== undefined) {
      await supabaseAdmin.from('budget_postes').delete().eq('client_id', clientId)
      if (budget_postes.length > 0) {
        const rows = budget_postes
          .filter((p: { libelle?: string }) => p.libelle?.trim())
          .map((p: Record<string, unknown>) => ({ ...p, client_id: clientId }))
        if (rows.length > 0) {
          await supabaseAdmin.from('budget_postes').insert(rows)
        }
      }
    }

    // 7. Fiscalité
    if (fiscalite) {
      await supabaseAdmin
        .from('fiscalite')
        .upsert({ ...fiscalite, client_id: clientId, dispositifs: fiscalite.dispositifs ?? [] }, { onConflict: 'client_id' })
    }

    // 8. Objectifs
    if (objectifs !== undefined && objectifs.length > 0) {
      await supabaseAdmin.from('objectifs').delete().eq('client_id', clientId)
      const rows = objectifs.map((o: Record<string, unknown>) => ({ ...o, client_id: clientId }))
      await supabaseAdmin.from('objectifs').insert(rows)
    }

    // 9. Mettre à jour l'encours total depuis les actifs financiers
    const { data: allActifs } = await supabaseAdmin
      .from('actifs_financiers')
      .select('montant')
      .eq('client_id', clientId)
    const encours = (allActifs ?? []).reduce((acc: number, a: { montant: number | null }) => acc + (a.montant ?? 0), 0)
    await supabaseAdmin
      .from('clients')
      .update({ kyc_status: 'complet', kyc_submitted_at: now, encours })
      .eq('id', clientId)

    // 10. Sauvegarder la réponse brute
    await supabaseAdmin.from('kyc_responses').insert({
      client_id: clientId,
      token: token ?? null,
      responses: body,
      submitted_at: now,
    })

    // 11. Log RGPD
    await supabaseAdmin.from('access_logs').insert({
      action: 'kyc_submitted',
      resource: `client:${clientId}`,
      role: 'anon',
    })

    return NextResponse.json({ success: true, client_id: clientId })
  } catch (err) {
    console.error('[kyc/submit]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
