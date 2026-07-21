export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rybzdpduwgnsjofolini.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_L4P1zdLREZ_9KR3Bew8zkQ_81_h9iyx';
  if (!url || !key) throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  return { url: url.replace(/\/$/, ''), key };
}
export const siteUrl = () => (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  (process.env.NODE_ENV === 'production' ? 'https://madar-store-ten.vercel.app' : 'http://localhost:3000')
).replace(/\/$/, '');
