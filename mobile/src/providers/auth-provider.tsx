import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import type { Session, Subscription } from '@supabase/supabase-js';
import { bindSessionAutoRefresh, getSupabase, resetSupabaseClient } from '@/lib/supabase';

export type SignOutScope = 'local' | 'global';
type AuthContextValue = {
  session: Session | null;
  ready: boolean;
  recovery: boolean;
  startupError: string | null;
  retryStartup: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  sendRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: (scope?: SignOutScope) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

function authStartupMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'تعذر تجهيز تسجيل الدخول. تحقق من الشبكة ثم أعد المحاولة.';
}

function authParamsFromUrl(url: string) {
  const normalized = url.replace('#', '?');
  const parsed = new URL(normalized);
  return {
    accessToken: parsed.searchParams.get('access_token'),
    refreshToken: parsed.searchParams.get('refresh_token'),
    code: parsed.searchParams.get('code'),
    type: parsed.searchParams.get('type'),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let authSubscription: Subscription | null = null;
    let linkSubscription: ReturnType<typeof Linking.addEventListener> | null = null;
    let unbind: () => void = () => undefined;

    setReady(false);
    setStartupError(null);

    void (async () => {
      try {
        const client = await getSupabase();
        if (!active) return;
        unbind = bindSessionAutoRefresh(client);
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
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
            const params = authParamsFromUrl(url);
            if (params.code) {
              const { error } = await client.auth.exchangeCodeForSession(params.code);
              if (!error && params.type === 'recovery' && active) setRecovery(true);
              return;
            }
            if (params.accessToken && params.refreshToken) {
              const { error } = await client.auth.setSession({
                access_token: params.accessToken,
                refresh_token: params.refreshToken,
              });
              if (!error && params.type === 'recovery' && active) setRecovery(true);
            }
          } catch {
            // Invalid external links are ignored safely.
          }
        };

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await handleUrl({ url: initialUrl });
        if (!active) return;
        linkSubscription = Linking.addEventListener('url', handleUrl);
      } catch (error) {
        if (active) setStartupError(authStartupMessage(error));
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
  }, [attempt]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    ready,
    recovery,
    startupError,
    retryStartup: () => {
      resetSupabaseClient();
      setAttempt((current) => current + 1);
    },
    signIn: async (email, password) => {
      const client = await getSupabase();
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error('بيانات الدخول غير صحيحة أو أن الحساب غير مفعل.');
    },
    sendRecovery: async (email) => {
      const client = await getSupabase();
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'madar://reset-password' });
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
  }), [ready, recovery, session, startupError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProviderMissing');
  return value;
}
