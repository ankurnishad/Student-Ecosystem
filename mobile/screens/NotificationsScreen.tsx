import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../lib/supabase'

type Notification = { id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; created_at: string; read_at: string | null }

export default function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('id,type,title,body,data,created_at,read_at').order('created_at', { ascending: false }).limit(100)
    setItems((data ?? []) as Notification[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const channel = supabase.channel('mobile-notifications').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => void load()).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load])

  async function markAllRead() {
    setBusy(true)
    const { data: auth } = await supabase.auth.getUser()
    if (auth.user) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', auth.user.id).is('read_at', null)
    setBusy(false)
    void load()
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    setItems(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>
  return <View style={styles.container}><View style={styles.header}><Button title="Back" onPress={onBack} /><Text style={styles.title}>Notifications</Text><Button title={busy ? '…' : 'Read all'} onPress={() => void markAllRead()} disabled={busy} /></View><FlatList data={items} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>} renderItem={({ item }) => <View style={[styles.card, !item.read_at && styles.unread]}><Text style={styles.itemTitle}>{item.title}</Text>{item.body && <Text>{item.body}</Text>}<Text style={styles.meta}>{new Date(item.created_at).toLocaleString('en-IN')}</Text>{!item.read_at && <Button title="Mark read" onPress={() => void markRead(item.id)} />}</View>} /></View>
}

const styles = StyleSheet.create({ container:{flex:1}, center:{flex:1,alignItems:'center',justifyContent:'center'}, header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:10,borderBottomWidth:1,borderColor:'#ddd'}, title:{fontSize:20,fontWeight:'600'}, list:{padding:14,gap:10}, card:{padding:12,borderWidth:1,borderColor:'#ddd',borderRadius:12,gap:5}, unread:{borderWidth:2}, itemTitle:{fontWeight:'700'}, meta:{fontSize:11,opacity:.55}, empty:{textAlign:'center',marginTop:30,opacity:.6} })
