import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MessageThread from './MessageThread'

type Profile = { display_name: string | null; username: string | null }
type Member = { user_id: string; profiles: Profile | Profile[] | null }

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

  const { data: rawMembers } = await supabase
    .from('conversation_members')
    .select('user_id, profiles(display_name, username)')
    .eq('conversation_id', conversationId)

  const members = (rawMembers ?? []) as Member[]
  const otherMember = members.find((member) => member.user_id !== user.id)
  const profile = otherMember?.profiles
  const otherProfile = Array.isArray(profile) ? profile[0] : profile

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <Link href="/messages/new">← New Conversation</Link>
      <h1>{otherProfile?.display_name ?? otherProfile?.username ?? 'Conversation'}</h1>
      <p>{otherProfile?.username ? `@${otherProfile.username}` : ''}</p>
      <MessageThread conversationId={conversationId} currentUserId={user.id} />
    </main>
  )
}
