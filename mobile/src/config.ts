const clean = (value: string | undefined) => String(value || '').trim();

export const config = {
  apiBase: (clean(process.env.EXPO_PUBLIC_MADAR_API_URL) || 'https://www.orbitmadar.com').replace(/\/$/, ''),
  supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: clean(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  releaseChannel: clean(process.env.EXPO_PUBLIC_RELEASE_CHANNEL) || 'development',
  appVersion: '2.1.0',
};

export function hasValidEmbeddedSupabaseConfig() {
  return config.supabaseUrl.startsWith('https://')
    && config.supabaseUrl.includes('.supabase.co')
    && config.supabasePublishableKey.length >= 20;
}
