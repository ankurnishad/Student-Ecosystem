'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function GroupsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [groups, setGroups] = useState<any[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    const { data } = await supabase.from('groups').select('id,name,description,created_at').order('created_at', { ascending: false })
    setGroups(data ?? [])
  }

  useEffect(() => { void load() }, [])

  async function createGroup() {
    if (!name.trim() || creating) return
    setCreating(true); setError('')
    const { data: group, error: groupError } = await supabase.from('groups').insert({ name: name.trim(), description: description.trim() || null }).select('id').single()
    if (groupError || !group) { setError('Group create nahi ho paaya.'); setCreating(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Login required.'); setCreating(false); return }
    const { error: memberError } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'owner' })
    if (memberError) { await supabase.from('groups').delete().eq('id', group.id); setError('Group membership setup nahi ho paaya.'); setCreating(false); return }
    setName(''); setDescription(''); await load(); setCreating(false)
  }

  return <main style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}>
    <h1>Student Groups</h1>
    <p>Study groups aur student communities.</p>
    <section style={{ display: 'grid', gap: 8, margin: '20px 0' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={100} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={500} />
      <button onClick={() => void createGroup()} disabled={creating || !name.trim()}>{creating ? 'Creating…' : 'Create group'}</button>
      {error && <p role="alert">{error}</p>}
    </section>
    <div style={{ display: 'grid', gap: 10 }}>
      {groups.map((group) => <Link key={group.id} href={`/groups/${group.id}`} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14 }}><strong>{group.name}</strong><br /><span>{group.description ?? 'No description'}</span></Link>)}
      {!groups.length && <p>Abhi koi group nahi hai.</p>}
    </div>
  </main>
}
