'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useClient } from '@/lib/ClientContext'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, inputBase,
} from '@/lib/design-tokens'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Message {
  id: string
  expediteur: 'conseiller' | 'client'
  contenu: string
  lu: boolean
  created_at: string
}

function formatTime(d: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d))
}

export default function ConseillerMessageriePage() {
  const { data: { client } } = useClient()
  const clientId = client.id

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messagerie')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
    setMessages((data ?? []) as Message[])
    scrollToBottom()
  }, [clientId])

  useEffect(() => {
    loadMessages().then(() => {
      // Marquer les messages client comme lus
      supabase.from('messagerie')
        .update({ lu: true })
        .eq('client_id', clientId)
        .eq('expediteur', 'client')
        .eq('lu', false)
      setLoading(false)
    })

    // Realtime — nouveaux messages du client
    const channel = supabase
      .channel(`cons-messagerie:${clientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messagerie',
        filter: `client_id=eq.${clientId}`,
      }, payload => {
        const msg = payload.new as Message
        if (msg.expediteur === 'client') {
          setMessages(prev => [...prev, msg])
          scrollToBottom()
          supabase.from('messagerie').update({ lu: true }).eq('id', msg.id)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clientId, loadMessages])

  const handleSend = async () => {
    if (!message.trim() || sending) return
    setSending(true)
    const { data } = await supabase
      .from('messagerie')
      .insert({ client_id: clientId, expediteur: 'conseiller', contenu: message.trim() })
      .select().single()
    if (data) {
      setMessages(prev => [...prev, data as Message])
      setMessage('')
      scrollToBottom()
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid }}>Chargement…</p>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={{ ...cardBase, ...s.chatWrap }}>
        {/* En-tête */}
        <div style={s.chatHeader}>
          <div style={s.chatHeaderLeft}>
            <div style={s.clientAvatar}>{(client.prenom[0] + client.nom[0]).toUpperCase()}</div>
            <div>
              <p style={s.clientName}>{client.prenom} {client.nom}</p>
              <p style={s.clientMeta}>Messagerie sécurisée</p>
            </div>
          </div>
          <p style={s.headerHint}>Entrée pour envoyer · Maj+Entrée pour sauter une ligne</p>
        </div>

        {/* Messages */}
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.emptyChat}>
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textLight, fontStyle: 'italic' }}>
                Aucun message — commencez la conversation avec {client.prenom}.
              </p>
            </div>
          )}
          {messages.map(msg => {
            const isCons = msg.expediteur === 'conseiller'
            return (
              <div key={msg.id} style={{ ...s.msgRow, justifyContent: isCons ? 'flex-end' : 'flex-start' }}>
                {!isCons && (
                  <div style={s.avatarClient}>{(client.prenom[0] + client.nom[0]).toUpperCase()}</div>
                )}
                <div style={{
                  ...s.bubble,
                  backgroundColor: isCons ? colors.blueDeep : colors.white,
                  color: isCons ? colors.white : colors.text,
                  border: isCons ? 'none' : `1px solid ${colors.border}`,
                }}>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
                    {msg.contenu}
                  </p>
                  <span style={{ ...s.msgTime, color: isCons ? 'rgba(255,255,255,0.45)' : colors.textLight }}>
                    {formatTime(msg.created_at)}
                    {isCons && <span style={{ marginLeft: spacing[2] }}>{msg.lu ? '✓✓' : '✓'}</span>}
                  </span>
                </div>
                {isCons && <div style={s.avatarCons}>AC</div>}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Saisie */}
        <div style={s.inputBar}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message à ${client.prenom}…`}
            rows={2}
            style={{ ...inputBase, flex: 1, resize: 'none' as const, padding: spacing[3] }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            style={{
              ...s.sendBtn,
              opacity: (!message.trim() || sending) ? 0.5 : 1,
              cursor: !message.trim() ? 'default' : 'pointer',
            }}
          >
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { maxWidth: '800px' },
  chatWrap: { boxShadow: shadows.sm, overflow: 'hidden' },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[4]} ${spacing[5]}`,
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.white,
  },
  chatHeaderLeft: { display: 'flex', alignItems: 'center', gap: spacing[3] },
  clientAvatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    backgroundColor: colors.blueDeep, color: colors.white,
    fontSize: fontSizes.xs, fontFamily: fonts.body, fontWeight: fontWeights.semibold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  clientName: {
    fontFamily: fonts.body, fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold, color: colors.blueDeep,
  },
  clientMeta: {
    fontFamily: fonts.body, fontSize: fontSizes.xs,
    color: colors.textLight, marginTop: '2px',
  },
  headerHint: {
    fontFamily: fonts.body, fontSize: fontSizes.xs,
    color: colors.textLight, letterSpacing: letterSpacings.wide,
  },
  messages: {
    height: '460px',
    overflowY: 'auto' as const,
    padding: spacing[5],
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[4],
    backgroundColor: colors.offWhite,
  },
  emptyChat: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center' as const,
  },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: spacing[2] },
  avatarClient: {
    width: '28px', height: '28px', borderRadius: '50%',
    backgroundColor: colors.bluePale, color: colors.blue,
    fontSize: '0.6rem', fontFamily: fonts.body, fontWeight: fontWeights.bold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  avatarCons: {
    width: '28px', height: '28px', borderRadius: '50%',
    backgroundColor: colors.gold, color: colors.white,
    fontSize: '0.6rem', fontFamily: fonts.body, fontWeight: fontWeights.bold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  bubble: {
    maxWidth: '65%', padding: `${spacing[3]} ${spacing[4]}`,
    display: 'flex', flexDirection: 'column' as const, gap: spacing[1],
  },
  msgTime: {
    fontFamily: fonts.body, fontSize: '0.6rem', letterSpacing: letterSpacings.wide,
    display: 'flex', alignItems: 'center',
  } as React.CSSProperties,
  inputBar: {
    display: 'flex', alignItems: 'flex-end', gap: spacing[3],
    padding: spacing[4], borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.white,
  },
  sendBtn: {
    width: '44px', height: '44px', flexShrink: 0,
    backgroundColor: colors.gold, color: colors.white,
    border: 'none', fontSize: '1.1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,
}
