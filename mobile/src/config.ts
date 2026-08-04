const required = (name: string, value: string | undefined) => {
  if (!value?.trim()) throw new Error(`MISSING_${name}`);
  return value.trim();
};

export const config = {
  apiBase: (process.env.EXPO_PUBLIC_MADAR_API_URL || 'https://www.orbitmadar.com').replace(/\/$/, ''),
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  releaseChannel: process.env.EXPO_PUBLIC_RELEASE_CHANNEL || 'development',
};
