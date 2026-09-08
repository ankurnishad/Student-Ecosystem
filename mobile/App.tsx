import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './lib/supabase'

type Profile = { display_name: string | null; username: string | null; class: string | null; board: string | null; stream: string | null; bio: string | null }
type Conversation = { id: string; name: string; username: string; preview: string }
type Group = { id: string; name: string; description: string | null }
type Tab = 'Home' | 'Profile' | 'Messages' | 'Groups'

function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  async function signIn() {
    const normalized = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(normalized) || password.length < 8) return Alert.alert('Invalid login', 'Username aur password check karo.')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: `${normalized}@auth.student-ecosystem.local`, password })
    setLoading(false)
    if (error) Alert.alert('Login failed', error.message); else onLoggedIn()
  }
  return <View style={styles.card}><Text style={styles.title}>Student Ecosystem</Text><Text style={styles.subtitle}>Secure mobile login</Text><TextInput autoCapitalize="none" autoCorrect={false} placeholder="Username" value={username} onChangeText={setUsername} style={styles.input}/><TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={styles.input}/><Button title={loading ? 'Signing in…' : 'Sign in'} onPress={signIn} disabled={loading}/></View>
}

function ProfileScreen({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile>({ display_name: '', username: '', class: '', board: '', stream: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  useEffect(() => { void (async () => { const { data } = await supabase.from('profiles').select('display_name,username,class,board,stream,bio').eq('id', userId).single(); if (data) setProfile(data) })() }, [userId])
  async function save() { const username = (profile.username ?? '').trim().toLowerCase(); if (!/^[a-z0-9_]{3,24}$/.test(username)) return setStatus('Username 3–24 characters ka hona chahiye.'); setSaving(true); const { error } = await supabase.from('profiles').update({ display_name: profile.display_name?.trim(), username, class: profile.class?.trim() || null, board: profile.board?.trim() || null, stream: profile.stream?.trim() || null, bio: profile.bio?.trim() || null, updated_at: new Date().toISOString() }).eq('id', userId); setSaving(false); setStatus(error ? 'Profile save nahi hui.' : 'Profile saved.') }
  return <View style={styles.card}><Text style={styles.sectionTitle}>My Profile</Text>{(['display_name','username','class','board','stream','bio'] as const).map((key) => <TextInput key={key} placeholder={key.replace('_',' ')} value={profile[key] ?? ''} onChangeText={(v) => setProfile({ ...profile, [key]: v })} multiline={key === 'bio'} style={[styles.input, key === 'bio' && styles.textarea]}/>)}<Button title={saving ? 'Saving…' : 'Save Profile'} onPress={() => void save()} disabled={saving}/>{status ? <Text>{status}</Text> : null}</View>
}

function MessagesScreen({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Conversation[]>([])
  const [query, setQuery] = useState('')
  useEffect(() => { void (async () => { const { data: memberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userId).limit(100); const built = await Promise.all((memberships ?? []).map(async (m) => { const [{ data: members }, { data: messages }] = await Promise.all([supabase.from('conversation_members').select('user_id,profiles(display_name,username)').eq('conversation_id', m.conversation_id).neq('user_id', userId), supabase.from('messages').select('content').eq('conversation_id', m.conversation_id).order('created_at',{ascending:false}).limit(1)]); const other: any = members?.[0]; return { id:m.conversation_id, name:other?.profiles?.display_name ?? other?.profiles?.username ?? 'Conversation', username:other?.profiles?.username ?? '', preview:messages?.[0]?.content ?? 'No messages yet' } })) ; setRows(built) })() }, [userId])
  const filtered = useMemo(() => rows.filter(r => `${r.name} ${r.username} ${r.preview}`.toLowerCase().includes(query.toLowerCase())), [rows, query])
  return <View style={styles.card}><Text style={styles.sectionTitle}>Messages</Text><TextInput placeholder="Search conversations" value={query} onChangeText={setQuery} style={styles.input}/>{filtered.map(r => <View key={r.id} style={styles.row}><Text style={styles.rowTitle}>{r.name}</Text><Text>@{r.username}</Text><Text numberOfLines={2}>{r.preview}</Text></View>)}{!filtered.length && <Text>No conversations found.</Text>}</View>
}

function GroupsScreen({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<Group[]>([])
  useEffect(() => { void (async () => { const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', userId); const ids = (memberships ?? []).map(m => m.group_id); if (!ids.length) return setGroups([]); const { data } = await supabase.from('groups').select('id,name,description').in('id', ids).order('created_at',{ascending:false}); setGroups(data ?? []) })() }, [userId])
  return <View style={styles.card}><Text style={styles.sectionTitle}>My Groups</Text>{groups.map(g => <View key={g.id} style={styles.row}><Text style={styles.rowTitle}>{g.name}</Text><Text>{g.description ?? 'No description'}</Text></View>)}{!groups.length && <Text>Abhi aap kisi group ke member nahi ho.</Text>}</View>
}

function Home({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('Home')
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>{tab}</Text>{tab === 'Home' && <View style={styles.card}><Text style={styles.sectionTitle}>Student Ecosystem</Text><Text style={styles.body}>Web aur Android dono same Supabase backend aur RLS use karte hain.</Text></View>}{tab === 'Profile' && <ProfileScreen userId={userId}/>} {tab === 'Messages' && <MessagesScreen userId={userId}/>} {tab === 'Groups' && <GroupsScreen userId={userId}/>}<View style={styles.nav}>{(['Home','Profile','Messages','Groups'] as Tab[]).map(item => <Button key={item} title={item} onPress={() => setTab(item)}/>)}</View><Button title="Sign out" onPress={onSignOut}/></ScrollView>
}

export default function App() {
  const [ready, setReady] = useState(false); const [session, setSession] = useState<any>(null)
  useEffect(() => { let mounted=true; supabase.auth.getSession().then(({data}) => { if(mounted){setSession(data.session);setReady(true)} }); const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s)); return()=>{mounted=false;subscription.unsubscribe()} }, [])
  if (!ready) return <SafeAreaView style={styles.center}><ActivityIndicator/></SafeAreaView>
  return <SafeAreaView style={styles.safe}><StatusBar style="auto"/>{session?.user ? <Home userId={session.user.id} onSignOut={() => void supabase.auth.signOut()}/> : <Login onLoggedIn={() => void supabase.auth.getSession().then(({data}) => setSession(data.session))}/>}</SafeAreaView>
}

const styles=StyleSheet.create({safe:{flex:1},center:{flex:1,alignItems:'center',justifyContent:'center'},container:{padding:20,gap:14},card:{padding:18,borderRadius:16,borderWidth:1,borderColor:'#ddd',gap:12},title:{fontSize:28,fontWeight:'700'},subtitle:{fontSize:15,opacity:.7},sectionTitle:{fontSize:20,fontWeight:'600'},body:{fontSize:16,lineHeight:24},input:{borderWidth:1,borderColor:'#ccc',borderRadius:10,padding:12,fontSize:16},textarea:{minHeight:90,textAlignVertical:'top'},nav:{gap:8},row:{borderWidth:1,borderColor:'#ddd',borderRadius:12,padding:12,gap:4},rowTitle:{fontSize:17,fontWeight:'600'}})
