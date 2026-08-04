import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useMadarTheme } from '@/providers/theme-provider';

export default function AuthLayout() {
  const { session, recovery } = useAuth();
  const { colors } = useMadarTheme();
  if (session && !recovery) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} />;
}
