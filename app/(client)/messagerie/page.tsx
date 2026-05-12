'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  colors, fonts, fontSizes, fontWeights, spacing, shadows,
  letterSpacings, cardBase, sectionLabel, inputBase,
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

export default function MessageriePage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [clientId, setClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initSession()
  }, [])

  const initSession = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: roleData } = await supabase
      .from('user_roles').select('role, client_id').eq('user_id', user.id).single()
    if (roleData?.role !== 'client' || !roleData.client_id) { router.push('/login'); return }

    setClientId(roleData.client_id)
    await loadMessages(roleData.client_id)

    // Marquer les messages du conseiller comme lus
    await supabase.from('messagerie')
      .update({ lu: true })
      .eq('client_id', roleData.client_id)
      .eq('expediteur', 'conseiller')
      .eq('lu', false)

    setLoading(false)
  }

  const loadMessages = async (cid: string) => {
    const { data } = await supabase
      .from('messagerie')
      .select('*')
      .eq('client_id', cid)
      .order('created_at', { ascending: true })
    setMessages((data ?? []) as Message[])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleSend = async () => {
    if (!message.trim() || !clientId || sending) return
    setSending(true)

    const { data } = await supabase.from('messagerie')
      .insert({ client_id: clientId, expediteur: 'client', contenu: message.trim() })
      .select().single()

    if (data) {
      setMessages(prev => [...prev, data as Message])
      setMessage('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (loading) {
    return (
      <div style={s.loadingWrap}>
        <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid }}>Chargement…</p>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.eyebrow}><div style={s.rule} /><span style={s.eyebrowText}>Messagerie sécurisée</span></div>
        <h1 style={s.title}>Contacter mon conseiller</h1>
      </div>

      <div style={{ ...cardBase, ...s.chatWrap }}>
        {/* Zone messages */}
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.emptyChat}>
              <p style={{ fontSize: '2rem' }}>💬</p>
              <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMid, marginTop: spacing[3] }}>
                Commencez à écrire pour contacter votre conseiller AMP CONSEIL.
              </p>
            </div>
          )}
          {messages.map(msg => {
            const isClient = msg.expediteur === 'client'
            return (
              <div key={msg.id} style={{ ...s.msgRow, justifyContent: isClient ? 'flex-end' : 'flex-start' }}>
                {!isClient && <div style={s.avatarCons}>AC</div>}
                <div style={{
                  ...s.bubble,
                  backgroundColor: isClient ? colors.blueDeep : colors.white,
                  color: isClient ? colors.white : colors.text,
                  border: isClient ? 'none' : `1px solid ${colors.border}`,
                  alignItems: isClient ? 'flex-end' : 'flex-start',
                }}>
                  <p style={{ fontFamily: fonts.body, fontSize: fontSizes.base, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
                    {msg.contenu}
                  </p>
                  <span style={{ ...s.msgTime, color: isClient ? 'rgba(255,255,255,0.5)' : colors.textLight }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                {isClient && <div style={s.avatarClient}>Moi</div>}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Zone saisie */}
        <div style={s.inputBar}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Votre message… (Entrée pour envoyer)"
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
        <p style={s.disclaimer}>
          Messagerie sécurisée AMP CONSEIL — Les réponses sont traitées dans les meilleurs délais (1–2 jours ouvrés).
        </p>
      </div>
    </div>
  )
}

const s = {
  page: { maxWidth: '760px' },
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' },
  header: { marginBottom: spacing[6] },
  eyebrow: { display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  rule: { width: '32px', height: '2px', backgroundColor: colors.gold },
  eyebrowText: { ...sectionLabel } as React.CSSProperties,
  title: {
    fontFamily: fonts.heading, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
    fontWeight: fontWeights.light, color: colors.blueDeep, letterSpacing: '-0.01em',
  },
  chatWrap: { boxShadow: shadows.sm, overflow: 'hidden' },
  messages: {
    height: '420px',
    overflowY: 'auto' as const,
    padding: spacing[5],
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[4],
    backgroundColor: colors.offWhite,
  },
  emptyChat: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: spacing[2] },
  avatarCons: {
    width: '30px', height: '30px', borderRadius: '50%',
    backgroundColor: colors.blueDeep, color: colors.goldLight,
    fontSize: '0.6rem', fontFamily: fonts.body, fontWeight: fontWeights.bold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  avatarClient: {
    width: '30px', height: '30px', borderRadius: '50%',
    backgroundColor: colors.bluePale, color: colors.blue,
    fontSize: '0.6rem', fontFamily: fonts.body, fontWeight: fontWeights.bold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  bubble: {
    maxWidth: '65%', padding: `${spacing[3]} ${spacing[4]}`,
    display: 'flex', flexDirection: 'column' as const, gap: spacing[1],
  },
  msgTime: {
    fontFamily: fonts.body, fontSize: '0.6rem', letterSpacing: letterSpacings.wide,
  } as React.CSSProperties,
  inputBar: {
    display: 'flex', alignItems: 'flex-end', gap: spacing[3],
    padding: spacing[4], borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.white,
  },
  sendBtn: {
    width: '44px', height: '44px', flexShrink: 0,
    backgroundColor: colors.gold, color: colors.white,
    border: 'none', fontSize: '1.1rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,
  disclaimer: {
    fontFamily: fonts.body, fontSize: '0.6rem', color: colors.textLight,
    padding: `${spacing[2]} ${spacing[4]}`, letterSpacing: letterSpacings.wide,
    backgroundColor: colors.offWhite, borderTop: `1px solid ${colors.border}`,
  },
}
