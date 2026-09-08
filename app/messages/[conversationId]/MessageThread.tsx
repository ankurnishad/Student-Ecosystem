'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const PAGE_SIZE = 50
const MESSAGE_SELECT = 'id, conversation_id, sender_id, content, message_type, reply_to, created_at, updated_at, deleted_at'

export default function MessageThread({ conversationId, currentUserId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const shouldScrollToBottom = useRef(false)

  const loadInitialMessages = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)

    if (loadError) {
      setError('Messages load nahi ho paaye.')
      setMessages([])
      setHasMore(false)
    } else {
      const page = (data ?? []) as Message[]
      setMessages(page.reverse())
      setHasMore(page.length === PAGE_SIZE)
      shouldScrollToBottom.current = true
    }
    setLoading(false)
  }, [conversationId, supabase])

  useEffect(() => {
    let active = true

    async function load() {
      if (!active) return
      await loadInitialMessages()
    }

    load()
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const message = payload.new as Message
          setMessages((current) => {
            if (current.some((item) => item.id === message.id)) return current
            shouldScrollToBottom.current = true
            return [...current, message]
          })
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
  }, [conversationId, loadInitialMessages, supabase])

  useEffect(() => {
    if (!shouldScrollToBottom.current) return
    shouldScrollToBottom.current = false
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function loadOlderMessages() {
    if (loadingOlder || !hasMore || messages.length === 0) return

    const container = scrollRef.current
    const oldest = messages[0]
    setLoadingOlder(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .or(`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)

    if (loadError) {
      setError('Older messages load nahi ho paaye.')
      setLoadingOlder(false)
      return
    }

    const older = ((data ?? []) as Message[]).reverse()
    if (older.length === 0) {
      setHasMore(false)
    } else {
      const previousHeight = container?.scrollHeight ?? 0
      const previousTop = container?.scrollTop ?? 0
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id))
        return [...older.filter((message) => !existing.has(message.id)), ...current]
      })
      requestAnimationFrame(() => {
        if (!container) return
        container.scrollTop = previousTop + (container.scrollHeight - previousHeight)
      })
      setHasMore(older.length === PAGE_SIZE)
    }

    setLoadingOlder(false)
  }

  function handleScroll() {
    const container = scrollRef.current
    if (!container || loadingOlder || !hasMore) return
    if (container.scrollTop <= 80) void loadOlderMessages()
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = text.trim()
    if (!content || sending) return

    setSending(true)
    setError('')
    shouldScrollToBottom.current = true

    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        message_type: 'text',
      })
      .select(MESSAGE_SELECT)
      .single()

    if (sendError) {
      shouldScrollToBottom.current = false
      setError('Message send nahi ho paaya. Please try again.')
    } else if (data) {
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as Message])
      setText('')
    }
    setSending(false)
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ minHeight: 320, maxHeight: 520, overflowY: 'auto', border: '1px solid #ddd', padding: 16 }}
      >
        {loading ? (
          <p>Messages load ho rahe hain…</p>
        ) : messages.length === 0 ? (
          <p>Abhi koi message nahi hai. Pehla message bhejo.</p>
        ) : (
          <>
            {hasMore && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <button type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlder}>
                  {loadingOlder ? 'Older messages load ho rahe hain…' : 'Purane messages load karo'}
                </button>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} style={{ display: 'flex', justifyContent: message.sender_id === currentUserId ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: 12, background: message.sender_id === currentUserId ? '#e5e7eb' : '#f3f4f6' }}>
                  {message.deleted_at ? <em>Message deleted</em> : message.content}
                </div>
              </div>
            ))}
          </>
        )}
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
