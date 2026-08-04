import { POST as orbyPost } from '@/app/api/orby/route';
import { mobileContext, mobileError, rows } from '@/src/lib/mobile/v2';
import { supabaseConfig } from '@/src/lib/env';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AttachmentRow = {
  id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  byte_size: number;
};

const routeMode = (mode: string) => {
  if (mode === 'PLANNING') return 'PLAN';
  if (mode === 'SALES') return 'REPORT';
  if (mode === 'CUSTOMERS') return 'MARKETING';
  return 'ANALYZE';
};

async function textFromAttachment(row: AttachmentRow, accessToken: string) {
  if (row.mime_type !== 'text/plain') return null;
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/authenticated/mobile-orby-attachments/${row.storage_path.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.text()).slice(0, 20000);
}

export async function POST(request: Request) {
  try {
    const context = await mobileContext(request);
    const body = await request.json() as {
      organizationId?: string;
      conversationId?: string | null;
      mode?: string;
      prompt?: string;
      attachmentIds?: string[];
    };
    const prompt = String(body.prompt || '').trim();
    if (body.organizationId !== context.workspaceId || prompt.length < 5 || prompt.length > 12000)
      return Response.json({ error: 'اكتب طلبًا واضحًا بين 5 و12000 حرف.' }, { status: 400 });
    const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds.slice(0, 3) : [];
    let attachments: AttachmentRow[] = [];
    if (attachmentIds.length) {
      attachments = rows<AttachmentRow>(await supabaseFetch(
        `/rest/v1/mobile_orby_attachments?id=in.(${attachmentIds.join(',')})&organization_id=eq.${encodeURIComponent(context.workspaceId)}&user_id=eq.${encodeURIComponent(context.user.id)}&status=eq.uploaded&select=id,storage_path,original_name,mime_type,byte_size`,
        {}, context.accessToken,
      ));
      if (attachments.length !== attachmentIds.length)
        return Response.json({ error: 'أحد المرفقات غير صالح أو لا يخص هذه المساحة.' }, { status: 403 });
    }
    const textParts = await Promise.all(attachments.map((item) => textFromAttachment(item, context.accessToken)));
    const attachmentContext = attachments.length
      ? `\n\nمرفقات الطلب ضمن سياسة مَدار:\n${attachments.map((item, index) => {
          const text = textParts[index];
          return `- ${item.original_name} (${item.mime_type}, ${item.byte_size} بايت)${text ? `\nمحتوى الملف النصي:\n${text}` : '\nالمرفق محفوظ بأمان؛ لا تدّع قراءة محتواه البصري أو محتوى PDF إن لم يكن متاحًا في السياق.'}`;
        }).join('\n')}`
      : '';
    const forwarded = new Request(request.url.replace('/api/mobile/v2/orby/stream', '/api/orby'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${context.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: context.workspaceId,
        conversationId: body.conversationId || null,
        mode: routeMode(String(body.mode || 'GENERAL')),
        prompt: `${prompt}${attachmentContext}`,
      }),
    });
    const result = await orbyPost(forwarded);
    const payload = await result.json() as Record<string, unknown>;
    if (!result.ok) return Response.json(payload, { status: result.status });
    const text = String(payload.text || '');
    if (!text) return Response.json({ error: 'أعاد أوربي ردًا فارغًا.' }, { status: 503 });

    if (attachments.length && payload.conversationId) {
      const metadata = attachments.map((item) => ({ id: item.id, name: item.original_name, mimeType: item.mime_type, size: item.byte_size }));
      void supabaseFetch(
        `/rest/v1/mobile_orby_attachments?id=in.(${attachments.map((item) => item.id).join(',')})`,
        { method: 'PATCH', body: JSON.stringify({ status: 'attached' }) },
        context.accessToken,
      ).catch(() => null);
      void (async () => {
        const recent = rows<{ id: string; metadata: Record<string, unknown> }>(await supabaseFetch(
          `/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(String(payload.conversationId))}&organization_id=eq.${encodeURIComponent(context.workspaceId)}&user_id=eq.${encodeURIComponent(context.user.id)}&role=eq.user&select=id,metadata&order=created_at.desc&limit=1`,
          {}, context.accessToken,
        ));
        const message = recent[0];
        if (message) await supabaseFetch(`/rest/v1/orby_messages?id=eq.${message.id}`, {
          method: 'PATCH', body: JSON.stringify({ metadata: { ...(message.metadata || {}), attachments: metadata, mobile_mode: body.mode || 'GENERAL' } }),
        }, context.accessToken);
      })().catch(() => null);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const chunks = text.match(/.{1,48}(?:\s|$)/gu) || [text];
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', delta: chunk })}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          conversationId: String(payload.conversationId),
          source: String(payload.source || 'ai'),
          remaining: Number(payload.remaining || 0),
        })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'private, no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) { return mobileError(error); }
}
