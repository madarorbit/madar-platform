import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const startRoute = await readFile(new URL('../app/auth/google/route.ts', import.meta.url), 'utf8');
const callbackRoute = await readFile(new URL('../app/auth/google/callback/route.ts', import.meta.url), 'utf8');
const helper = await readFile(new URL('../src/lib/auth/google-oauth.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260805031000_google_oauth_profiles.sql', import.meta.url), 'utf8');

test('Google OAuth starts with official Supabase provider and PKCE S256', () => {
  assert.match(startRoute, /auth\/v1\/authorize/);
  assert.match(startRoute, /provider', 'google'/);
  assert.match(startRoute, /flow_type', 'pkce'/);
  assert.match(startRoute, /code_challenge_method', 's256'/);
});

test('OAuth callback validates state before exchanging the authorization code', () => {
  const stateCheck = callbackRoute.indexOf('stateMatches');
  const tokenExchange = callbackRoute.indexOf('grant_type=pkce');
  assert.ok(stateCheck >= 0);
  assert.ok(tokenExchange > stateCheck);
  assert.match(helper, /timingSafeEqual/);
});

test('OAuth return paths reject protocol-relative and authentication loop destinations', () => {
  assert.match(helper, /!value\.startsWith\('\/\/'\)/);
  assert.match(helper, /destination\.startsWith\('\/auth\/google'\)/);
});

test('Google OAuth stores identity metadata but no provider access tokens', () => {
  assert.match(migration, /google_user_id/);
  assert.match(migration, /oauth_avatar_url/);
  assert.doesNotMatch(migration, /provider_refresh_token|google_access_token|google_refresh_token/i);
  assert.doesNotMatch(callbackRoute, /provider_refresh_token|google_access_token|google_refresh_token/i);
});

test('new Google users are routed through the existing one-time onboarding guard', () => {
  assert.match(migration, /google_requires_onboarding/);
  assert.match(migration, /reonboarding_required/);
  assert.match(callbackRoute, /\/account\/setup/);
});
