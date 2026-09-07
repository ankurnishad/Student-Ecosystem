'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewMessagePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
      setStatus('Valid username enter karo.')
      return
    }

    setLoading(true)
    setStatus('Conversation create ho rahi hai...')

    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .eq('username', normalized)
      .maybeSingle()

    if (targetError || !target) {
      setLoading(false)
      setStatus('Ye username nahi mila.')
      return
    }

    const { data: conversationId, error } = await supabase.rpc(
      'create_direct_conversation',
      { target_user: target.id },
    )

    setLoading(false)
    if (error) {
      setStatus(error.message.includes('another user') ? 'Apne aap ko message nahi kar sakte.' : 'Conversation create nahi ho saki.')
      return
    }

    router.push(`/messages/${conversationId}`)
  }

  return (
    <main>
      <h1>New Conversation</h1>
      <p>Student ka exact username enter karke private conversation start karo.</p>
      <form onSubmit={createConversation}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="student_username"
          autoComplete="off"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Start Conversation'}
        </button>
      </form>
      {status && <p>{status}</p>}
    </main>
  )
}
