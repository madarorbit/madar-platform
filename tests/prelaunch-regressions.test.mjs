import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Store Engine uses valid PostgREST equality operators', async () => {
  const source = await read('src/lib/store/server.ts');
  assert.match(source, /status:\s*'eq\.published'/);
  assert.match(source, /visibility:\s*'eq\.visible'/);
  assert.match(source, /is_active:\s*'eq\.true'/);
  assert.match(source, /show_in_store:\s*'eq\.true'/);
  assert.doesNotMatch(source, /status:\s*'published'/);
  assert.doesNotMatch(source, /visibility:\s*'visible'/);
});

test('Store category filters use inner embedded relations', async () => {
  const source = await read('src/lib/store/server.ts');
  assert.match(source, /categories!inner\(/);
  assert.match(source, /subcategories!inner\(/);
});

test('refreshed session is propagated to the same request and persisted', async () => {
  const source = await read('proxy.ts');
  assert.match(source, /request\.cookies\.set\('madar-access-token'/);
  assert.match(source, /request\.cookies\.set\('madar-refresh-token'/);
  assert.match(source, /NextResponse\.next\(\{request:\{headers:new Headers\(request\.headers\)\}\}\)/);
  assert.match(source, /Cache-Control','private, no-store'/);
  assert.match(source, /SESSION_MAX_AGE=60\*60\*24\*365/);
});

test('authenticated navigation depends on the verified auth user, not a profile row', async () => {
  const [navbar,home,server]=await Promise.all([read('components/layout/Navbar.tsx'),read('app/page.tsx'),read('src/lib/supabase/server.ts')]);
  assert.match(navbar,/const user=await currentUser\(\)/);
  assert.match(navbar,/authenticated=\{Boolean\(user\)\}/);
  assert.match(navbar,/profileForUser\(user\.id\)/);
  assert.match(home,/Boolean\(await currentUser\(\)/);
  assert.doesNotMatch(home,/Boolean\(await currentProfile\(\)/);
  assert.match(server,/export async function profileForUser/);
});

test('prelaunch migration removes unsafe public admin resolution and frontend grants', async () => {
  const source = await read('supabase/migrations/20260726181429_prelaunch_rls_and_grant_stabilization.sql');
  assert.match(source, /private\.is_admin\(\)/);
  assert.match(source, /revoke truncate, references, trigger/i);
  assert.match(source, /notify pgrst, 'reload schema'/);
});

test('workspace subscriptions remain tenant scoped while founders retain oversight', async () => {
  const source = await read('supabase/migrations/20260726185000_workspace_rls_tenant_isolation_fix.sql');
  assert.match(source, /private\.is_admin\(\) or private\.is_organization_member\(organization_id\)/);
  assert.doesNotMatch(source, /m\.organization_id\s*=\s*m\.organization_id/);
  assert.match(source, /organization member read/);
  assert.match(source, /organization member list/);
});

test('expected database domain errors are translated without polluting runtime error logs', async () => {
  const source = await read('src/lib/supabase/server.ts');
  assert.match(source, /Member already exists/);
  assert.match(source, /payload\?\.code!==\s*'P0001'/);
  assert.match(source, /status===401/);
  assert.match(source, /status===422/);
});

test('health endpoint reports the approved stable v1 technical baseline', async () => {
  const source = await read('app/api/health/route.ts');
  assert.match(source, /const VERSION='1\.0\.0'/);
  assert.match(source, /const RELEASE_CHANNEL='stable'/);
  assert.match(source, /const RELEASED_AT='2026-07-26'/);
  assert.doesNotMatch(source, /beta-1\.0\.0/);
});
