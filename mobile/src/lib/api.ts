import type { DashboardSnapshot, OrbyMode, OrbyReply } from '@/types';

const apiBase = (process.env.EXPO_PUBLIC_MADAR_API_URL || 'https://www.orbitmadar.com').replace(/\/$/, '');

async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const raw = await response.text();
  let payload: unknown = null;
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error('أعاد الخادم استجابة غير صالحة.');
    }
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String((payload as { error?: unknown }).error || '')
      : '';
    throw new Error(message || (response.status === 401 ? 'انتهت جلسة تسجيل الدخول.' : 'تعذر الاتصال بمَدار الآن.'));
  }

  return payload as T;
}

export function fetchDashboard(accessToken: string) {
  return request<DashboardSnapshot>('/api/mobile/v1/dashboard', accessToken);
}

export function askOrby(accessToken: string, input: {
  organizationId: string;
  conversationId: string | null;
  mode: OrbyMode;
  prompt: string;
}) {
  return request<OrbyReply>('/api/orby', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
