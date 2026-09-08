'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  data: { group_id?: string; message_id?: string }
  read_at: string | null
  created_at: string
}

export default function Notifications({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<Notification[]>([])
  const [status, setStatus] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('notifications')
      .select('id,type,title,body,data,read_at,created_at')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) setStatus('Notifications load nahi ho paayi.')
    else setItems((data ?? []) as Notification[])
  }

  useEffect(() => {
    void load()
    const channel = supabase
      .channel(`notifications:${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, (payload) => {
        setItems((current) => [payload.new as Notification, ...current].slice(0, 30))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, (payload) => {
        setItems((current) => current.map((item) => item.id === payload.new.id ? payload.new as Notification : item))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [currentUserId, supabase])

  async function markRead(id: string) {
    const { error } = await supabase.rpc('mark_notifications_read', { p_notification_ids: [id] })
    if (error) setStatus('Notification read nahi hui.')
    else setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  async function markAllRead() {
    const ids = items.filter((item) => !item.read_at).map((item) => item.id)
    if (!ids.length) return
    const { error } = await supabase.rpc('mark_notifications_read', { p_notification_ids: ids })
    if (error) setStatus('Notifications read nahi hui.')
    else setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: new Date().toISOString() }))
  }

  const unread = items.filter((item) => !item.read_at).length

  return <section style={{ marginBottom: 24, border: '1px solid #ddd', borderRadius: 14, padding: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <h2 style={{ margin: 0 }}>Notifications {unread > 0 ? `(${unread})` : ''}</h2>
      <button onClick={() => void markAllRead()} disabled={!unread}>Mark all read</button>
    </div>
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      {items.map((item) => {
        const groupId = item.data?.group_id
        const content = <div style={{ padding: 10, borderRadius: 10, background: item.read_at ? 'transparent' : '#f3f4f6' }}>
          <strong>{item.title}</strong>
          {item.body && <p style={{ margin: '4px 0' }}>{item.body}</p>}
          <small>{new Date(item.created_at).toLocaleString()}</small>
        </div>
        return <article key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {groupId ? <Link href={`/groups/${groupId}`} style={{ flex: 1 }}>{content}</Link> : <div style={{ flex: 1 }}>{content}</div>}
          {!item.read_at && <button onClick={() => void markRead(item.id)}>Read</button>}
        </article>
      })}
      {!items.length && <p style={{ margin: 0 }}>No notifications yet.</p>}
    </div>
    {status && <p role="status">{status}</p>}
  </section>
}
