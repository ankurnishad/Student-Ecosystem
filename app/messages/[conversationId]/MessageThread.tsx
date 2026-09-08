'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, CheckCheck, FileText, Paperclip, Pencil, Reply, Send, Trash2, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Message = { id: string; conversation_id: string; sender_id: string; content: string | null; message_type: string; reply_to: string | null; created_at: string; updated_at: string; deleted_at: string | null }
type Attachment = { id: string; message_id: string; storage_path: string; file_name: string; file_type: string; file_size: number; url?: string }
type Props = { conversationId: string; currentUserId: string }

type PresenceUser = { user_id: string; online_at?: string }

const PAGE_SIZE = 50
const MESSAGE_SELECT = 'id, conversation_id, sender_id, content, message_type, reply_to, created_at, updated_at, deleted_at'
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const FILE_TYPES = new Set(['application/pdf', 'text/plain', 'application/zip', 'application/octet-stream'])
const MAX_IMAGE = 15 * 1024 * 1024
const MAX_FILE = 50 * 1024 * 1024

export default function MessageThread({ conversationId, currentUserId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const shouldScrollToBottom = useRef(false)

  const loadAttachments = useCallback(async (items: Message[]) => {
    if (!items.length) return
    const ids = items.map((m) => m.id)
    const { data } = await supabase.from('message_attachments').select('id, message_id, storage_path, file_name, file_type, file_size').in('message_id', ids)
    if (!data) return
    const grouped: Record<string, Attachment[]> = {}
    for (const item of data as Attachment[]) {
      const bucket = IMAGE_TYPES.has(item.file_type) ? 'chat-images' : 'chat-files'
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(item.storage_path, 3600)
      ;(grouped[item.message_id] ??= []).push({ ...item, url: signed?.signedUrl })
    }
    setAttachments((current) => ({ ...current, ...grouped }))
  }, [supabase])

  const markRead = useCallback(async () => {
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
  }, [conversationId, supabase])

  const loadReads = useCallback(async (items: Message[]) => {
    const ids = items.filter((m) => m.sender_id === currentUserId).map((m) => m.id)
    if (!ids.length) return
    const { data } = await supabase.from('message_reads').select('message_id, user_id').in('message_id', ids).neq('user_id', currentUserId)
    if (data) setReadIds(new Set(data.map((row) => row.message_id)))
  }, [currentUserId, supabase])

  const loadInitialMessages = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: loadError } = await supabase.from('messages').select(MESSAGE_SELECT).eq('conversation_id', conversationId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE)
    if (loadError) { setError('Messages load nahi ho paaye.'); setMessages([]); setHasMore(false) }
    else { const page = (data ?? []) as Message[]; page.reverse(); setMessages(page); setHasMore(page.length === PAGE_SIZE); shouldScrollToBottom.current = true; await Promise.all([loadAttachments(page), loadReads(page), markRead()]) }
    setLoading(false)
  }, [conversationId, loadAttachments, loadReads, markRead, supabase])

  useEffect(() => {
    void loadInitialMessages()
    const channel = supabase.channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        const message = payload.new as Message
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
        shouldScrollToBottom.current = true
        if (message.sender_id !== currentUserId) { await markRead(); void loadAttachments([message]) }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const message = payload.new as Message
        setMessages((current) => current.map((item) => item.id === message.id ? message : item))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads' }, (payload) => {
        const row = payload.new as { message_id: string; user_id: string }
        if (row.user_id !== currentUserId) setReadIds((current) => new Set(current).add(row.message_id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_reads' }, (payload) => {
        const row = payload.new as { message_id: string; user_id: string }
        if (row.user_id !== currentUserId) setReadIds((current) => new Set(current).add(row.message_id))
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const userId = payload.payload?.user_id as string | undefined
        if (!userId || userId === currentUserId) return
        setTypingUsers((current) => new Set(current).add(userId))
        const oldTimer = typingTimers.current[userId]
        if (oldTimer) clearTimeout(oldTimer)
        typingTimers.current[userId] = setTimeout(() => {
          setTypingUsers((current) => { const next = new Set(current); next.delete(userId); return next })
          delete typingTimers.current[userId]
        }, 1800)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        const ids = new Set<string>()
        Object.values(state).flat().forEach((entry) => { if (entry.user_id) ids.add(entry.user_id) })
        setOnlineUsers(ids)
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== currentUserId) setOnlineUsers((current) => new Set(current).add(key))
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== currentUserId) setOnlineUsers((current) => { const next = new Set(current); next.delete(key); return next })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() })
        }
      })
    channelRef.current = channel
    return () => { channelRef.current = null; Object.values(typingTimers.current).forEach(clearTimeout); typingTimers.current = {}; void channel.untrack(); void supabase.removeChannel(channel) }
  }, [conversationId, currentUserId, loadAttachments, loadInitialMessages, markRead, supabase])

  useEffect(() => { if (!shouldScrollToBottom.current) return; shouldScrollToBottom.current = false; bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function loadOlderMessages() {
    if (loadingOlder || !hasMore || !messages.length) return
    const container = scrollRef.current; const oldest = messages[0]; setLoadingOlder(true); setError('')
    const { data, error: loadError } = await supabase.from('messages').select(MESSAGE_SELECT).eq('conversation_id', conversationId).or(`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE)
    if (loadError) setError('Older messages load nahi ho paaye.')
    else { const older = ((data ?? []) as Message[]).reverse(); if (!older.length) setHasMore(false); else { const h = container?.scrollHeight ?? 0; const t = container?.scrollTop ?? 0; setMessages((current) => { const ids = new Set(current.map((m) => m.id)); return [...older.filter((m) => !ids.has(m.id)), ...current] }); void loadAttachments(older); void loadReads(older); setHasMore(older.length === PAGE_SIZE); requestAnimationFrame(() => { if (container) container.scrollTop = t + container.scrollHeight - h }) } }
    setLoadingOlder(false)
  }

  function handleScroll() { const c = scrollRef.current; if (c && c.scrollTop <= 80 && hasMore && !loadingOlder) void loadOlderMessages() }

  function handleTextChange(value: string) {
    setText(value)
    if (!value.trim() || editing) return
    const channel = channelRef.current
    if (channel) void channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: currentUserId } })
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const content = text.trim(); if ((!content && !file) || sending) return
    setSending(true); setError('')
    if (editing) {
      const { data, error: updateError } = await supabase.from('messages').update({ content }).eq('id', editing.id).eq('sender_id', currentUserId).select(MESSAGE_SELECT).single()
      if (updateError || !data) setError('Message edit nahi ho paaya.')
      else { setMessages((current) => current.map((m) => m.id === editing.id ? data as Message : m)); setEditing(null); setText('') }
      setSending(false); return
    }
    let uploaded: { path: string; bucket: string } | null = null
    if (file) {
      const isImage = IMAGE_TYPES.has(file.type); const allowed = isImage || FILE_TYPES.has(file.type); const max = isImage ? MAX_IMAGE : MAX_FILE
      if (!allowed) { setError('Ye file type supported nahi hai.'); setSending(false); return }
      if (file.size <= 0 || file.size > max) { setError(`File size limit ${isImage ? '15 MB' : '50 MB'} hai.`); setSending(false); return }
      const bucket = isImage ? 'chat-images' : 'chat-files'; const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'attachment'; const path = `${conversationId}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) { setError('File upload nahi ho paayi.'); setSending(false); return }
      uploaded = { path, bucket }
    }
    const messageType = uploaded ? (IMAGE_TYPES.has(file!.type) ? 'image' : file!.type === 'application/pdf' ? 'pdf' : 'file') : 'text'
    const { data, error: sendError } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: currentUserId, content: content || null, message_type: messageType, reply_to: replyTo?.id ?? null }).select(MESSAGE_SELECT).single()
    if (sendError || !data) { if (uploaded) await supabase.storage.from(uploaded.bucket).remove([uploaded.path]); setError('Message send nahi ho paaya.'); setSending(false); return }
    const message = data as Message
    if (uploaded) {
      const { error: attachmentError } = await supabase.from('message_attachments').insert({ message_id: message.id, storage_path: uploaded.path, file_name: file!.name, file_type: file!.type, file_size: file!.size })
      if (attachmentError) { await supabase.from('messages').delete().eq('id', message.id); await supabase.storage.from(uploaded.bucket).remove([uploaded.path]); setError('Attachment save nahi ho paaya.'); setSending(false); return }
    }
    setMessages((current) => current.some((m) => m.id === message.id) ? current : [...current, message]); if (uploaded) void loadAttachments([message]); setText(''); setReplyTo(null); setFile(null); setSending(false); shouldScrollToBottom.current = true
  }

  async function deleteMessage(message: Message) {
    setActionId(message.id); const deletedAt = new Date().toISOString(); const { error: deleteError } = await supabase.from('messages').update({ deleted_at: deletedAt, content: null }).eq('id', message.id).eq('sender_id', currentUserId)
    if (deleteError) setError('Message delete nahi ho paaya.'); else setMessages((current) => current.map((m) => m.id === message.id ? { ...m, deleted_at: deletedAt, content: null } : m)); setActionId(null)
  }

  const formatTime = (value: string) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  const otherOnline = onlineUsers.size > 1
  const otherTyping = typingUsers.size > 0

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, opacity: .75 }}><UserRound size={16} />{otherOnline ? 'Online' : 'Offline'}{otherTyping ? ' · typing…' : ''}</div>
      <div ref={scrollRef} onScroll={handleScroll} style={{ minHeight: 420, maxHeight: 620, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 16, padding: 16 }}>
        {loading ? <p>Messages load ho rahe hain…</p> : !messages.length ? <p>Abhi koi message nahi hai. Pehla message bhejo.</p> : <>
          {hasMore && <div style={{ textAlign: 'center', marginBottom: 12 }}><button type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlder}>{loadingOlder ? 'Loading…' : 'Purane messages load karo'}</button></div>}
          {messages.map((message) => {
            const mine = message.sender_id === currentUserId; const reply = message.reply_to ? messages.find((m) => m.id === message.reply_to) : null; const messageAttachments = attachments[message.id] ?? []
            return <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}><div style={{ maxWidth: '82%', minWidth: 80, padding: '10px 12px', borderRadius: 14, background: mine ? '#e8eefc' : '#f3f4f6' }}>
              {reply && <div style={{ fontSize: 12, borderLeft: '3px solid #888', paddingLeft: 8, marginBottom: 7, opacity: .75 }}>{reply.content ?? 'Attachment message'}</div>}
              {message.deleted_at ? <em>Message deleted</em> : <>{message.content && <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.content}{message.updated_at !== message.created_at ? <small> (edited)</small> : null}</div>}{messageAttachments.map((attachment) => IMAGE_TYPES.has(attachment.file_type) && attachment.url ? <img key={attachment.id} src={attachment.url} alt={attachment.file_name} style={{ maxWidth: 280, maxHeight: 320, borderRadius: 10, display: 'block', marginTop: 8 }} /> : <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 8 }}><FileText size={18} />{attachment.file_name}</a>)}</>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, fontSize: 11, opacity: .65 }}><span>{formatTime(message.created_at)}</span>{mine && (readIds.has(message.id) ? <CheckCheck size={15} aria-label="Read" /> : <Check size={15} aria-label="Sent" />)}</div>
              {!message.deleted_at && <div style={{ display: 'flex', gap: 5, marginTop: 7 }}><button type="button" onClick={() => setReplyTo(message)} title="Reply"><Reply size={15} /></button>{mine && <><button type="button" onClick={() => { setEditing(message); setText(message.content ?? '') }} title="Edit"><Pencil size={15} /></button><button type="button" onClick={() => void deleteMessage(message)} disabled={actionId === message.id} title="Delete"><Trash2 size={15} /></button></>}</div>}
            </div></div>
          })}
        </>}
        <div ref={bottomRef} />
      </div>
      {(replyTo || editing || file) && <div style={{ padding: 10, border: '1px solid #ddd', borderRadius: 10 }}>{replyTo && <div><strong>Reply:</strong> {replyTo.content ?? 'Attachment'} <button type="button" onClick={() => setReplyTo(null)}><X size={14} /></button></div>}{editing && <div><strong>Editing message</strong> <button type="button" onClick={() => { setEditing(null); setText('') }}><X size={14} /></button></div>}{file && <div><strong>File:</strong> {file.name} <button type="button" onClick={() => setFile(null)}><X size={14} /></button></div>}</div>}
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!editing && <label title="Attach image/file" style={{ cursor: sending ? 'not-allowed' : 'pointer' }}><Paperclip size={20} /><input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/zip,application/octet-stream" disabled={sending} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>}
        <input value={text} onChange={(event) => handleTextChange(event.target.value)} placeholder={editing ? 'Message edit karo…' : 'Message likho…'} maxLength={4000} disabled={sending} style={{ flex: 1 }} aria-label="Message" />
        <button type="submit" disabled={sending || (!text.trim() && !file)}>{sending ? 'Sending…' : editing ? 'Save' : <Send size={18} />}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
