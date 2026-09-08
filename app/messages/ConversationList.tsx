'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = { id: string; name: string; username: string; preview: string; createdAt: string; muted: boolean; archived: boolean; pinned: boolean; otherId: string }

export default function ConversationList({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [status, setStatus] = useState('')

  async function load() {
    const { data } = await supabase.from('conversation_members').select('conversation_id,muted_until,archived_at,pinned_at').eq('user_id', currentUserId).order('pinned_at', { ascending: false, nullsFirst: false }).order('joined_at', { ascending: false }).limit(100)
    const memberships = data ?? []
    const built = await Promise.all(memberships.map(async (m) => {
      const [{ data: members }, { data: messages }] = await Promise.all([
        supabase.from('conversation_members').select('user_id,profiles(display_name,username)').eq('conversation_id', m.conversation_id).neq('user_id', currentUserId),
        supabase.from('messages').select('content,created_at').eq('conversation_id', m.conversation_id).order('created_at', { ascending: false }).limit(1)
      ])
      const other: any = members?.[0]
      return { id: m.conversation_id, name: other?.profiles?.display_name ?? other?.profiles?.username ?? 'Conversation', username: other?.profiles?.username ?? '', preview: messages?.[0]?.content ?? 'No messages yet', createdAt: messages?.[0]?.created_at ?? '', muted: !!m.muted_until && new Date(m.muted_until).getTime() > Date.now(), archived: !!m.archived_at, pinned: !!m.pinned_at, otherId: other?.user_id ?? '' }
    }))
    setRows(built)
  }
  useEffect(() => { void load() }, [currentUserId])

  async function control(row: Row, action: 'mute' | 'archive' | 'pin' | 'block') {
    if (action === 'block') {
      const { error } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: row.otherId })
      setStatus(error ? 'Block nahi ho paaya.' : `${row.name} blocked.`); return
    }
    const next = { muted_until: action === 'mute' ? (row.muted ? null : new Date(Date.now() + 7 * 86400000).toISOString()) : undefined, archived: action === 'archive' ? !row.archived : row.archived, pinned: action === 'pin' ? !row.pinned : row.pinned }
    const { error } = await supabase.rpc('set_conversation_control', { p_conversation_id: row.id, p_muted_until: next.muted_until === undefined ? (row.muted ? new Date(Date.now() + 7 * 86400000).toISOString() : null) : next.muted_until, p_archived: next.archived, p_pinned: next.pinned })
    if (error) setStatus('Setting update nahi hui.'); else { setStatus('Updated.'); await load() }
  }

  async function report(row: Row) {
    const { error } = await supabase.from('reports').insert({ reporter_id: currentUserId, reported_user_id: row.otherId, reason: 'user_report', details: 'Reported from conversation controls' })
    setStatus(error ? 'Report submit nahi hui.' : 'Report submit ho gayi.')
  }

  const filtered = rows.filter((r) => (showArchived || !r.archived) && (`${r.name} ${r.username} ${r.preview}`.toLowerCase().includes(query.toLowerCase())))
  return <section style={{ display: 'grid', gap: 12 }}>
    <div style={{ display: 'flex', gap: 8 }}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations…" /><button onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide archived' : 'Show archived'}</button></div>
    {filtered.map((row) => <article key={row.id} style={{ border: '1px solid #ddd', borderRadius: 14, padding: 14 }}><Link href={`/messages/${row.id}`}><strong>{row.pinned ? '📌 ' : ''}{row.name}</strong>{row.username && <small> @{row.username}</small>}<p style={{ margin: '6px 0' }}>{row.preview}</p></Link><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}><button onClick={() => void control(row, 'mute')}>{row.muted ? 'Unmute' : 'Mute 7d'}</button><button onClick={() => void control(row, 'archive')}>{row.archived ? 'Unarchive' : 'Archive'}</button><button onClick={() => void control(row, 'pin')}>{row.pinned ? 'Unpin' : 'Pin'}</button><button onClick={() => void control(row, 'block')}>Block</button><button onClick={() => void report(row)}>Report</button></div></article>)}
    {!filtered.length && <p>Conversation nahi mili.</p>}{status && <p role="status">{status}</p>}
  </section>
}
