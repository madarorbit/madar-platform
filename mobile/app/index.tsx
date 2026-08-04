import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';

export default function EntryRoute() {
  const { session, recovery } = useAuth();
  if (recovery) return <Redirect href="/(auth)/reset-password" />;
  return <Redirect href={session ? '/(app)' : '/(auth)/login'} />;
}
