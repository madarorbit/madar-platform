import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../src/lib/supabase/server.ts", import.meta.url), "utf8");
const sharedAuth = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
const authActions = await readFile(new URL("../app/actions/auth.ts", import.meta.url), "utf8");
const oauthCallback = await readFile(new URL("../app/auth/google/callback/route.ts", import.meta.url), "utf8");
const shell = await readFile(new URL("../src/lib/shell/server.ts", import.meta.url), "utf8");
const retailContext = await readFile(new URL("../src/lib/retail/server/auth/context.ts", import.meta.url), "utf8");

test("protected unauthenticated requests still go to login and preserve the return path", () => {
  assert.match(proxy, /const sessionProtected=/);
  assert.match(proxy, /target\.searchParams\.set\('next',next\)/);
  assert.match(proxy, /if\(protectedRoute\)\{const result=loginRedirect\(request\);clearSession\(result\);return result;\}/);
});

test("access-token expiry uses refresh-token recovery instead of being treated as logout", () => {
  assert.match(proxy, /expiresSoon\(access\)/);
  assert.match(proxy, /grant_type=refresh_token/);
  assert.match(proxy, /result\.kind==='refreshed'/);
  assert.match(proxy, /setSessionCookies\(result,session\)/);
  assert.match(authActions, /madar-refresh-token/);
  assert.match(authActions, /SESSION_MAX_AGE = 60 \* 60 \* 24 \* 365/);
});

test("temporary refresh network, rate-limit, and server failures preserve the session", () => {
  assert.match(proxy, /catch\{return\{kind:'unavailable'\};\}/);
  assert.match(proxy, /status!==400/);
  const unavailableBranch = proxy.match(/if\(result\.kind==='unavailable'\)return recoveryPendingResponse\(request\);/)?.[0] || "";
  assert.ok(unavailableBranch);
  assert.doesNotMatch(unavailableBranch, /clearSession|loginRedirect/);
  assert.match(proxy, /x-madar-auth-recovery-pending/);
});

test("only terminal refresh-token invalidation destroys the persistent session", () => {
  assert.match(proxy, /refreshFailureIsTerminal/);
  assert.match(proxy, /status===401\|\|status===403/);
  assert.ok(proxy.includes("refresh[_ ]?token"));
  assert.ok(proxy.includes("invalid[_ ]?grant"));
  const clearCalls = proxy.match(/clearSession\(result\)/g) || [];
  assert.equal(clearCalls.length, 2);
});

test("server auth distinguishes unauthenticated from verification unavailable", () => {
  assert.match(server, /class AuthVerificationUnavailableError/);
  assert.match(server, /x-madar-auth-recovery-pending/);
  assert.match(server, /error instanceof SupabaseRequestError&&\(error\.status===401\|\|error\.status===403\)\)return null/);
  assert.match(server, /throw error/);
  assert.doesNotMatch(server, /currentUser[\s\S]*catch\{return null;\}/);
});

test("shell identity does not downgrade a temporary auth failure to guest", () => {
  assert.match(shell, /const user = await currentUser\(\);/);
  assert.doesNotMatch(shell, /currentUser\(\)\.catch\(\(\) => null\)/);
});

test("authentication and Retail authorization remain separate", () => {
  assert.match(retailContext, /const platformUser = await getUserContext\(\)/);
  assert.match(retailContext, /if \(!platformUser\) redirect\("\/login\?next=\/account"\)/);
  assert.match(retailContext, /redirect\("\/account"\)/);
  assert.match(retailContext, /workspace_subscriptions/);
});

test("admin authorization failure is not represented as logout", () => {
  assert.match(sharedAuth, /if\(profile\.status!=='active'\|\|!\['ADMIN','SUPER_ADMIN'\]\.includes\(profile\.role\)\) redirect\('\/account\?error=forbidden'\)/);
});

test("authenticated users are not shown auth-only pages and OAuth keeps the original destination", () => {
  assert.match(proxy, /const authOnly=/);
  assert.match(proxy, /authenticatedRedirect/);
  assert.match(oauthCallback, /GOOGLE_OAUTH_NEXT_COOKIE/);
  assert.match(oauthCallback, /safeOAuthReturnTo\(remembered\)/);
  assert.match(oauthCallback, /await setSession\(session\)/);
});

test("logout remains explicit and clears both account-level auth cookies", () => {
  assert.match(authActions, /export async function logout\(\)/);
  assert.match(authActions, /madar-access-token/);
  assert.match(authActions, /madar-refresh-token/);
  assert.match(authActions, /maxAge: 0/);
});
