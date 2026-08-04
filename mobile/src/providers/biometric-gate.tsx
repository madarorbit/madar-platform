import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { secureKeyValue } from '@/lib/secure-store';
import { AppButton } from '@/components/ui';
import { useMadarTheme } from '@/providers/theme-provider';

export function BiometricGate({ children }: { children: ReactNode }) {
  const { colors } = useMadarTheme();
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const unlock = useCallback(async () => {
    if (!enabled) return setLocked(false);
    const available = await LocalAuthentication.hasHardwareAsync();
    const enrolled = available && (await LocalAuthentication.isEnrolledAsync());
    if (!enrolled) return setLocked(false);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'افتح مَدار',
      cancelLabel: 'إلغاء',
      fallbackLabel: 'استخدام رمز الجهاز',
      disableDeviceFallback: false,
    });
    setLocked(!result.success);
  }, [enabled]);

  useEffect(() => {
    secureKeyValue.getItem('madar-biometric-lock').then((value) => {
      const next = value === 'enabled';
      setEnabled(next);
      setLocked(next);
    });
  }, []);
  useEffect(() => {
    if (enabled) void unlock();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') setLocked(enabled);
      if (state === 'active' && enabled) void unlock();
    });
    return () => subscription.remove();
  }, [enabled, unlock]);

  if (!locked) return children;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, backgroundColor: colors.background }}>
      <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>مَدار مقفل</Text>
      <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>استخدم بصمة الجهاز أو رمز القفل للعودة إلى لوحة القيادة.</Text>
      <View style={{ width: '100%', maxWidth: 320 }}><AppButton label="فتح التطبيق" onPress={() => void unlock()} /></View>
    </View>
  );
}
