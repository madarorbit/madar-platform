import { Redirect, Tabs } from 'expo-router';
import { Text, View, type ColorValue } from 'react-native';
import { AppProvider, useMadarApp } from '@/providers/app-provider';
import { BiometricGate } from '@/providers/biometric-gate';
import { useAuth } from '@/providers/auth-provider';
import { useMadarTheme } from '@/providers/theme-provider';

type TabIconProps = { focused: boolean; color: ColorValue; size: number };
function tabIcon(symbol: string) {
  function MadarTabIcon({ color, size }: TabIconProps) {
    return <Text style={{ color, fontSize: Math.min(size, 19), fontWeight: '900' }}>{symbol}</Text>;
  }
  MadarTabIcon.displayName = `MadarTabIcon(${symbol})`;
  return MadarTabIcon;
}
function HeaderTitle() {
  const { snapshot, stale } = useMadarApp();
  const { colors } = useMadarTheme();
  return <View style={{ alignItems: 'flex-end', width: '100%' }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '900', maxWidth: 190, textAlign: 'right' }}>{snapshot?.workspace.name || 'مَدار'}</Text><Text style={{ color: stale ? colors.amber : colors.mint, fontSize: 10, textAlign: 'right' }}>{stale ? 'البيانات ليست لحظية' : 'متزامن الآن'}</Text></View>;
}
function TabsLayout() {
  const { colors } = useMadarTheme();
  return (
    <Tabs screenOptions={{
      headerTitle: () => <HeaderTitle />, headerTitleAlign: 'left', headerStyle: { backgroundColor: colors.tab }, headerShadowVisible: false,
      sceneStyle: { backgroundColor: colors.background }, tabBarStyle: { height: 66, paddingTop: 6, backgroundColor: colors.tab, borderTopColor: colors.border },
      tabBarActiveTintColor: colors.mint, tabBarInactiveTintColor: colors.faint, tabBarLabelStyle: { fontSize: 9, fontWeight: '800', paddingBottom: 5 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: tabIcon('⌂') }} />
      <Tabs.Screen name="alerts" options={{ title: 'التنبيهات', tabBarIcon: tabIcon('!') }} />
      <Tabs.Screen name="operations" options={{ title: 'العمليات', tabBarIcon: tabIcon('↻') }} />
      <Tabs.Screen name="reports" options={{ title: 'التقارير', tabBarIcon: tabIcon('▥') }} />
      <Tabs.Screen name="orby" options={{ title: 'أوربي', tabBarIcon: tabIcon('◉') }} />
      <Tabs.Screen name="account" options={{ title: 'الحساب', tabBarIcon: tabIcon('●') }} />
      <Tabs.Screen name="about" options={{ href: null, title: 'حول التطبيق' }} />
      <Tabs.Screen name="privacy" options={{ href: null, title: 'سياسة الخصوصية' }} />
    </Tabs>
  );
}
export default function ProtectedLayout() {
  const { session } = useAuth();
  if (!session) return <Redirect href="/(auth)/login" />;
  return <AppProvider><BiometricGate><TabsLayout /></BiometricGate></AppProvider>;
}
