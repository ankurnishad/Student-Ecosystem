import { useEffect, useState } from 'react'
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './lib/supabase'
import ProfileScreen from './screens/ProfileScreen'
import MessagesScreen from './screens/MessagesScreen'
import GroupsScreen from './screens/GroupsScreen'

type Tab = 'Home' | 'Profile' | 'Messages' | 'Groups'

function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  async function signIn() {
    const normalized = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(normalized) || password.length < 8) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: `${normalized}@auth.student-ecosystem.local`, password })
    setLoading(false)
    if (error) return
    onLoggedIn()
  }
  return <View style={styles.login}><Text style={styles.title}>Student Ecosystem</Text><Text style={styles.sub}>Username + password</Text><TextInputCompat value={username} onChange={setUsername} placeholder="Username"/><TextInputCompat value={password} onChange={setPassword} placeholder="Password" secure/><Button title={loading ? 'Signing in…' : 'Sign in'} onPress={() => void signIn()} disabled={loading}/></View>
}

function TextInputCompat({ value, onChange, placeholder, secure = false }: { value: string; onChange: (v: string) => void; placeholder: string; secure?: boolean }) {
  const { TextInput } = require('react-native') as typeof import('react-native')
  return <TextInput autoCapitalize="none" autoCorrect={false} placeholder={placeholder} secureTextEntry={secure} value={value} onChangeText={onChange} style={styles.input}/>
}

function Home({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('Home')
  return <View style={styles.root}><View style={styles.content}>{tab === 'Home' && <View><Text style={styles.title}>Student Ecosystem</Text><Text style={styles.sub}>Android client connected to the same Supabase backend and RLS.</Text></View>}{tab === 'Profile' && <ProfileScreen/>}{tab === 'Messages' && <MessagesScreen/>}{tab === 'Groups' && <GroupsScreen/>}</View><View style={styles.nav}>{(['Home','Profile','Messages','Groups'] as Tab[]).map(item => <Button key={item} title={item} onPress={() => setTab(item)}/>)}</View><Button title="Sign out" onPress={onSignOut}/></View>
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<any>(null)
  useEffect(() => { let mounted = true; supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setReady(true) } }); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next)); return () => { mounted = false; subscription.unsubscribe() } }, [])
  if (!ready) return <SafeAreaView style={styles.center}><ActivityIndicator/></SafeAreaView>
  return <SafeAreaView style={styles.safe}><StatusBar style="auto"/>{session?.user ? <Home userId={session.user.id} onSignOut={() => void supabase.auth.signOut()}/> : <Login onLoggedIn={() => void supabase.auth.getSession().then(({ data }) => setSession(data.session))}/>}</SafeAreaView>
}

const styles = StyleSheet.create({ safe:{flex:1}, root:{flex:1}, center:{flex:1,alignItems:'center',justifyContent:'center'}, content:{flex:1}, login:{margin:20,padding:20,borderWidth:1,borderColor:'#ddd',borderRadius:16,gap:12}, title:{fontSize:28,fontWeight:'700'}, sub:{fontSize:15,opacity:.65}, input:{borderWidth:1,borderColor:'#ccc',borderRadius:10,padding:12,fontSize:16}, nav:{flexDirection:'row',justifyContent:'space-around',padding:6,borderTopWidth:1,borderColor:'#ddd'} })
