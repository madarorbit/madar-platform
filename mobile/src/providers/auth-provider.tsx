import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import type { Session, Subscription } from '@supabase/supabase-js';
import { bindSessionAutoRefresh, getSupabase } from '@/lib/supabase';

export type SignOutScope = 'local' | 'global';
type AuthContextValue = {
  session: Session | null;
  ready: boolean;
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  sendRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: (scope?: SignOutScope) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

function tokensFromUrl(url: string) {
  const normalized = url.replace('#', '?');
  const parsed = new URL(normalized);
  return {
    accessToken: parsed.searchParams.get('access_token'),
    refreshToken: parsed.searchParams.get('refresh_token'),
    type: parsed.searchParams.get('type'),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    let authSubscription: Subscription | null = null;
    let linkSubscription: ReturnType<typeof Linking.addEventListener> | null = null;
    let unbind: () => void = () => undefined;

    void (async () => {
      try {
        const client = await getSupabase();
        if (!active) return;
        unbind = bindSessionAutoRefresh(client);
        const { data: sessionData } = await client.auth.getSession();
        if (!active) return;
        setSession(sessionData.session);
        const { data } = client.auth.onAuthStateChange((event, nextSession) => {
          if (!active) return;
          setSession(nextSession);
          if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        });
        authSubscription = data.subscription;

        const handleUrl = async ({ url }: { url: string }) => {
          try {
            const tokens = tokensFromUrl(url);
            if (tokens.accessToken && tokens.refreshToken) {
              const { error } = await client.auth.setSession({
                access_token: tokens.accessToken,
                refresh_token: tokens.refreshToken,
              });
              if (!error && tokens.type === 'recovery' && active) setRecovery(true);
            }
          } catch {
            // Invalid external links are ignored safely.
          }
        };
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await handleUrl({ url: initialUrl });
        if (!active) return;
        linkSubscription = Linking.addEventListener('url', handleUrl);
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
      authSubscription?.unsubscribe();
      linkSubscription?.remove();
      unbind();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    ready,
    recovery,
    signIn: async (email, password) => {
      const client = await getSupabase();
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error('بيانات الدخول غير صحيحة أو أن الحساب غير مفعل.');
    },
    sendRecovery: async (email) => {
      const client = await getSupabase();
      const redirectTo = Linking.createURL('/reset-password', { scheme: 'madar' });
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw new Error('تعذر إرسال رابط الاستعادة الآن.');
    },
    updatePassword: async (password) => {
      const client = await getSupabase();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error('تعذر تحديث كلمة المرور.');
      setRecovery(false);
    },
    signOut: async (scope = 'local') => {
      const client = await getSupabase();
      const { error } = await client.auth.signOut({ scope });
      if (error && scope === 'global') await client.auth.signOut({ scope: 'local' });
    },
  }), [ready, recovery, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProviderMissing');
  return value;
}
