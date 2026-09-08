import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Conversation = {
  id: string
  created_at: string
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('conversation_members')
    .select('conversation_id, created_at, conversations(id, created_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const conversations = (memberships ?? [])
    .map((item) => Array.isArray(item.conversations) ? item.conversations[0] : item.conversations)
    .filter(Boolean) as Conversation[]

  return (
    <main>
      <h1>Messages</h1>
      <p><Link href="/messages/new">Start a conversation</Link></p>
      {conversations.length === 0 ? (
        <p>Abhi koi conversation nahi hai.</p>
      ) : (
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link href={`/messages/${conversation.id}`}>Open conversation</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
