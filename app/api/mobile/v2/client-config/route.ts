import { supabaseConfig } from '@/src/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { url, key } = supabaseConfig();
  return Response.json(
    {
      supabaseUrl: url,
      supabasePublishableKey: key,
      contractVersion: '2.0',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
