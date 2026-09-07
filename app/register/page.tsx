'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeUsername, usernameAuthEmail } from '@/lib/auth/username'

export default function RegisterPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const form = new FormData(event.currentTarget)
    const username = normalizeUsername(String(form.get('username') ?? ''))
    const password = String(form.get('password') ?? '')
    const displayName = String(form.get('displayName') ?? '').trim()
    const studentClass = String(form.get('class') ?? '').trim()
    const board = String(form.get('board') ?? '').trim()
    const stream = String(form.get('stream') ?? '').trim()

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setError('Username 3–24 characters ka ho aur sirf a-z, 0-9, _ use kare.')
      setLoading(false)
      return
    }
    if (password.length < 8) {
      setError('Password kam se kam 8 characters ka hona chahiye.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email: usernameAuthEmail(username),
      password,
      options: {
        data: { username, display_name: displayName, class: studentClass, board, stream },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <main>
      <h1>Create Student Ecosystem account</h1>
      <p>Username aur password se account banao.</p>
      <form onSubmit={onSubmit}>
        <label>Display name <input name="displayName" required maxLength={80} /></label>
        <label>Username <input name="username" required minLength={3} maxLength={24} autoComplete="username" /></label>
        <label>Password <input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        <label>Class <input name="class" maxLength={30} /></label>
        <label>Board <input name="board" maxLength={50} /></label>
        <label>Stream <input name="stream" maxLength={50} /></label>
        <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
