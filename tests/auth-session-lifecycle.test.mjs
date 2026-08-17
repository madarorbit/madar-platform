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

const has = (source, value) => assert.ok(source.includes(value), `missing lifecycle contract: ${value}`);

test("protected unauthenticated requests still go to login and preserve the return path", () => {
  has(proxy, "sessionProtected");
  has(proxy, "target.searchParams.set('next',next)");
  has(proxy, "if(protectedRoute){const result=loginRedirect(request);clearSession(result);return result;}");
});

test("access-token expiry uses refresh-token recovery instead of being treated as logout", () => {
  has(proxy, "expiresSoon(access)");
  has(proxy, "grant_type=refresh_token");
  has(proxy, "result.kind==='refreshed'");
  has(proxy, "setSessionCookies(result,session)");
  has(authActions, "madar-refresh-token");
  has(authActions, "const SESSION_MAX_AGE = 60 * 60 * 24 * 365;");
});

test("temporary refresh network, rate-limit, and server failures preserve the session", () => {
  has(proxy, "kind:'unavailable'");
  has(proxy, "status!==400");
  has(proxy, "if(result.kind==='unavailable')return recoveryPendingResponse(request);");
  has(proxy, "x-madar-auth-recovery-pending");
  const unavailableBranch = "if(result.kind==='unavailable')return recoveryPendingResponse(request);";
  assert.doesNotMatch(unavailableBranch, /clearSession|loginRedirect/);
});

test("only terminal refresh-token invalidation destroys the persistent session", () => {
  has(proxy, "refreshFailureIsTerminal");
  has(proxy, "status===401||status===403");
  has(proxy, "refresh[_ ]?token");
  has(proxy, "invalid[_ ]?grant");
  const clearCalls = proxy.match(/clearSession\(result\)/g) || [];
  assert.equal(clearCalls.length, 2);
});

test("server auth has an explicit authenticated unauthenticated recovering state", () => {
  has(server, "export type AuthVerificationState");
  has(server, "status:'authenticated'");
  has(server, "status:'unauthenticated'");
  has(server, "status:'recovering'");
  has(server, "export async function currentUserState");
  has(server, "if(state.status==='recovering')throw new AuthVerificationUnavailableError();");
  assert.doesNotMatch(server, /currentUser\(accessToken\?[\s\S]*catch\{return null;\}/);
});

test("optional shell identity degrades a recovering render without erasing the third auth state", () => {
  has(shell, "export type ShellIdentityState");
  has(shell, "const state = await getShellIdentityState();");
  has(shell, "return state.status === \"authenticated\" ? state.identity : null;");
  has(shell, "if (state.status === \"recovering\") redirect(sessionRecoveryHref(nextPath));");
  assert.doesNotMatch(shell, /currentUser\(\)\.catch\(\(\) => null\)/);
});

test("authentication and Retail authorization remain separate", () => {
  has(retailContext, "const platformUser = await getUserContext();");
  has(retailContext, "if (!platformUser) redirect(\"/login?next=/account\");");
  has(retailContext, "redirect(\"/account\");");
  has(retailContext, "workspace_subscriptions");
});

test("admin authorization failure is not represented as logout", () => {
  has(sharedAuth, "redirect('/account?error=forbidden')");
});

test("authenticated users are not shown auth-only pages and OAuth keeps the original destination", () => {
  has(proxy, "const authOnly=");
  has(proxy, "authenticatedRedirect");
  has(oauthCallback, "GOOGLE_OAUTH_NEXT_COOKIE");
  has(oauthCallback, "safeOAuthReturnTo(remembered)");
  has(oauthCallback, "await setSession(session)");
});

test("logout remains explicit and clears both account-level auth cookies", () => {
  has(authActions, "export async function logout()");
  has(authActions, "madar-access-token");
  has(authActions, "madar-refresh-token");
  has(authActions, "maxAge: 0");
});
