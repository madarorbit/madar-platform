import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { OrbyConversation, OrbyMessage, OrbyMode } from '@madar/contracts/mobile-v2';
import { PageHeader, Screen } from '@/components/screen';
import { AppButton, Badge, Card, EmptyState } from '@/components/ui';
import { mobileApi, streamOrby } from '@/lib/api';
import { useMadarApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import { useMadarTheme } from '@/providers/theme-provider';

const modes: Array<{ key: OrbyMode; label: string }> = [{ key: 'GENERAL', label: 'عام' }, { key: 'SALES', label: 'المبيعات' }, { key: 'INVENTORY', label: 'المخزون' }, { key: 'CUSTOMERS', label: 'العملاء' }, { key: 'PLANNING', label: 'التخطيط' }];

export default function OrbyScreen() {
  const { session } = useAuth();
  const { snapshot, online } = useMadarApp();
  const { colors } = useMadarTheme();
  const [conversations, setConversations] = useState<OrbyConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OrbyMessage[]>([]);
  const [mode, setMode] = useState<OrbyMode>('GENERAL');
  const [prompt, setPrompt] = useState('');
  const [search, setSearch] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadConversations = useCallback(async (query = '') => {
    if (!session || !snapshot) return;
    try { const data = await mobileApi.conversations(session.access_token, snapshot.workspace.id, query); setConversations(data.items); }
    catch { setConversations([]); }
  }, [session, snapshot]);
  useEffect(() => { void loadConversations(); }, [snapshot?.workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectConversation(item: OrbyConversation) {
    setConversationId(item.id); setMessages(item.messages || []); setMode(item.mode);
  }
  async function pickAttachment() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'], multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if ((asset.size || 0) > 5 * 1024 * 1024) return Alert.alert('المرفق كبير', 'الحد الأقصى 5MB.');
    setAttachment(asset);
  }
  async function send(text = prompt) {
    const clean = text.trim();
    if (!session || !snapshot || clean.length < 5 || streaming) return;
    if (!online) return Alert.alert('أوربي يحتاج اتصالًا', 'يمكن حفظ المسودة، لكن لا يمكن إرسالها أثناء Offline.');
    const userMessage: OrbyMessage = { id: `local-user-${Date.now()}`, role: 'user', text: clean, createdAt: new Date().toISOString(), attachments: attachment ? [{ id: 'pending', name: attachment.name, mimeType: attachment.mimeType || 'application/octet-stream', size: attachment.size || 0 }] : undefined };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant', text: '', createdAt: new Date().toISOString() }]);
    setPrompt(''); setLastPrompt(clean); setStreaming(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const attachmentIds: string[] = [];
      if (attachment) {
        const uploaded = await mobileApi.uploadOrbyAttachment(session.access_token, snapshot.workspace.id, attachment);
        attachmentIds.push(uploaded.id);
      }
      setAttachment(null);
      const result = await streamOrby({ accessToken: session.access_token, organizationId: snapshot.workspace.id, conversationId, mode, prompt: clean, attachmentIds, signal: controller.signal, onDelta: (delta) => setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, text: message.text + delta } : message)) });
      setConversationId(result.conversationId);
      await loadConversations(search);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, text: `تعذر إكمال الرد: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` } : message));
      }
    } finally { setStreaming(false); abortRef.current = null; }
  }
  async function archiveCurrent() {
    if (!session || !snapshot || !conversationId) return;
    await mobileApi.archiveConversation(session.access_token, snapshot.workspace.id, conversationId, true);
    setConversationId(null); setMessages([]); await loadConversations(search);
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}><Screen contentContainerStyle={{ paddingBottom: 110 }}><PageHeader eyebrow="ORBY AI" title="أوربي" subtitle="نفس الذاكرة والصلاحيات ومحادثات منصة الويب" /><View style={{ flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' }}>{modes.map((item) => <Pressable key={item.key} onPress={() => setMode(item.key)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: mode === item.key ? colors.violetSoft : colors.elevated }}><Text style={{ color: mode === item.key ? colors.violet : colors.muted, fontWeight: '800' }}>{item.label}</Text></Pressable>)}</View><Card><TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => void loadConversations(search)} placeholder="ابحث في المحادثات السابقة" placeholderTextColor={colors.faint} style={{ minHeight: 44, color: colors.text, textAlign: 'right' }} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8 }}>{conversations.map((item) => <Pressable key={item.id} onPress={() => selectConversation(item)} style={{ width: 180, gap: 5, padding: 11, borderRadius: 13, backgroundColor: item.id === conversationId ? colors.mintSoft : colors.elevated }}><Text numberOfLines={2} style={{ color: item.id === conversationId ? colors.mint : colors.text, fontWeight: '800', textAlign: 'right' }}>{item.title}</Text><Text style={{ color: colors.faint, fontSize: 10, textAlign: 'right' }}>{new Date(item.updatedAt).toLocaleDateString('ar-YE')}</Text></Pressable>)}</ScrollView>{conversationId ? <AppButton kind="secondary" label="أرشفة المحادثة" onPress={() => void archiveCurrent()} /> : null}</Card>{messages.length ? messages.map((message) => <View key={message.id} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'stretch', maxWidth: message.role === 'user' ? '88%' : '100%', gap: 7, padding: 14, borderRadius: 18, backgroundColor: message.role === 'user' ? colors.violetSoft : colors.surface, borderWidth: 1, borderColor: colors.border }}><Badge label={message.role === 'user' ? 'أنت' : 'أوربي'} tone={message.role === 'user' ? 'neutral' : 'good'} />{message.attachments?.map((item) => <Text key={item.id} selectable style={{ color: colors.sky, fontSize: 11, textAlign: 'right' }}>مرفق: {item.name}</Text>)}<Text selectable style={{ color: colors.text, lineHeight: 23, textAlign: 'right' }}>{message.text || (streaming ? '…' : '')}</Text></View>) : <EmptyState title="ابدأ محادثة مع أوربي" body="اسأله عن بيانات مساحة العمل، المخاطر، الفرص أو خطة عمل. أي تنفيذ سيبقى خاضعًا للمعاينة والتأكيد." />}<Card><TextInput value={prompt} onChangeText={setPrompt} multiline placeholder="اكتب طلبًا واضحًا لأوربي…" placeholderTextColor={colors.faint} style={{ minHeight: 90, color: colors.text, textAlign: 'right', textAlignVertical: 'top' }} />{attachment ? <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 }}><Text numberOfLines={1} style={{ flex: 1, color: colors.sky, textAlign: 'right' }}>{attachment.name}</Text><Pressable onPress={() => setAttachment(null)}><Text style={{ color: colors.red, fontWeight: '800' }}>إزالة</Text></Pressable></View> : null}<View style={{ flexDirection: 'row-reverse', gap: 8 }}><View style={{ flex: 1 }}><AppButton label={streaming ? 'جارٍ الرد…' : 'إرسال'} disabled={prompt.trim().length < 5 || streaming} onPress={() => void send()} /></View><View style={{ flex: 1 }}><AppButton kind="secondary" label="إرفاق" disabled={streaming} onPress={() => void pickAttachment()} /></View></View>{streaming ? <AppButton kind="danger" label="إيقاف الرد" onPress={() => abortRef.current?.abort()} /> : lastPrompt ? <AppButton kind="secondary" label="إعادة إنشاء آخر رد" onPress={() => void send(lastPrompt)} /> : null}</Card></Screen></KeyboardAvoidingView>;
}
