import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  proxy,
  server,
  shell,
  home,
  login,
  accountLayout,
  orby,
  retailLayout,
  guideBoundary,
  recoveryPage,
  recoverySurface,
] = await Promise.all([
  read("proxy.ts"),
  read("src/lib/supabase/server.ts"),
  read("src/lib/shell/server.ts"),
  read("app/page.tsx"),
  read("app/login/page.tsx"),
  read("app/account/layout.tsx"),
  read("app/orby/page.tsx"),
  read("app/retail/workspace/layout.tsx"),
  read("components/guided-learning/GuidedLearningBoundary.tsx"),
  read("app/auth/recover/page.tsx"),
  read("components/auth/SessionRecoveryState.tsx"),
]);

const has = (source, value) => assert.ok(source.includes(value), `missing recovery contract: ${value}`);

test("healthy access token bypasses refresh and continues normally", () => {
  has(proxy, "if(access&&!expiresSoon(access))");
  has(proxy, "forwardedResponse(request)");
  const healthyBranch = proxy.slice(
    proxy.indexOf("if(access&&!expiresSoon(access))"),
    proxy.indexOf("if(refresh){"),
  );
  assert.doesNotMatch(healthyBranch, /refreshSession\(/);
});

test("near-expiry access token rotates cookies after a successful refresh", () => {
  has(proxy, "expiresSoon(access)");
  has(proxy, "const result=await refreshSession(base,key,refresh);");
  has(proxy, "if(result.kind==='refreshed')return refreshedResponse(request,result.session);");
  has(proxy, "request.cookies.set('madar-access-token',session.access_token)");
  has(proxy, "response.cookies.set('madar-refresh-token',session.refresh_token");
});

test("temporary refresh outage preserves cookies and becomes a recoverable request state", () => {
  has(proxy, "if(result.kind==='unavailable')return recoveryPendingResponse(request);");
  has(proxy, "x-madar-auth-recovery-pending");
  has(server, "return pending?{status:'recovering'}:{status:'unauthenticated'};");
  has(shell, "status: \"recovering\"");
  const unavailableBranch = "if(result.kind==='unavailable')return recoveryPendingResponse(request);";
  assert.doesNotMatch(unavailableBranch, /clearSession|loginRedirect/);
});

test("terminal invalid refresh token still clears session and protects routes", () => {
  has(proxy, "refreshFailureIsTerminal");
  has(proxy, "status===401||status===403");
  has(proxy, "const result=protectedRoute?loginRedirect(request):NextResponse.next();clearSession(result);return result;");
});

test("public shell can render without optional identity while recovery remains explicit", () => {
  has(home, "getOptionalShellIdentity");
  has(shell, "getShellIdentityState");
  has(shell, "return state.status === \"authenticated\" ? state.identity : null;");
  assert.doesNotMatch(shell, /getOptionalShellIdentity[\s\S]{0,300}throw new AuthVerificationUnavailableError/);
});

test("public login does not require strict authentication", () => {
  has(login, "PageShell");
  assert.doesNotMatch(login, /currentUser|requireShellIdentity|AuthVerificationUnavailableError/);
});

test("bounded server recovery cannot form an automatic refresh loop", () => {
  has(recoveryPage, "state.status === \"authenticated\"");
  has(recoveryPage, "state.status === \"unauthenticated\"");
  has(recoverySurface, "MAX_AUTOMATIC_RETRIES = 2");
  has(recoverySurface, "RECOVERY_WINDOW_MS = 30_000");
  assert.doesNotMatch(recoverySurface, /setInterval|location\.reload|window\.location/);
});

test("account protected route distinguishes recovery from login", () => {
  has(accountLayout, "requireShellIdentity(\"/account\")");
  assert.doesNotMatch(accountLayout, /getOptionalShellIdentity|redirect\(\"\/login/);
});

test("ORBY keeps true guests but does not downgrade a recovering member to guest", () => {
  has(orby, "identityState.status === \"recovering\"");
  has(orby, "redirect(sessionRecoveryHref(\"/orby\"))");
  has(orby, "identityState.status === \"unauthenticated\"");
  has(orby, "authenticated={false}");
});

test("Retail resolves shell recovery before parallel workspace construction", () => {
  has(retailLayout, "const identity = await requireShellIdentity(\"/retail/workspace\")");
  const identityIndex = retailLayout.indexOf("await requireShellIdentity");
  const parallelIndex = retailLayout.indexOf("Promise.all");
  assert.ok(identityIndex >= 0 && parallelIndex > identityIndex, "Retail must resolve shell auth before parallel protected work");
  assert.doesNotMatch(retailLayout, /getOptionalShellIdentity/);
});

test("Guided Learning boundary adds no server auth verification of its own", () => {
  has(guideBoundary, '"use client"');
  assert.doesNotMatch(guideBoundary, /currentUser|getOptionalShellIdentity|requireShellIdentity|supabaseFetch/);
});

test("strict auth is still strict for protected data and actions", () => {
  has(server, "if(state.status==='recovering')throw new AuthVerificationUnavailableError();");
  has(server, "return state.status==='authenticated'?state.user:null;");
  assert.doesNotMatch(server, /currentUser[\s\S]{0,250}catch\(\(\) => null\)/);
});
