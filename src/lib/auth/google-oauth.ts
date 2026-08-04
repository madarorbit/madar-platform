import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { safeReturnTo } from '@/src/lib/auth';

export const GOOGLE_OAUTH_STATE_COOKIE = 'madar-google-oauth-state';
export const GOOGLE_OAUTH_VERIFIER_COOKIE = 'madar-google-oauth-verifier';
export const GOOGLE_OAUTH_NEXT_COOKIE = 'madar-google-oauth-next';
export const GOOGLE_OAUTH_MAX_AGE = 10 * 60;

export type GoogleOAuthErrorCode =
  | 'google_cancelled'
  | 'google_provider_unavailable'
  | 'google_email_missing'
  | 'oauth_state_invalid'
  | 'oauth_code_missing'
  | 'oauth_expired'
  | 'oauth_network_error'
  | 'oauth_profile_error'
  | 'supabase_oauth_error';

export type OAuthIdentity = {
  id?: string;
  identity_id?: string;
  provider_id?: string;
  provider?: string;
  identity_data?: Record<string, unknown> | null;
};

export type OAuthUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: OAuthIdentity[] | null;
};

export type OAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: OAuthUser | null;
};

export const oauthCookieOptions = (maxAge = GOOGLE_OAUTH_MAX_AGE) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/auth/google',
  maxAge,
});

export function randomBase64Url(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function codeChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function stateMatches(expected: string | undefined, actual: string | null) {
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function safeOAuthReturnTo(value: string | null | undefined) {
  const destination = safeReturnTo(value, '/account');
  if (
    destination === '/login' ||
    destination.startsWith('/login?') ||
    destination === '/register' ||
    destination.startsWith('/register?') ||
    destination.startsWith('/auth/google')
  ) {
    return '/account';
  }
  return destination;
}

export function googleIdentity(user: OAuthUser) {
  return user.identities?.find((identity) => identity.provider === 'google') ?? null;
}

export function googleSubject(user: OAuthUser) {
  const identity = googleIdentity(user);
  const subject = identity?.identity_data?.sub;
  return typeof subject === 'string' && subject.trim()
    ? subject
    : identity?.provider_id || identity?.identity_id || identity?.id || null;
}

export function metadataText(metadata: Record<string, unknown> | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function googleOAuthErrorMessage(code: string | undefined) {
  const messages: Record<string, string> = {
    google_cancelled: 'تم إلغاء تسجيل الدخول باستخدام Google. لم يطرأ أي تغيير على حسابك.',
    google_provider_unavailable: 'تسجيل الدخول باستخدام Google غير متاح مؤقتًا. يمكنك استخدام البريد الإلكتروني الآن.',
    google_email_missing: 'لم يرسل Google بريدًا إلكترونيًا صالحًا للحساب. استخدم حساب Google يحتوي على بريد متاح.',
    oauth_state_invalid: 'تعذر التحقق من أمان محاولة تسجيل الدخول. ابدأ المحاولة من جديد.',
    oauth_code_missing: 'لم تكتمل استجابة Google. أعد محاولة تسجيل الدخول.',
    oauth_expired: 'انتهت صلاحية محاولة تسجيل الدخول باستخدام Google. ابدأ محاولة جديدة.',
    oauth_network_error: 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من اتصالك ثم حاول مجددًا.',
    oauth_profile_error: 'تم تسجيل الدخول، لكن تعذر تجهيز ملفك الشخصي بأمان. أعد المحاولة.',
    supabase_oauth_error: 'تعذر إتمام تسجيل الدخول باستخدام Google عبر خدمة المصادقة. حاول مجددًا.',
  };
  return code ? messages[code] : undefined;
}

export function classifyOAuthError(payload: Record<string, unknown> | null, status: number): GoogleOAuthErrorCode {
  const code = String(payload?.error_code || payload?.code || '').toLowerCase();
  const message = String(payload?.error_description || payload?.msg || payload?.message || '').toLowerCase();
  if (code.includes('provider') || message.includes('provider is not enabled') || message.includes('unsupported provider')) {
    return 'google_provider_unavailable';
  }
  if (code.includes('expired') || message.includes('expired') || message.includes('invalid grant')) {
    return 'oauth_expired';
  }
  return status >= 500 ? 'oauth_network_error' : 'supabase_oauth_error';
}
