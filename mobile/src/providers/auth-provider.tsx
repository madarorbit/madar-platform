import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { bindSessionAutoRefresh, supabase } from '@/lib/supabase';

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
    const unbind = bindSessionAutoRefresh();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    const handleUrl = async ({ url }: { url: string }) => {
      try {
        const tokens = tokensFromUrl(url);
        if (tokens.accessToken && tokens.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });
          if (!error && tokens.type === 'recovery') setRecovery(true);
        }
      } catch {
        // Invalid external links are ignored safely.
      }
    };
    Linking.getInitialURL().then((url) => url && handleUrl({ url }));
    const linkSubscription = Linking.addEventListener('url', handleUrl);
    return () => {
      data.subscription.unsubscribe();
      linkSubscription.remove();
      unbind();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    ready,
    recovery,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error('بيانات الدخول غير صحيحة أو أن الحساب غير مفعل.');
    },
    sendRecovery: async (email) => {
      const redirectTo = Linking.createURL('/reset-password', { scheme: 'madar' });
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw new Error('تعذر إرسال رابط الاستعادة الآن.');
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error('تعذر تحديث كلمة المرور.');
      setRecovery(false);
    },
    signOut: async (scope = 'local') => {
      const { error } = await supabase.auth.signOut({ scope });
      if (error && scope === 'global') await supabase.auth.signOut({ scope: 'local' });
    },
  }), [ready, recovery, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProviderMissing');
  return value;
}
