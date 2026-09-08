'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = { id: string; group_id: string; sender_id: string; content: string; reply_to: string | null; created_at: string; deleted_at: string | null }

export default function GroupThread({ groupId, currentUserId }: { groupId: string; currentUserId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    void supabase.from('group_messages').select('id,group_id,sender_id,content,reply_to,created_at,deleted_at').eq('group_id', groupId).order('created_at', { ascending: true }).limit(100).then(({ data }) => { if (active) setMessages((data ?? []) as Message[]) })
    const channel = supabase.channel(`group:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        const message = payload.new as Message
        setMessages((current) => current.some((m) => m.id === message.id) ? current : [...current, message])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        const message = payload.new as Message
        setMessages((current) => current.map((m) => m.id === message.id ? message : m))
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.user_id === currentUserId) return
        setTyping(true)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(false), 1500)
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') channelRef.current = channel })
    return () => { active = false; if (typingTimer.current) clearTimeout(typingTimer.current); channelRef.current = null; void supabase.removeChannel(channel) }
  }, [currentUserId, groupId, supabase])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function send(event: FormEvent) {
    event.preventDefault(); const content = text.trim(); if (!content) return
    const { data, error } = await supabase.from('group_messages').insert({ group_id: groupId, sender_id: currentUserId, content, reply_to: replyTo?.id ?? null }).select('id,group_id,sender_id,content,reply_to,created_at,deleted_at').single()
    if (!error && data) setMessages((current) => current.some((m) => m.id === data.id) ? current : [...current, data as Message])
    setText(''); setReplyTo(null)
  }

  function changeText(value: string) { setText(value); if (value.trim() && channelRef.current) void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: currentUserId } }) }

  return <section style={{ display: 'grid', gap: 10 }}>
    <div style={{ minHeight: 420, maxHeight: 620, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 16, padding: 16 }}>
      {messages.map((message) => <div key={message.id} style={{ marginBottom: 10, textAlign: message.sender_id === currentUserId ? 'right' : 'left' }}><span style={{ display: 'inline-block', maxWidth: '80%', padding: 10, borderRadius: 12, background: message.sender_id === currentUserId ? '#e8eefc' : '#f3f4f6' }}>{message.reply_to && <small>↪ Reply</small>}<br />{message.deleted_at ? <em>Message deleted</em> : message.content}</span><br /><button type="button" onClick={() => setReplyTo(message)}>Reply</button></div>)}
      <div ref={bottomRef} />
    </div>
    {typing && <small>Someone is typing…</small>}
    {replyTo && <div>Replying to: {replyTo.content.slice(0, 80)} <button type="button" onClick={() => setReplyTo(null)}>Cancel</button></div>}
    <form onSubmit={send} style={{ display: 'flex', gap: 8 }}><input value={text} onChange={(e) => changeText(e.target.value)} placeholder="Message group…" maxLength={4000} /><button type="submit">Send</button></form>
  </section>
}
