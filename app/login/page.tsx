'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeUsername, usernameAuthEmail } from '@/lib/auth/username'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(event.currentTarget)
    const username = normalizeUsername(String(form.get('username') ?? ''))
    const password = String(form.get('password') ?? '')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameAuthEmail(username),
      password,
    })

    if (signInError) {
      setError('Username ya password galat hai.')
      setLoading(false)
      return
    }
    window.location.href = '/dashboard'
  }

  return (
    <main>
      <h1>Student Ecosystem Login</h1>
      <form onSubmit={onSubmit}>
        <label>Username <input name="username" required autoComplete="username" /></label>
        <label>Password <input name="password" type="password" required autoComplete="current-password" /></label>
        <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Login'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
