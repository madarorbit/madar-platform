import type {
  MobileAlert,
  MobileCommandInput,
  MobileCommandPreview,
  MobileCommandResult,
  MobileDashboardSnapshot,
  MobileOperation,
  MobilePage,
  OrbyConversation,
  OrbyMode,
} from '@madar/contracts/mobile-v2';
import { config } from '@/config';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let payload: unknown = null;
  if (raw.trim()) {
    try { payload = JSON.parse(raw); }
    catch { throw new ApiError('أعاد الخادم استجابة غير صالحة.', response.status || 500); }
  }
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error || '') : '';
    throw new ApiError(message || (response.status === 401 ? 'انتهت جلسة تسجيل الدخول.' : 'تعذر الاتصال بمَدار الآن.'), response.status);
  }
  return payload as T;
}

async function request<T>(path: string, accessToken: string, init: RequestInit = {}, workspaceId?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  headers.set('x-madar-mobile-version', '2.0');
  if (workspaceId) headers.set('x-madar-workspace-id', workspaceId);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${config.apiBase}${path}`, { ...init, headers });
  return parseResponse<T>(response);
}

export const mobileApi = {
  bootstrap(accessToken: string, workspaceId?: string | null) {
    return request<MobileDashboardSnapshot>('/api/mobile/v2/bootstrap', accessToken, {}, workspaceId);
  },
  alerts(accessToken: string, workspaceId: string, cursor?: string | null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request<MobilePage<MobileAlert>>(`/api/mobile/v2/alerts${query}`, accessToken, {}, workspaceId);
  },
  operations(accessToken: string, workspaceId: string, cursor?: string | null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request<MobilePage<MobileOperation>>(`/api/mobile/v2/operations${query}`, accessToken, {}, workspaceId);
  },
  previewCommand(accessToken: string, input: MobileCommandInput) {
    return request<MobileCommandPreview>('/api/mobile/v2/commands/preview', accessToken, { method: 'POST', body: JSON.stringify(input) }, input.organizationId);
  },
  confirmCommand(accessToken: string, input: MobileCommandInput & { confirmationToken: string }) {
    return request<MobileCommandResult>('/api/mobile/v2/commands/confirm', accessToken, { method: 'POST', body: JSON.stringify(input) }, input.organizationId);
  },
  conversations(accessToken: string, workspaceId: string, query = '') {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
    return request<{ items: OrbyConversation[] }>(`/api/mobile/v2/orby/conversations${suffix}`, accessToken, {}, workspaceId);
  },
  archiveConversation(accessToken: string, workspaceId: string, conversationId: string, archived: boolean) {
    return request<{ ok: true }>('/api/mobile/v2/orby/conversations', accessToken, { method: 'PATCH', body: JSON.stringify({ conversationId, archived }) }, workspaceId);
  },
  async uploadOrbyAttachment(accessToken: string, workspaceId: string, asset: { uri: string; name: string; mimeType?: string | null; size?: number | null }) {
    const form = new FormData();
    form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' } as unknown as Blob);
    return request<{ id: string; name: string; mimeType: string; size: number }>('/api/mobile/v2/orby/attachments', accessToken, { method: 'POST', body: form }, workspaceId);
  },
  registerPushToken(accessToken: string, workspaceId: string, token: string, platform: string) {
    return request<{ ok: true }>('/api/mobile/v2/push-token', accessToken, { method: 'POST', body: JSON.stringify({ token, platform }) }, workspaceId);
  },
};

export async function streamOrby(input: {
  accessToken: string;
  organizationId: string;
  conversationId: string | null;
  mode: OrbyMode;
  prompt: string;
  attachmentIds?: string[];
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}) {
  const response = await fetch(`${config.apiBase}/api/mobile/v2/orby/stream`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.accessToken}`, Accept: 'text/event-stream', 'Content-Type': 'application/json', 'x-madar-workspace-id': input.organizationId },
    body: JSON.stringify({ organizationId: input.organizationId, conversationId: input.conversationId, mode: input.mode, prompt: input.prompt, attachmentIds: input.attachmentIds || [] }),
    signal: input.signal,
  });
  if (!response.ok) return parseResponse<never>(response);
  if (!response.body) throw new ApiError('تعذر بدء بث رد أوربي.', 503);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: { conversationId: string; source: 'ai' | 'smart-fallback'; remaining: number } | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const line = event.split('\n').find((item) => item.startsWith('data:'));
      if (!line) continue;
      const data = JSON.parse(line.slice(5).trim()) as
        | { type: 'delta'; delta: string }
        | { type: 'done'; conversationId: string; source: 'ai' | 'smart-fallback'; remaining: number }
        | { type: 'error'; error: string };
      if (data.type === 'delta') input.onDelta(data.delta);
      if (data.type === 'done') result = data;
      if (data.type === 'error') throw new ApiError(data.error, 503);
    }
  }
  if (!result) throw new ApiError('انقطع رد أوربي قبل اكتماله.', 503);
  return result;
}
