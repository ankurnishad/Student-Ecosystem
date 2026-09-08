import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../lib/supabase'

type Group = { id: string; name: string; description: string | null }

export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', auth.user.id)
    const ids = (memberships ?? []).map((m) => m.group_id)
    if (!ids.length) { setGroups([]); setLoading(false); return }
    const { data } = await supabase.from('groups').select('id,name,description').in('id', ids).order('created_at', { ascending: false })
    setGroups(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  return <View style={styles.container}>
    <Text style={styles.title}>My Groups</Text>
    <Text style={styles.sub}>Groups you are actually a member of</Text>
    {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : <FlatList data={groups} keyExtractor={(item) => item.id} refreshing={loading} onRefresh={() => void load()} ListEmptyComponent={<Text style={styles.empty}>Abhi aap kisi group ke member nahi ho.</Text>} renderItem={({ item }) => <View style={styles.row}><Text style={styles.name}>{item.name}</Text><Text style={styles.description}>{item.description ?? 'No description'}</Text><Text style={styles.id}>Group ID: {item.id}</Text><Button title="Open" onPress={() => {}} /></View>} />}
  </View>
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 20 }, title: { fontSize: 28, fontWeight: '700' }, sub: { opacity: 0.65, marginBottom: 16 }, row: { borderWidth: 1, borderColor: '#ddd', borderRadius: 14, padding: 14, marginBottom: 10 }, name: { fontSize: 18, fontWeight: '600' }, description: { marginTop: 5 }, id: { fontSize: 11, opacity: 0.45, marginVertical: 8 }, empty: { textAlign: 'center', marginTop: 30, opacity: 0.6 } })
