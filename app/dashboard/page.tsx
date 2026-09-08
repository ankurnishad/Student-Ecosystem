import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('display_name, username, class, board, stream').eq('id', user.id).single()

  return (
    <main>
      <h1>Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!</h1>
      <p>@{profile?.username ?? 'student'}</p>
      {profile?.class && <p>Class: {profile.class}</p>}
      {profile?.board && <p>Board: {profile.board}</p>}
      {profile?.stream && <p>Stream: {profile.stream}</p>}
      <p><Link href="/profile">Edit Student Profile →</Link></p>
      <p><Link href="/messages">Messages →</Link></p>
      <p><Link href="/messages/new">Start a Conversation →</Link></p>
      <p><Link href="/groups">Student Groups →</Link></p>
    </main>
  )
}
