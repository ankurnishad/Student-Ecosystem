'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeUsername } from '@/lib/auth/username'

type Profile = {
  display_name: string
  username: string
  class: string
  board: string
  stream: string
  bio: string
  avatar_url: string | null
}

const emptyProfile: Profile = {
  display_name: '',
  username: '',
  class: '',
  board: '',
  stream: '',
  bio: '',
  avatar_url: null,
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState<Profile>(emptyProfile)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError('')

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        if (active) window.location.href = '/login'
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, username, class, board, stream, bio, avatar_url')
        .eq('id', userData.user.id)
        .single()

      if (!active) return

      if (profileError) {
        setError('Profile load nahi ho paayi.')
      } else {
        setProfile({
          display_name: data.display_name ?? '',
          username: data.username ?? '',
          class: data.class ?? '',
          board: data.board ?? '',
          stream: data.stream ?? '',
          bio: data.bio ?? '',
          avatar_url: data.avatar_url ?? null,
        })
      }
      setLoading(false)
    }

    loadProfile()
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    async function loadAvatar() {
      if (!profile.avatar_url) {
        setAvatarPreview(null)
        return
      }

      const { data, error: downloadError } = await supabase.storage
        .from('avatars')
        .download(profile.avatar_url)

      if (active && data && !downloadError) {
        objectUrl = URL.createObjectURL(data)
        setAvatarPreview(objectUrl)
      }
    }

    loadAvatar()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profile.avatar_url, supabase])

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setMessage('')

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Avatar sirf JPG, PNG ya WebP hona chahiye.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar maximum 5 MB ka ho sakta hai.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${userData.user.id}/avatar.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) {
      setError('Avatar upload nahi hua. Please dobara try karo.')
      return
    }

    setProfile((current) => ({ ...current, avatar_url: path }))
    setMessage('Avatar upload ho gaya. Ab Save Profile dabao.')
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const username = normalizeUsername(profile.username)
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setError('Username 3–24 characters ka ho aur sirf a-z, 0-9, _ use kare.')
      setSaving(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      window.location.href = '/login'
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: profile.display_name.trim(),
        username,
        class: profile.class.trim() || null,
        board: profile.board.trim() || null,
        stream: profile.stream.trim() || null,
        bio: profile.bio.trim() || null,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userData.user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setProfile((current) => ({ ...current, username }))
      setMessage('Profile successfully save ho gayi.')
    }
    setSaving(false)
  }

  if (loading) return <main style={{ padding: 32 }}>Profile load ho rahi hai…</main>

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 32 }}>
      <a href="/dashboard">← Dashboard</a>
      <h1>Student Profile</h1>
      <p>Apni public student profile information manage karo.</p>

      <form onSubmit={saveProfile} style={{ display: 'grid', gap: 16 }}>
        <section>
          <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', background: '#e5e7eb', display: 'grid', placeItems: 'center', fontSize: 40 }}>
            {avatarPreview ? <img src={avatarPreview} alt="Profile avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
          </div>
          <label>
            Profile photo
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} />
          </label>
        </section>

        <label>Display name<input value={profile.display_name} maxLength={80} required onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} /></label>
        <label>Username<input value={profile.username} minLength={3} maxLength={24} required onChange={(e) => setProfile({ ...profile, username: e.target.value })} /></label>
        <label>Class<input value={profile.class} maxLength={30} onChange={(e) => setProfile({ ...profile, class: e.target.value })} /></label>
        <label>Board<input value={profile.board} maxLength={50} onChange={(e) => setProfile({ ...profile, board: e.target.value })} /></label>
        <label>Stream<input value={profile.stream} maxLength={50} onChange={(e) => setProfile({ ...profile, stream: e.target.value })} /></label>
        <label>Bio<textarea value={profile.bio} maxLength={240} rows={4} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></label>

        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
      </form>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
