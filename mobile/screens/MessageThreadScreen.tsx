import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Button, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../lib/supabase'

type Message = { id: string; sender_id: string; content: string | null; created_at: string; deleted_at: string | null; updated_at: string; reply_to: string | null }

export default function MessageThreadScreen({ conversationId, title, onBack }: { conversationId: string; title: string; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    setUserId(auth.user.id)
    const { data } = await supabase.from('messages').select('id,sender_id,content,created_at,deleted_at,updated_at,reply_to').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(100)
    setMessages(data ?? [])
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
    setLoading(false)
  }, [conversationId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const c = supabase.channel(`mobile-message-thread:${conversationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => void load()).subscribe()
    return () => { void supabase.removeChannel(c) }
  }, [conversationId, load])

  async function send() {
    const content = text.trim()
    if (!content || !userId || sending) return
    setSending(true)
    if (editing) {
      const { error } = await supabase.from('messages').update({ content, updated_at: new Date().toISOString() }).eq('id', editing.id).eq('sender_id', userId)
      setSending(false)
      if (!error) { setText(''); setEditing(null); void load() }
      return
    }
    const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, content, message_type: 'text', reply_to: replyTo?.id ?? null })
    setSending(false)
    if (!error) { setText(''); setReplyTo(null); void load() }
  }

  async function removeMessage(message: Message) {
    if (!userId || message.sender_id !== userId) return
    const { error } = await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', message.id).eq('sender_id', userId)
    if (!error) void load()
  }

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><Button title="Back" onPress={onBack} /><Text style={styles.title}>{title}</Text></View>
    <FlatList data={messages} keyExtractor={m => m.id} contentContainerStyle={styles.list} renderItem={({ item }) => {
      const parent = item.reply_to ? messages.find(m => m.id === item.reply_to) : null
      return <View style={[styles.bubble, item.sender_id === userId && styles.mine]}>
        {parent && <Text style={styles.replyPreview}>↳ {parent.content ?? 'Message'}</Text>}
        <Text>{item.deleted_at ? 'Message deleted' : item.content}</Text>
        {item.updated_at !== item.created_at && !item.deleted_at && <Text style={styles.meta}>edited</Text>}
        {!item.deleted_at && <View style={styles.actions}><Button title="Reply" onPress={() => { setReplyTo(item); setEditing(null) }} />{item.sender_id === userId && <><Button title="Edit" onPress={() => { setEditing(item); setReplyTo(null); setText(item.content ?? '') }} /><Button title="Delete" onPress={() => void removeMessage(item)} /></>}</View>}
      </View>
    }} ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>} />
    {(replyTo || editing) && <View style={styles.context}><Text>{editing ? 'Editing message' : `Replying: ${replyTo?.content ?? ''}`}</Text><Button title="Cancel" onPress={() => { setReplyTo(null); setEditing(null); setText('') }} /></View>}
    <View style={styles.composer}><TextInput placeholder="Message" value={text} onChangeText={setText} multiline style={styles.input} /><Button title={sending ? '…' : editing ? 'Save' : 'Send'} onPress={() => void send()} disabled={sending} /></View>
  </KeyboardAvoidingView>
}
const styles = StyleSheet.create({ container:{flex:1}, center:{flex:1,alignItems:'center',justifyContent:'center'}, header:{flexDirection:'row',alignItems:'center',gap:8,padding:10,borderBottomWidth:1,borderColor:'#ddd'}, title:{fontSize:20,fontWeight:'600'}, list:{padding:14,gap:8}, bubble:{alignSelf:'flex-start',maxWidth:'88%',padding:10,borderRadius:12,borderWidth:1,borderColor:'#ddd'}, mine:{alignSelf:'flex-end'}, empty:{textAlign:'center',marginTop:30,opacity:.6}, replyPreview:{fontSize:12,opacity:.65,marginBottom:5}, meta:{fontSize:11,opacity:.55,marginTop:4}, actions:{flexDirection:'row',marginTop:4,alignItems:'center'}, context:{padding:8,borderTopWidth:1,borderColor:'#ddd',flexDirection:'row',justifyContent:'space-between'}, composer:{flexDirection:'row',alignItems:'flex-end',gap:8,padding:10,borderTopWidth:1,borderColor:'#ddd'}, input:{flex:1,borderWidth:1,borderColor:'#ccc',borderRadius:10,padding:10,maxHeight:100} })
