'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GroupThread from './GroupThread'

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [group, setGroup] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [roleTarget, setRoleTarget] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [{ data: groupData }, { data: memberData }] = await Promise.all([
      supabase.from('groups').select('id,name,description,owner_id').eq('id', groupId).single(),
      supabase.from('group_members').select('user_id,role,joined_at,profiles(display_name,username)').eq('group_id', groupId)
    ])
    setGroup(groupData); setMembers(memberData ?? [])
  }
  useEffect(() => { void load() }, [groupId])

  async function invite() {
    const { data: profile } = await supabase.from('profiles').select('id').eq('username', username.trim().toLowerCase()).maybeSingle()
    if (!profile) { setMessage('Username nahi mila.'); return }
    const { error } = await supabase.rpc('invite_group_member', { p_group_id: groupId, p_user_id: profile.id })
    setMessage(error ? 'Invite nahi bheja ja saka.' : 'Invite sent.'); setUsername('')
  }

  async function setRole() {
    if (!roleTarget) return
    const { error } = await supabase.rpc('set_group_member_role', { p_group_id: groupId, p_user_id: roleTarget, p_role: 'moderator' })
    setMessage(error ? 'Role update nahi hua.' : 'Moderator role updated.'); await load()
  }

  async function removeMember(id: string) {
    const { error } = await supabase.rpc('remove_group_member', { p_group_id: groupId, p_user_id: id })
    setMessage(error ? 'Member remove nahi hua.' : 'Member removed.'); await load()
  }

  if (!group) return <main style={{ padding: 24 }}>Group load ho raha hai…</main>
  const isModerator = members.some((m) => m.user_id === userId && ['owner','admin','moderator'].includes(m.role))
  return <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
    <Link href="/groups">← Groups</Link><h1>{group.name}</h1><p>{group.description}</p>
    <GroupThread groupId={groupId} currentUserId={userId} />
    <hr style={{ margin: '24px 0' }} />
    <h2>Members ({members.length})</h2>
    {isModerator && <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username to invite" /><button onClick={() => void invite()}>Invite member</button><select value={roleTarget} onChange={(e) => setRoleTarget(e.target.value)}><option value="">Select member</option>{members.filter((m) => m.user_id !== group.owner_id).map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name ?? m.profiles?.username ?? m.user_id.slice(0, 8)} — {m.role}</option>)}</select><button onClick={() => void setRole()}>Make moderator</button></div>}
    <ul>{members.map((m) => <li key={m.user_id}>{m.profiles?.display_name ?? m.profiles?.username ?? m.user_id.slice(0, 8)} — {m.role}{isModerator && m.user_id !== userId && m.user_id !== group.owner_id && <button onClick={() => void removeMember(m.user_id)}>Remove</button>}</li>)}</ul>
    {message && <p role="status">{message}</p>}
  </main>
}
