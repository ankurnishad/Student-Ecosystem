import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../lib/supabase'

type Row = { id: string; name: string; username: string; preview: string }

export default function MessagesScreen() {
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    const { data: memberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', auth.user.id).order('joined_at', { ascending: false }).limit(100)
    const built = await Promise.all((memberships ?? []).map(async (m) => {
      const [{ data: members }, { data: messages }] = await Promise.all([
        supabase.from('conversation_members').select('user_id,profiles(display_name,username)').eq('conversation_id', m.conversation_id).neq('user_id', auth.user.id),
        supabase.from('messages').select('content').eq('conversation_id', m.conversation_id).order('created_at', { ascending: false }).limit(1),
      ])
      const relation = members?.[0]?.profiles
      const profile = Array.isArray(relation) ? relation[0] : relation
      return { id: m.conversation_id, name: profile?.display_name ?? profile?.username ?? 'Conversation', username: profile?.username ?? '', preview: messages?.[0]?.content ?? 'No messages yet' }
    }))
    setRows(built)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  const filtered = rows.filter((r) => `${r.name} ${r.username} ${r.preview}`.toLowerCase().includes(query.trim().toLowerCase()))

  return <View style={styles.container}>
    <Text style={styles.title}>Messages</Text>
    <TextInput placeholder="Search conversations" value={query} onChangeText={setQuery} style={styles.input} />
    {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : <FlatList data={filtered} keyExtractor={(item) => item.id} refreshing={loading} onRefresh={() => void load()} ListEmptyComponent={<Text style={styles.empty}>Conversation nahi mili.</Text>} renderItem={({ item }) => <View style={styles.row}><Text style={styles.name}>{item.name}</Text>{item.username ? <Text style={styles.username}>@{item.username}</Text> : null}<Text numberOfLines={1} style={styles.preview}>{item.preview}</Text><Button title="Open" onPress={() => {}} /></View>} />}
  </View>
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 20 }, title: { fontSize: 28, fontWeight: '700', marginBottom: 12 }, input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, marginBottom: 12 }, row: { borderWidth: 1, borderColor: '#ddd', borderRadius: 14, padding: 14, marginBottom: 10 }, name: { fontSize: 18, fontWeight: '600' }, username: { opacity: 0.6 }, preview: { marginVertical: 8 }, empty: { textAlign: 'center', marginTop: 30, opacity: 0.6 } })
