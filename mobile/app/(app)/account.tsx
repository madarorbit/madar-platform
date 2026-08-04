import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { PageHeader, Screen } from '@/components/screen';
import { AppButton, Badge, Card, SectionTitle, Skeleton } from '@/components/ui';
import { secureKeyValue } from '@/lib/secure-store';
import { useMadarApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import { type ThemeMode, useMadarTheme } from '@/providers/theme-provider';

export default function AccountScreen() {
  const { snapshot, selectWorkspace } = useMadarApp();
  const { signOut } = useAuth();
  const { colors, mode, setMode } = useMadarTheme();
  const [biometric, setBiometric] = useState(false);
  useEffect(() => { secureKeyValue.getItem('madar-biometric-lock').then((value) => setBiometric(value === 'enabled')); }, []);
  if (!snapshot) return <Screen><Skeleton height={150} /><Skeleton height={210} /></Screen>;
  async function toggleBiometric() {
    if (!biometric) {
      const available = await LocalAuthentication.hasHardwareAsync();
      const enrolled = available && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) return Alert.alert('القفل الحيوي غير متاح', 'فعّل بصمة أو قفل الجهاز أولًا.');
    }
    const next = !biometric; setBiometric(next);
    await secureKeyValue.setItem('madar-biometric-lock', next ? 'enabled' : 'disabled');
  }
  return <Screen><PageHeader eyebrow="الحساب" title={snapshot.profile.fullName || 'حساب مَدار'} subtitle={snapshot.profile.email || undefined} /><Card><SectionTitle title="مساحة العمل" /><Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{snapshot.workspace.name}</Text><View style={{ flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' }}><Badge label={snapshot.vertical.name} tone="info" /><Badge label={snapshot.workspace.operatingMode} tone="good" /><Badge label={snapshot.workspace.role} /></View>{snapshot.availableWorkspaces.length > 1 && <View style={{ gap: 8 }}>{snapshot.availableWorkspaces.map((workspace) => <Pressable key={workspace.id} onPress={() => void selectWorkspace(workspace.id)} style={{ padding: 13, borderRadius: 14, backgroundColor: workspace.id === snapshot.workspace.id ? colors.mintSoft : colors.elevated }}><Text selectable style={{ color: workspace.id === snapshot.workspace.id ? colors.mint : colors.text, fontWeight: '800', textAlign: 'right' }}>{workspace.name}</Text></Pressable>)}</View>}</Card><Card><SectionTitle title="المظهر" /><View style={{ flexDirection: 'row-reverse', gap: 8 }}>{(['system', 'dark', 'light'] as ThemeMode[]).map((item) => <Pressable key={item} onPress={() => void setMode(item)} style={{ flex: 1, padding: 12, borderRadius: 13, backgroundColor: mode === item ? colors.violetSoft : colors.elevated }}><Text style={{ color: mode === item ? colors.violet : colors.muted, textAlign: 'center', fontWeight: '800' }}>{item === 'system' ? 'تلقائي' : item === 'dark' ? 'داكن' : 'فاتح'}</Text></Pressable>)}</View><Pressable onPress={() => void toggleBiometric()} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 13, borderRadius: 14, backgroundColor: colors.elevated }}><Text selectable style={{ color: colors.text, fontWeight: '800' }}>القفل الحيوي</Text><Badge label={biometric ? 'مفعّل' : 'اختياري'} tone={biometric ? 'good' : 'neutral'} /></Pressable></Card><Card><AppButton kind="secondary" label="حول التطبيق" onPress={() => router.push('/(app)/about')} /><AppButton kind="secondary" label="سياسة الخصوصية" onPress={() => router.push('/(app)/privacy')} /></Card><Card><AppButton kind="secondary" label="تسجيل الخروج من هذا الجهاز" onPress={() => void signOut('local')} /><AppButton kind="danger" label="تسجيل الخروج من جميع الأجهزة" onPress={() => Alert.alert('تسجيل الخروج من جميع الأجهزة', 'سيتم إبطال جلسات الحساب النشطة. هل تريد المتابعة؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'تأكيد', style: 'destructive', onPress: () => void signOut('global') }])} /></Card></Screen>;
}