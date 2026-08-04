import { mobileContext, mobileError } from '@/src/lib/mobile/v2';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const context = await mobileContext(request);
    const body = await request.json() as { token?: string; platform?: string };
    const token = String(body.token || '').trim();
    const platform = body.platform === 'ios' ? 'ios' : body.platform === 'android' ? 'android' : null;
    if (!/^ExponentPushToken\[[^\]]+\]$/.test(token) && !/^ExpoPushToken\[[^\]]+\]$/.test(token))
      return Response.json({ error: 'رمز الإشعارات غير صالح.' }, { status: 400 });
    if (!platform) return Response.json({ error: 'نظام الجهاز غير مدعوم.' }, { status: 400 });
    await supabaseFetch('/rest/v1/mobile_push_tokens?on_conflict=user_id,token', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        organization_id: context.workspaceId,
        user_id: context.user.id,
        token,
        platform,
        enabled: true,
        last_seen_at: new Date().toISOString(),
      }),
    }, context.accessToken);
    return Response.json({ ok: true });
  } catch (error) { return mobileError(error); }
}
