import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, is_direct')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conversation) notFound()

  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id, profiles(display_name, username)')
    .eq('conversation_id', conversationId)

  const otherMember = members?.find((member) => member.user_id !== user.id)

  return (
    <main>
      <Link href="/messages/new">← New Conversation</Link>
      <h1>{otherMember?.profiles?.display_name ?? otherMember?.profiles?.username ?? 'Conversation'}</h1>
      <p>{otherMember?.profiles?.username ? `@${otherMember.profiles.username}` : ''}</p>
      <p>Private conversation foundation ready. Messaging UI next milestone mein add hoga.</p>
    </main>
  )
}
