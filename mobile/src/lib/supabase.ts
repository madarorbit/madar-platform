import { AppState } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { config } from '@/config';
import { secureKeyValue } from '@/lib/secure-store';

export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
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
});

let appStateBound = false;
export function bindSessionAutoRefresh() {
  if (appStateBound || process.env.EXPO_OS === 'web') return () => undefined;
  appStateBound = true;
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
  return () => {
    appStateBound = false;
    subscription.remove();
  };
}
