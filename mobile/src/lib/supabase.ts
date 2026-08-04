import { AppState } from 'react-native';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { config } from '@/config';
import { secureKeyValue } from '@/lib/secure-store';

type PublicClientConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  contractVersion: '2.0';
};

let clientPromise: Promise<SupabaseClient> | null = null;

async function loadPublicClientConfig(): Promise<PublicClientConfig> {
  const response = await fetch(`${config.apiBase}/api/mobile/v2/client-config`, {
    headers: { Accept: 'application/json', 'x-madar-client': 'mobile-v2' },
  });
  if (!response.ok) throw new Error('تعذر تحميل إعداد تسجيل الدخول من مَدار.');
  const payload = await response.json() as Partial<PublicClientConfig>;
  const url = String(payload.supabaseUrl || '').trim();
  const publishableKey = String(payload.supabasePublishableKey || '').trim();
  if (!url.startsWith('https://') || !url.includes('.supabase.co') || publishableKey.length < 20) {
    throw new Error('إعداد تسجيل الدخول الذي أعادته مَدار غير صالح.');
  }
  return { supabaseUrl: url, supabasePublishableKey: publishableKey, contractVersion: '2.0' };
}

export function getSupabase() {
  clientPromise ||= loadPublicClientConfig().then(({ supabaseUrl, supabasePublishableKey }) =>
    createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: secureKeyValue,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
        storageKey: 'madar-mobile-v2-auth',
      },
      global: {
        headers: { 'x-madar-client': 'mobile-v2' },
      },
    }),
  ).catch((error) => {
    clientPromise = null;
    throw error;
  });
  return clientPromise;
}

let appStateBound = false;
export function bindSessionAutoRefresh(client: SupabaseClient) {
  if (appStateBound || process.env.EXPO_OS === 'web') return () => undefined;
  appStateBound = true;
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
  return () => {
    appStateBound = false;
    subscription.remove();
  };
}
