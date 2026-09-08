'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  message_type: string
  reply_to: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type Props = {
  conversationId: string
  currentUserId: string
}

export default function MessageThread({ conversationId, currentUserId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    async function loadMessages() {
      setLoading(true)
      setError('')
      const { data, error: loadError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, message_type, reply_to, created_at, updated_at, deleted_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (!active) return
      if (loadError) setError('Messages load nahi ho paaye.')
      else setMessages((data ?? []) as Message[])
      setLoading(false)
    }

    loadMessages()
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const message = payload.new as Message
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const message = payload.new as Message
          setMessages((current) => current.map((item) => item.id === message.id ? message : item))
        },
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = text.trim()
    if (!content || sending) return

    setSending(true)
    setError('')
    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        message_type: 'text',
      })
      .select('id, conversation_id, sender_id, content, message_type, reply_to, created_at, updated_at, deleted_at')
      .single()

    if (sendError) {
      setError('Message send nahi ho paaya. Please try again.')
    } else if (data) {
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as Message])
      setText('')
    }
    setSending(false)
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ minHeight: 320, maxHeight: 520, overflowY: 'auto', border: '1px solid #ddd', padding: 16 }}>
        {loading ? <p>Messages load ho rahe hain…</p> : messages.length === 0 ? <p>Abhi koi message nahi hai. Pehla message bhejo.</p> : messages.map((message) => (
          <div key={message.id} style={{ display: 'flex', justifyContent: message.sender_id === currentUserId ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: 12, background: message.sender_id === currentUserId ? '#e5e7eb' : '#f3f4f6' }}>
              {message.deleted_at ? <em>Message deleted</em> : message.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Message likho…"
          maxLength={4000}
          disabled={sending}
          style={{ flex: 1 }}
          aria-label="Message"
        />
        <button type="submit" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
