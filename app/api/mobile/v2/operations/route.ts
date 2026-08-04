import { mapOperation, mobileContext, mobileError, nextCursor, pageOffset, rows } from '@/src/lib/mobile/v2';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const context = await mobileContext(request);
    const offset = pageOffset(new URL(request.url).searchParams.get('cursor'));
    const data = rows<Record<string, unknown>>(await supabaseFetch(
      `/rest/v1/mobile_command_requests?organization_id=eq.${encodeURIComponent(context.workspaceId)}&select=id,action,summary,status,target_type,target_id,created_at,updated_at,message&order=updated_at.desc,id.desc&limit=${PAGE_SIZE + 1}&offset=${offset}`,
      {}, context.accessToken,
    ));
    const hasMore = data.length > PAGE_SIZE;
    return Response.json({
      items: data.slice(0, PAGE_SIZE).map(mapOperation),
      hasMore,
      nextCursor: hasMore ? nextCursor(offset + PAGE_SIZE) : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return mobileError(error); }
}
