import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { siteUrl, supabaseConfig } from '@/src/lib/env';
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  codeChallenge,
  oauthCookieOptions,
  randomBase64Url,
  safeOAuthReturnTo,
} from '@/src/lib/auth/google-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const destination = safeOAuthReturnTo(request.nextUrl.searchParams.get('next'));
  const state = randomBase64Url(32);
  const verifier = randomBase64Url(64);
  const callback = new URL('/auth/google/callback', siteUrl());
  callback.searchParams.set('state', state);

  const jar = await cookies();
  jar.set(GOOGLE_OAUTH_STATE_COOKIE, state, oauthCookieOptions());
  jar.set(GOOGLE_OAUTH_VERIFIER_COOKIE, verifier, oauthCookieOptions());
  jar.set(GOOGLE_OAUTH_NEXT_COOKIE, destination, oauthCookieOptions());

  const { url } = supabaseConfig();
  const authorize = new URL(`${url}/auth/v1/authorize`);
  authorize.searchParams.set('provider', 'google');
  authorize.searchParams.set('redirect_to', callback.toString());
  authorize.searchParams.set('flow_type', 'pkce');
  authorize.searchParams.set('code_challenge', codeChallenge(verifier));
  authorize.searchParams.set('code_challenge_method', 's256');

  const response = NextResponse.redirect(authorize);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
