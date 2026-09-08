import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConversationList from './ConversationList'
import Notifications from './Notifications'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      <h1>Messages</h1>
      <p><Link href="/messages/new">Start a conversation</Link></p>
      <Notifications currentUserId={user.id} />
      <ConversationList currentUserId={user.id} />
    </main>
  )
}
