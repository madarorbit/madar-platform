import { fetch } from 'expo/fetch';
import type { DashboardSnapshot, OrbyMode, OrbyReply } from '@/types';

const apiBase = (process.env.EXPO_PUBLIC_MADAR_API_URL || 'https://www.orbitmadar.com').replace(/\/$/, '');
const requestTimeoutMs = 20_000;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: 'AUTH' | 'HTTP' | 'NETWORK' | 'TIMEOUT') {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  headers.set('Cache-Control', 'no-cache');
  if (init.body) headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${apiBase}${path}`, { ...init, headers, signal: controller.signal });
    const raw = await response.text();
    let payload: unknown = null;
    if (raw.trim()) {
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new ApiError('أعاد الخادم استجابة غير صالحة.', response.status, 'HTTP');
      }
    }

    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error?: unknown }).error || '')
        : '';
      throw new ApiError(
        message || (response.status === 401 ? 'انتهت جلسة تسجيل الدخول.' : 'تعذر الاتصال بمَدار الآن.'),
        response.status,
        response.status === 401 ? 'AUTH' : 'HTTP',
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('استغرق الاتصال وقتًا أطول من المعتاد.', 0, 'TIMEOUT');
    }
    throw new ApiError('تعذر الوصول إلى مَدار. تحقق من اتصال الإنترنت.', 0, 'NETWORK');
  } finally {
    clearTimeout(timeout);
  }
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
