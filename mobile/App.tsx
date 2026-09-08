import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './lib/supabase'
import ProfileScreen from './screens/ProfileScreen'
import MessagesScreen from './screens/MessagesScreen'
import GroupsScreen from './screens/GroupsScreen'

function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn() {
    const normalized = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(normalized) || password.length < 8) {
      Alert.alert('Invalid login', 'Username aur password check karo.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: `${normalized}@auth.student-ecosystem.local`, password })
    setLoading(false)
    if (error) Alert.alert('Login failed', error.message)
    else onLoggedIn()
  }

  return <View style={styles.card}>
    <Text style={styles.title}>Student Ecosystem</Text>
    <Text style={styles.subtitle}>Student community • Android</Text>
    <TextInput autoCapitalize="none" autoCorrect={false} placeholder="Username" value={username} onChangeText={setUsername} style={styles.input} />
    <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />
    <Button title={loading ? 'Signing in…' : 'Sign in'} onPress={() => void signIn()} disabled={loading} />
  </View>
}

function Home({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<'Home' | 'Profile' | 'Messages' | 'Groups'>('Home')
  return <View style={styles.app}>
    <View style={styles.header}><Text style={styles.title}>{tab}</Text><Button title="Sign out" onPress={onSignOut} /></View>
    <View style={styles.content}>
      {tab === 'Home' && <ScrollView contentContainerStyle={styles.container}><Text style={styles.subtitle}>Same Supabase backend • real data only</Text><View style={styles.card}><Text style={styles.sectionTitle}>Welcome to Student Ecosystem</Text><Text style={styles.body}>Profile, direct messages aur groups ab real Supabase data ke saath mobile app me connected hain.</Text></View></ScrollView>}
      {tab === 'Profile' && <ProfileScreen />}
      {tab === 'Messages' && <MessagesScreen />}
      {tab === 'Groups' && <GroupsScreen />}
    </View>
    <View style={styles.nav}>{(['Home', 'Profile', 'Messages', 'Groups'] as const).map((item) => <Button key={item} title={item} onPress={() => setTab(item)} />)}</View>
  </View>
}

export default function App() {
  const [sessionReady, setSessionReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSignedIn(Boolean(data.session)); setSessionReady(true) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)))
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])
  if (!sessionReady) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>
  return <SafeAreaView style={styles.safe}><StatusBar style="auto" />{signedIn ? <Home onSignOut={() => void supabase.auth.signOut()} /> : <Login onLoggedIn={() => setSignedIn(true)} />}</SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, app: { flex: 1 }, content: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, container: { padding: 20, gap: 16 }, card: { margin: 20, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', gap: 14 }, header: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#ddd' }, title: { fontSize: 25, fontWeight: '700' }, subtitle: { fontSize: 15, opacity: 0.7 }, sectionTitle: { fontSize: 20, fontWeight: '600' }, body: { fontSize: 16, lineHeight: 24 }, input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 16 }, nav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#ddd' },
})
