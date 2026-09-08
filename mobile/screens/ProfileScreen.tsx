import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
import { supabase } from '../lib/supabase'

type Profile = { display_name: string; username: string; class: string; board: string; stream: string; bio: string }
const empty: Profile = { display_name: '', username: '', class: '', board: '', stream: '', bio: '' }

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    const { data, error } = await supabase.from('profiles').select('display_name,username,class,board,stream,bio').eq('id', auth.user.id).single()
    if (error) Alert.alert('Profile', 'Profile load nahi ho paayi.')
    else setProfile({ display_name: data.display_name ?? '', username: data.username ?? '', class: data.class ?? '', board: data.board ?? '', stream: data.stream ?? '', bio: data.bio ?? '' })
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function save() {
    const username = profile.username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(username)) { Alert.alert('Invalid username', 'Username 3–24 characters ka hona chahiye.'); return }
    setSaving(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setSaving(false); return }
    const { error } = await supabase.from('profiles').update({ display_name: profile.display_name.trim(), username, class: profile.class.trim() || null, board: profile.board.trim() || null, stream: profile.stream.trim() || null, bio: profile.bio.trim() || null, updated_at: new Date().toISOString() }).eq('id', auth.user.id)
    setSaving(false)
    if (error) Alert.alert('Save failed', error.message)
    else { setProfile((p) => ({ ...p, username })); Alert.alert('Profile', 'Profile successfully save ho gayi.') }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>My Profile</Text>
    <Text style={styles.sub}>Real Supabase profile data</Text>
    {(['display_name', 'username', 'class', 'board', 'stream', 'bio'] as const).map((field) => <TextInput key={field} placeholder={field.replace('_', ' ')} value={profile[field]} multiline={field === 'bio'} maxLength={field === 'bio' ? 240 : field === 'display_name' ? 80 : field === 'username' ? 24 : 50} onChangeText={(value) => setProfile((p) => ({ ...p, [field]: value }))} style={[styles.input, field === 'bio' && styles.bio]} autoCapitalize={field === 'username' ? 'none' : 'sentences'} />)}
    <Button title={saving ? 'Saving…' : 'Save Profile'} onPress={() => void save()} disabled={saving} />
  </ScrollView>
}

const styles = StyleSheet.create({ container: { padding: 20, gap: 12 }, title: { fontSize: 28, fontWeight: '700' }, sub: { opacity: 0.65, marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 16 }, bio: { minHeight: 100, textAlignVertical: 'top' } })
