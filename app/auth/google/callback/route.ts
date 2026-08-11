import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/app/actions/auth';
import { siteUrl, supabaseConfig } from '@/src/lib/env';
import { supabaseFetch } from '@/src/lib/supabase/server';
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  classifyOAuthError,
  googleSubject,
  metadataText,
  oauthCookieOptions,
  safeOAuthReturnTo,
  stateMatches,
  type GoogleOAuthErrorCode,
  type OAuthSession,
  type OAuthUser,
} from '@/src/lib/auth/google-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProfileSnapshot = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

function clearOAuthCookies(jar: Awaited<ReturnType<typeof cookies>>) {
  const expired = oauthCookieOptions(0);
  jar.set(GOOGLE_OAUTH_STATE_COOKIE, '', expired);
  jar.set(GOOGLE_OAUTH_VERIFIER_COOKIE, '', expired);
  jar.set(GOOGLE_OAUTH_NEXT_COOKIE, '', expired);
}

function loginError(code: GoogleOAuthErrorCode) {
  const target = new URL('/login', siteUrl());
  target.searchParams.set('error', code);
  return target;
}

function callbackError(search: URLSearchParams): GoogleOAuthErrorCode | null {
  const error = (search.get('error') || '').toLowerCase();
  const code = (search.get('error_code') || '').toLowerCase();
  const description = (search.get('error_description') || '').toLowerCase();
  if (!error && !code && !description) return null;
  if (error === 'access_denied' || code === 'access_denied' || description.includes('denied') || description.includes('cancel')) {
    return 'google_cancelled';
  }
  if (description.includes('provider') || code.includes('provider')) return 'google_provider_unavailable';
  return 'supabase_oauth_error';
}

async function fail(jar: Awaited<ReturnType<typeof cookies>>, code: GoogleOAuthErrorCode) {
  clearOAuthCookies(jar);
  const response = NextResponse.redirect(loginError(code));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const expectedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const actualState = request.nextUrl.searchParams.get('madar_state');
  if (!stateMatches(expectedState, actualState)) return fail(jar, 'oauth_state_invalid');

  const providerError = callbackError(request.nextUrl.searchParams);
  if (providerError) return fail(jar, providerError);

  const code = request.nextUrl.searchParams.get('code');
  const verifier = jar.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value;
  if (!code || !verifier) return fail(jar, code ? 'oauth_expired' : 'oauth_code_missing');

  let payload: Record<string, unknown> | null = null;
  let status = 500;
  try {
    const { url, key } = supabaseConfig();
    const exchange = await fetch(`${url}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      cache: 'no-store',
    });
    status = exchange.status;
    payload = (await exchange.json().catch(() => null)) as Record<string, unknown> | null;
    if (!exchange.ok) return fail(jar, classifyOAuthError(payload, exchange.status));
  } catch {
    return fail(jar, 'oauth_network_error');
  }

  const session = payload as unknown as OAuthSession;
  if (!session?.access_token || !session.refresh_token || !session.expires_in) {
    return fail(jar, classifyOAuthError(payload, status));
  }

  let user = session.user ?? null;
  if (!user) {
    try {
      user = (await supabaseFetch('/auth/v1/user', {}, session.access_token)) as OAuthUser;
    } catch {
      return fail(jar, 'supabase_oauth_error');
    }
  }

  const userEmail = user.email?.trim();
  if (!userEmail) return fail(jar, 'google_email_missing');

  try {
    const rows = (await supabaseFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,avatar_url&limit=1`,
      {},
      session.access_token,
    )) as ProfileSnapshot[];
    const profile = rows?.[0];
    if (!profile) throw new Error('PROFILE_NOT_CREATED');

    const metadata = user.user_metadata;
    const fullName = metadataText(metadata, 'full_name', 'name');
    const googleAvatar = metadataText(metadata, 'avatar_url', 'picture');
    const googleUserId = googleSubject(user);
    const updates: Record<string, string | boolean | null> = {
      email: userEmail,
      email_verified: true,
      auth_provider: 'google',
      google_user_id: googleUserId,
      oauth_avatar_url: googleAvatar,
      auth_provider_updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };
    if (!profile.full_name && fullName) updates.full_name = fullName;
    updates.reonboarding_required = false;

    await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }, session.access_token);
  } catch {
    return fail(jar, 'oauth_profile_error');
  }

  await setSession(session);
  const remembered = jar.get(GOOGLE_OAUTH_NEXT_COOKIE)?.value;
  clearOAuthCookies(jar);
  const destination = safeOAuthReturnTo(remembered);
  const response = NextResponse.redirect(new URL(destination, siteUrl()));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
