import { useEffect, useState } from 'react'
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './lib/supabase'
import ProfileScreen from './screens/ProfileScreen'
import MessagesScreen from './screens/MessagesScreen'
import GroupsScreen from './screens/GroupsScreen'
import NotificationsScreen from './screens/NotificationsScreen'

type Tab = 'Home' | 'Profile' | 'Messages' | 'Groups' | 'Notifications'

function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false)
  async function signIn() { const normalized = username.trim().toLowerCase(); if (!/^[a-z0-9_]{3,24}$/.test(normalized) || password.length < 8) return; setLoading(true); const { error } = await supabase.auth.signInWithPassword({ email: `${normalized}@auth.student-ecosystem.local`, password }); setLoading(false); if (!error) onLoggedIn() }
  return <View style={styles.login}><Text style={styles.title}>Student Ecosystem</Text><Text style={styles.sub}>Username + password</Text><TextInput autoCapitalize="none" autoCorrect={false} placeholder="Username" value={username} onChangeText={setUsername} style={styles.input}/><TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={styles.input}/><Button title={loading ? 'Signing in…' : 'Sign in'} onPress={() => void signIn()} disabled={loading}/></View>
}

function Home({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('Home')
  return <View style={styles.root}><View style={styles.content}>{tab === 'Home' && <View style={styles.home}><Text style={styles.title}>Student Ecosystem</Text><Text style={styles.sub}>Android client connected to the same Supabase backend and RLS.</Text><Button title="Notifications" onPress={() => setTab('Notifications')}/></View>}{tab === 'Profile' && <ProfileScreen/>}{tab === 'Messages' && <MessagesScreen/>}{tab === 'Groups' && <GroupsScreen/>}{tab === 'Notifications' && <NotificationsScreen onBack={() => setTab('Home')}/>}</View><View style={styles.nav}>{(['Home','Profile','Messages','Groups'] as Tab[]).map(item => <Button key={item} title={item} onPress={() => setTab(item)}/>)}</View><Button title="Sign out" onPress={onSignOut}/></View>
}

export default function App() {
  const [ready, setReady] = useState(false); const [session, setSession] = useState<any>(null)
  useEffect(() => { let mounted = true; supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setReady(true) } }); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next)); return () => { mounted = false; subscription.unsubscribe() } }, [])
  if (!ready) return <SafeAreaView style={styles.center}><ActivityIndicator/></SafeAreaView>
  return <SafeAreaView style={styles.safe}><StatusBar style="auto"/>{session?.user ? <Home onSignOut={() => void supabase.auth.signOut()}/> : <Login onLoggedIn={() => void supabase.auth.getSession().then(({ data }) => setSession(data.session))}/>}</SafeAreaView>
}
const styles = StyleSheet.create({ safe:{flex:1},root:{flex:1},center:{flex:1,alignItems:'center',justifyContent:'center'},content:{flex:1},home:{padding:20,gap:14},login:{margin:20,padding:20,borderWidth:1,borderColor:'#ddd',borderRadius:16,gap:12},title:{fontSize:28,fontWeight:'700'},sub:{fontSize:15,opacity:.65},input:{borderWidth:1,borderColor:'#ccc',borderRadius:10,padding:12,fontSize:16},nav:{flexDirection:'row',justifyContent:'space-around',padding:6,borderTopWidth:1,borderColor:'#ddd'} })
