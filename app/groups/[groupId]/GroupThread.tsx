'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = { id: string; group_id: string; sender_id: string; content: string; reply_to: string | null; created_at: string; deleted_at: string | null; updated_at: string }
type Attachment = { id: string; message_id: string; storage_path: string; file_name: string; file_type: string; file_size: number; url?: string }
type Member = { user_id: string; role: string; profiles: { display_name: string | null; username: string | null } | null }
type Pin = { message_id: string; pinned_by: string; pinned_at: string }

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const FILE_TYPES = new Set(['application/pdf', 'text/plain', 'application/zip', 'application/octet-stream'])
const MAX_IMAGE = 15 * 1024 * 1024
const MAX_FILE = 50 * 1024 * 1024

export default function GroupThread({ groupId, currentUserId }: { groupId: string; currentUserId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const [members, setMembers] = useState<Member[]>([])
  const [pins, setPins] = useState<Record<string, Pin>>({})
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [typing, setTyping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showPins, setShowPins] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canPin = members.some((member) => member.user_id === currentUserId && ['owner', 'admin', 'moderator'].includes(member.role))

  async function loadAttachments(messageIds: string[]) {
    if (!messageIds.length) return
    const { data } = await supabase.from('group_message_attachments').select('id,message_id,storage_path,file_name,file_type,file_size').in('message_id', messageIds)
    const grouped: Record<string, Attachment[]> = {}
    for (const item of (data ?? []) as Attachment[]) {
      const bucket = IMAGE_TYPES.has(item.file_type) ? 'group-images' : 'chat-files'
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(item.storage_path, 3600)
      grouped[item.message_id] = [...(grouped[item.message_id] ?? []), { ...item, url: signed?.signedUrl }]
    }
    setAttachments((current) => ({ ...current, ...grouped }))
  }

  async function loadPins() {
    const { data } = await supabase.from('group_message_pins').select('message_id,pinned_by,pinned_at').eq('group_id', groupId).order('pinned_at', { ascending: false })
    const next: Record<string, Pin> = {}
    for (const pin of (data ?? []) as Pin[]) next[pin.message_id] = pin
    setPins(next)
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      supabase.from('group_messages').select('id,group_id,sender_id,content,reply_to,created_at,deleted_at,updated_at').eq('group_id', groupId).order('created_at', { ascending: true }).limit(100),
      supabase.from('group_members').select('user_id,role,profiles(display_name,username)').eq('group_id', groupId),
      supabase.from('group_message_pins').select('message_id,pinned_by,pinned_at').eq('group_id', groupId).order('pinned_at', { ascending: false })
    ]).then(async ([messageResult, memberResult, pinResult]) => {
      if (!active) return
      const loaded = (messageResult.data ?? []) as Message[]
      setMessages(loaded)
      setMembers((memberResult.data ?? []) as unknown as Member[])
      const next: Record<string, Pin> = {}
      for (const pin of (pinResult.data ?? []) as Pin[]) next[pin.message_id] = pin
      setPins(next)
      await loadAttachments(loaded.map((m) => m.id))
    })

    const channel = supabase.channel(`group:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        const message = payload.new as Message
        setMessages((current) => current.some((m) => m.id === message.id) ? current : [...current, message])
        void loadAttachments([message.id])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        const message = payload.new as Message
        setMessages((current) => current.map((m) => m.id === message.id ? message : m))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_message_pins', filter: `group_id=eq.${groupId}` }, (payload) => {
        const pin = payload.new as Pin
        setPins((current) => ({ ...current, [pin.message_id]: pin }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_message_pins', filter: `group_id=eq.${groupId}` }, (payload) => {
        const pin = payload.old as Pin
        setPins((current) => { const next = { ...current }; delete next[pin.message_id]; return next })
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

  function parseMentions(content: string) {
    const names = [...content.matchAll(/@([a-z0-9_]{3,24})/gi)].map((match) => match[1].toLowerCase())
    return [...new Set(names)].map((name) => members.find((m) => m.profiles?.username?.toLowerCase() === name)?.user_id).filter((id): id is string => Boolean(id) && id !== currentUserId)
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    const content = text.trim()
    if (!content || uploading) return
    const { data, error } = await supabase.from('group_messages').insert({ group_id: groupId, sender_id: currentUserId, content, reply_to: replyTo?.id ?? null }).select('id,group_id,sender_id,content,reply_to,created_at,deleted_at,updated_at').single()
    if (error || !data) return
    const message = data as Message
    setMessages((current) => current.some((m) => m.id === message.id) ? current : [...current, message])
    const mentioned = parseMentions(content)
    if (mentioned.length) await supabase.from('group_message_mentions').insert(mentioned.map((userId) => ({ message_id: message.id, mentioned_user_id: userId })))
    setText(''); setReplyTo(null)
  }

  async function uploadFile(file: File) {
    const isImage = IMAGE_TYPES.has(file.type)
    if ((!isImage && !FILE_TYPES.has(file.type)) || file.size <= 0 || file.size > (isImage ? MAX_IMAGE : MAX_FILE)) return
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
    const path = `${groupId}/${crypto.randomUUID()}-${safeName}`
    const bucket = isImage ? 'group-images' : 'chat-files'
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) { setUploading(false); return }
    const { data, error } = await supabase.from('group_messages').insert({ group_id: groupId, sender_id: currentUserId, content: file.name, reply_to: replyTo?.id ?? null }).select('id,group_id,sender_id,content,reply_to,created_at,deleted_at,updated_at').single()
    if (!data || error) { await supabase.storage.from(bucket).remove([path]); setUploading(false); return }
    const { error: attachmentError } = await supabase.from('group_message_attachments').insert({ message_id: data.id, storage_path: path, file_name: file.name, file_type: file.type, file_size: file.size })
    if (attachmentError) { await supabase.from('group_messages').delete().eq('id', data.id); await supabase.storage.from(bucket).remove([path]); setUploading(false); return }
    setMessages((current) => current.some((m) => m.id === data.id) ? current : [...current, data as Message])
    await loadAttachments([data.id])
    setReplyTo(null); setUploading(false)
  }

  async function togglePin(messageId: string) {
    if (!canPin) return
    if (pins[messageId]) {
      const { error } = await supabase.rpc('unpin_group_message', { p_group_id: groupId, p_message_id: messageId })
      if (!error) setPins((current) => { const next = { ...current }; delete next[messageId]; return next })
    } else {
      const { data, error } = await supabase.rpc('pin_group_message', { p_group_id: groupId, p_message_id: messageId })
      if (!error && data) setPins((current) => ({ ...current, [messageId]: data as Pin }))
    }
  }

  function changeText(value: string) { setText(value); if (value.trim() && channelRef.current) void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: currentUserId } }) }

  const pinnedMessages = messages.filter((message) => Boolean(pins[message.id]))

  return <section style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <strong>Group chat</strong>
      <button type="button" onClick={() => setShowPins((value) => !value)}>{showPins ? 'Hide pins' : `Pinned (${pinnedMessages.length})`}</button>
    </div>
    {showPins && <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 10 }}>{pinnedMessages.length ? pinnedMessages.map((message) => <button key={message.id} type="button" onClick={() => document.getElementById(`group-message-${message.id}`)?.scrollIntoView({ behavior: 'smooth' })} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8 }}>{message.content.slice(0, 120)} <small>📌</small></button>) : <small>No pinned messages.</small>}</div>}
    <div style={{ minHeight: 420, maxHeight: 620, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 16, padding: 16 }}>
      {messages.map((message) => <div id={`group-message-${message.id}`} key={message.id} style={{ marginBottom: 14, textAlign: message.sender_id === currentUserId ? 'right' : 'left' }}>
        <span style={{ display: 'inline-block', maxWidth: '80%', padding: 10, borderRadius: 12, background: message.sender_id === currentUserId ? '#e8eefc' : '#f3f4f6' }}>
          {pins[message.id] && <small>📌 Pinned</small>}
          {message.reply_to && <small>↪ Replying to a message</small>}
          <br />
          {message.deleted_at ? <em>Message deleted</em> : message.content}
          {(attachments[message.id] ?? []).map((attachment) => attachment.url ? <div key={attachment.id} style={{ marginTop: 8 }}>{IMAGE_TYPES.has(attachment.file_type) ? <img src={attachment.url} alt={attachment.file_name} style={{ maxWidth: 260, borderRadius: 10 }} /> : <a href={attachment.url} target="_blank" rel="noreferrer">📎 {attachment.file_name}</a>}</div> : null)}
        </span>
        <br />
        <button type="button" onClick={() => setReplyTo(message)}>Reply</button>
        {canPin && <button type="button" onClick={() => void togglePin(message.id)}>{pins[message.id] ? 'Unpin' : 'Pin'}</button>}
      </div>)}
      <div ref={bottomRef} />
    </div>
    {typing && <small>Someone is typing…</small>}
    {replyTo && <div>Replying to: {replyTo.content.slice(0, 80)} <button type="button" onClick={() => setReplyTo(null)}>Cancel</button></div>}
    <form onSubmit={send} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input value={text} onChange={(e) => changeText(e.target.value)} placeholder="Message group… @username mention kar sakte ho" maxLength={4000} />
      <label><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/zip,application/octet-stream" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFile(file); e.currentTarget.value = '' }} /> Attach</label>
      <button type="submit" disabled={uploading}>Send</button>
    </form>
  </section>
}
