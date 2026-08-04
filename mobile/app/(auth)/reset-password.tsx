import { useState } from 'react';
import { Redirect, Text, TextInput } from 'react-native';
import { Screen } from '@/components/screen';
import { AppButton, Card } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useMadarTheme } from '@/providers/theme-provider';

export default function ResetPasswordScreen() {
  const { recovery, updatePassword } = useAuth();
  const { colors } = useMadarTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!recovery) return <Redirect href="/" />;
  const inputStyle = { minHeight: 50, paddingHorizontal: 14, borderRadius: 14, color: colors.text, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, textAlign: 'right' as const };
  async function submit() {
    setError(null);
    if (password.length < 8) return setError('استخدم 8 أحرف على الأقل.');
    if (password !== confirm) return setError('كلمتا المرور غير متطابقتين.');
    setLoading(true);
    try { await updatePassword(password); } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر التحديث.'); } finally { setLoading(false); }
  }
  return <Screen contentContainerStyle={{ justifyContent: 'center' }}><Card><Text selectable style={{ color: colors.text, fontSize: 23, fontWeight: '900', textAlign: 'right' }}>كلمة مرور جديدة</Text><Text selectable style={{ color: colors.muted, lineHeight: 22, textAlign: 'right' }}>أكمل الاستعادة داخل مَدار ثم ستعود جلسة التطبيق للعمل تلقائيًا.</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="كلمة المرور الجديدة" placeholderTextColor={colors.faint} style={inputStyle} /><TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="تأكيد كلمة المرور" placeholderTextColor={colors.faint} style={inputStyle} />{error ? <Text selectable style={{ color: colors.red, textAlign: 'right' }}>{error}</Text> : null}<AppButton label="حفظ كلمة المرور" loading={loading} onPress={() => void submit()} /></Card></Screen>;
}
