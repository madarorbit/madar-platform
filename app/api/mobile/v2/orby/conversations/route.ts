import { mobileContext, mobileError, rows } from '@/src/lib/mobile/v2';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConversationRow = {
  id: string;
  title: string;
  status: 'active' | 'archived';
  updated_at: string;
  last_message_at: string;
  metadata: Record<string, unknown>;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  mode: string;
  content: string;
  source: 'ai' | 'smart-fallback';
  metadata: Record<string, unknown>;
  created_at: string;
};

const mobileMode = (value: unknown) => {
  const mode = String(value || '').toUpperCase();
  if (['GENERAL', 'SALES', 'INVENTORY', 'CUSTOMERS', 'PLANNING'].includes(mode)) return mode;
  if (mode === 'PLAN') return 'PLANNING';
  if (mode === 'REPORT') return 'SALES';
  if (mode === 'MARKETING') return 'CUSTOMERS';
  return 'GENERAL';
};

export async function GET(request: Request) {
  try {
    const context = await mobileContext(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
    const archived = url.searchParams.get('archived') === 'true';
    const search = q ? `&title=ilike.*${encodeURIComponent(q.replace(/[,*()]/g, ''))}*` : '';
    const conversations = rows<ConversationRow>(await supabaseFetch(
      `/rest/v1/orby_conversations?organization_id=eq.${encodeURIComponent(context.workspaceId)}&user_id=eq.${encodeURIComponent(context.user.id)}&status=eq.${archived ? 'archived' : 'active'}${search}&select=id,title,status,updated_at,last_message_at,metadata&order=last_message_at.desc&limit=30`,
      {}, context.accessToken,
    ));
    if (!conversations.length) return Response.json({ items: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    const ids = conversations.map((item) => item.id).join(',');
    const messages = rows<MessageRow>(await supabaseFetch(
      `/rest/v1/orby_messages?organization_id=eq.${encodeURIComponent(context.workspaceId)}&user_id=eq.${encodeURIComponent(context.user.id)}&conversation_id=in.(${ids})&status=in.(completed,stopped)&select=id,conversation_id,role,mode,content,source,metadata,created_at&order=created_at.asc&limit=600`,
      {}, context.accessToken,
    ));
    const byConversation = new Map<string, MessageRow[]>();
    for (const message of messages) byConversation.set(message.conversation_id, [...(byConversation.get(message.conversation_id) || []), message]);
    const items = conversations.map((conversation) => {
      const conversationMessages = byConversation.get(conversation.id) || [];
      const lastMode = conversationMessages.at(-1)?.metadata?.mobile_mode || conversation.metadata?.mobile_mode || conversationMessages.at(-1)?.mode;
      return {
        id: conversation.id,
        title: conversation.title,
        mode: mobileMode(lastMode),
        archived: conversation.status === 'archived',
        updatedAt: conversation.last_message_at || conversation.updated_at,
        messages: conversationMessages.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.content,
          source: message.source,
          createdAt: message.created_at,
          attachments: Array.isArray(message.metadata?.attachments) ? message.metadata.attachments : undefined,
        })),
      };
    });
    return Response.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return mobileError(error); }
}

export async function PATCH(request: Request) {
  try {
    const context = await mobileContext(request);
    const body = await request.json() as { conversationId?: string; archived?: boolean };
    if (!body.conversationId) return Response.json({ error: 'المحادثة غير محددة.' }, { status: 400 });
    await supabaseFetch(
      `/rest/v1/orby_conversations?id=eq.${encodeURIComponent(body.conversationId)}&organization_id=eq.${encodeURIComponent(context.workspaceId)}&user_id=eq.${encodeURIComponent(context.user.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: body.archived === false ? 'active' : 'archived',
          archived_at: body.archived === false ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      },
      context.accessToken,
    );
    return Response.json({ ok: true });
  } catch (error) { return mobileError(error); }
}
