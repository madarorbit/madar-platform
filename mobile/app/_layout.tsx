import '@/gesture-handler';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '@/components/error-boundary';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemeProvider, useMadarTheme } from '@/providers/theme-provider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function StartupRecovery({ onRetry }: { onRetry: () => void }) {
  const { colors } = useMadarTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}
    >
      <View style={{ gap: 14, padding: 22, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'right' }}>
          تعذر إكمال تشغيل مَدار
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 24, textAlign: 'right' }}>
          لم نترك التطبيق عالقًا عند الشعار. تحقق من اتصال الإنترنت ثم أعد محاولة تجهيز الجلسة.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={{ minHeight: 50, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 15, backgroundColor: colors.mint }}
        >
          <Text style={{ color: '#07120F', fontWeight: '900', textAlign: 'center' }}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AppNavigator() {
  const { ready, retryStartup } = useAuth();
  const { resolved, colors } = useMadarTheme();
  const [watchdogExpired, setWatchdogExpired] = useState(false);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setWatchdogExpired(true), 10_000);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (ready || watchdogExpired) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, watchdogExpired]);

  if (!ready && !watchdogExpired) return null;
  if (!ready) return <StartupRecovery onRetry={() => { setWatchdogExpired(false); retryStartup(); }} />;

  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <AppNavigator />
            </AuthProvider>
          </ThemeProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
