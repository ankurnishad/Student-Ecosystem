import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './lib/supabase'

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
    const { error } = await supabase.auth.signInWithPassword({
      email: `${normalized}@auth.student-ecosystem.local`,
      password,
    })
    setLoading(false)

    if (error) Alert.alert('Login failed', error.message)
    else onLoggedIn()
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Student Ecosystem</Text>
      <Text style={styles.subtitle}>Android foundation</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} placeholder="Username" value={username} onChangeText={setUsername} style={styles.input} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />
      <Button title={loading ? 'Signing in…' : 'Sign in'} onPress={signIn} disabled={loading} />
    </View>
  )
}

function Home({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState('Home')
  const tabs = ['Home', 'Profile', 'Messages', 'Groups']

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{tab}</Text>
      <Text style={styles.subtitle}>Same Supabase backend • real data only</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{tab} module</Text>
        <Text style={styles.body}>Mobile screens ka foundation ready hai. Existing Supabase RLS/backend ko reuse kiya jayega; koi mock data nahi.</Text>
      </View>
      <View style={styles.nav}>
        {tabs.map((item) => <Button key={item} title={item} onPress={() => setTab(item)} />)}
      </View>
      <Button title="Sign out" onPress={onSignOut} />
    </ScrollView>
  )
}

export default function App() {
  const [sessionReady, setSessionReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSignedIn(Boolean(data.session))
      setSessionReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!sessionReady) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      {signedIn ? <Home onSignOut={() => supabase.auth.signOut()} /> : <Login onLoggedIn={() => setSignedIn(true)} />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 24, gap: 20 },
  card: { margin: 24, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', gap: 14 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, opacity: 0.7 },
  sectionTitle: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 16 },
  nav: { gap: 8 },
})
