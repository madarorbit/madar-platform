import { useState } from 'react';
import { KeyboardAvoidingView, Text, TextInput, View } from 'react-native';
import { Brand } from '@/components/brand';
import { Screen } from '@/components/screen';
import { AppButton, Card } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useMadarTheme } from '@/providers/theme-provider';

export default function LoginScreen() {
  const { colors } = useMadarTheme();
  const { signIn, sendRecovery, startupError, retryStartup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgot, setForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputStyle = { minHeight: 50, paddingHorizontal: 14, borderRadius: 14, color: colors.text, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, textAlign: 'right' as const };

  async function submit() {
    setLoading(true); setMessage(null);
    try {
      if (!email.trim()) throw new Error('أدخل البريد الإلكتروني.');
      if (forgot) {
        await sendRecovery(email);
        setMessage('أرسلنا رابط الاستعادة إلى بريدك. افتحه من هذا الجهاز للعودة إلى التطبيق.');
      } else {
        if (!password) throw new Error('أدخل كلمة المرور.');
        await signIn(email, password);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إكمال الطلب.');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <Screen contentContainerStyle={{ justifyContent: 'center' }}>
        <View style={{ alignItems: 'flex-end', gap: 14 }}>
          <Brand />
          <Text selectable style={{ color: colors.text, fontSize: 27, fontWeight: '900', textAlign: 'right' }}>{forgot ? 'استعادة كلمة المرور' : 'لوحة القيادة V2.1'}</Text>
          <Text selectable style={{ color: colors.muted, lineHeight: 22, textAlign: 'right' }}>{forgot ? 'سنرسل رابطًا آمنًا يفتح التطبيق عبر Deep Link.' : 'دخول واحد آمن إلى مساحة عملك التجارية، وتنبيهاتك وتقاريرك وأوربي.'}</Text>
        </View>
        {startupError ? (
          <Card>
            <Text selectable style={{ color: colors.red, fontWeight: '900', textAlign: 'right' }}>تعذر تجهيز الاتصال عند تشغيل التطبيق</Text>
            <Text selectable style={{ color: colors.muted, lineHeight: 21, textAlign: 'right' }}>{startupError}</Text>
            <AppButton kind="secondary" label="إعادة فحص الاتصال" onPress={retryStartup} />
          </Card>
        ) : null}
        <Card>
          <Text selectable style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>البريد الإلكتروني</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" placeholder="name@example.com" placeholderTextColor={colors.faint} style={inputStyle} />
          {!forgot && <><Text selectable style={{ color: colors.muted, fontWeight: '700', textAlign: 'right' }}>كلمة المرور</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry textContentType="password" placeholder="••••••••" placeholderTextColor={colors.faint} style={inputStyle} onSubmitEditing={() => void submit()} /></>}
          {message ? <Text selectable style={{ color: message.includes('أرسلنا') ? colors.mint : colors.red, lineHeight: 21, textAlign: 'right' }}>{message}</Text> : null}
          <AppButton label={forgot ? 'إرسال رابط الاستعادة' : 'تسجيل الدخول'} loading={loading} onPress={() => void submit()} />
          <AppButton kind="secondary" label={forgot ? 'العودة لتسجيل الدخول' : 'نسيت كلمة المرور'} onPress={() => { setForgot(!forgot); setMessage(null); }} />
        </Card>
        <Text selectable style={{ color: colors.faint, fontSize: 11, lineHeight: 18, textAlign: 'center' }}>التطبيق يقبل حسابات BUSINESS فقط، ولا يحتوي مفاتيح Connector أو مفاتيح أوربي.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
