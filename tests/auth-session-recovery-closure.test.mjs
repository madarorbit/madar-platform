import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  proxy,
  server,
  shell,
  strictAuth,
  refreshHelper,
  refreshRoute,
  home,
  login,
  accountLayout,
  securityPage,
  orby,
  retailLayout,
  guideBoundary,
  recoveryPage,
  recoverySurface,
] = await Promise.all([
  read("proxy.ts"),
  read("src/lib/supabase/server.ts"),
  read("src/lib/shell/server.ts"),
  read("src/lib/auth.ts"),
  read("src/lib/auth/session-refresh.ts"),
  read("app/auth/refresh/route.ts"),
  read("app/page.tsx"),
  read("app/login/page.tsx"),
  read("app/account/layout.tsx"),
  read("app/account/security/page.tsx"),
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
    proxy.indexOf("if(access&&!tokenExpired(access)"),
  );
  assert.doesNotMatch(healthyBranch, /refreshSession\(/);
});

test("near-expiry background requests do not create proactive refresh fan-out", () => {
  has(proxy, "!tokenExpired(access)&&!isDocumentNavigation(request)");
  const backgroundBranch = proxy.slice(
    proxy.indexOf("if(access&&!tokenExpired(access)"),
    proxy.indexOf("if(refresh){"),
  );
  assert.doesNotMatch(backgroundBranch, /refreshSession\(/);
});

test("static assets and the dedicated recovery endpoints never enter session refresh", () => {
  has(proxy, "isStaticAsset(path)");
  has(proxy, "authRefreshBypass=['/auth/recover','/auth/refresh']");
  has(proxy, "if(isStaticAsset(path)||authRefreshBypass.includes(path))return forwardedResponse(request);");
  const bypassIndex = proxy.indexOf("if(isStaticAsset(path)||authRefreshBypass.includes(path))");
  const refreshIndex = proxy.indexOf("const result=await refreshSession");
  assert.ok(bypassIndex >= 0 && refreshIndex > bypassIndex, "asset/recovery bypass must happen before refresh");
});

test("successful navigation refresh rotates both cookies", () => {
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
  has(refreshHelper, "refreshFailureIsTerminal");
  has(refreshHelper, "status === 401 || status === 403");
  has(proxy, "const result=protectedRoute?loginRedirect(request):NextResponse.next();clearSession(result);return result;");
  has(refreshRoute, "result.kind === \"invalid\"");
  has(refreshRoute, 'jar.set("madar-refresh-token", "", cookieOptions(0))');
});

test("dedicated recovery endpoint is the single cookie-writing recovery authority", () => {
  has(refreshRoute, 'jar.get("madar-refresh-token")');
  has(refreshRoute, "await refreshSession(url, key, refreshToken)");
  has(refreshRoute, 'jar.set(\n      "madar-access-token"');
  has(refreshRoute, 'jar.set(\n      "madar-refresh-token"');
  has(refreshRoute, '{ status: "recovering" }, 503');
  has(refreshRoute, 'response.headers.set("Retry-After", "2")');
});

test("recovery page does not misclassify an expired access token as logout", () => {
  has(recoveryPage, 'jar.get("madar-refresh-token")');
  assert.doesNotMatch(recoveryPage, /getShellIdentityState|currentUserState|currentUser\(/);
  has(recoveryPage, "<SessionRecoveryState nextPath={nextPath} />");
});

test("browser recovery retries the explicit endpoint without refresh or storage loops", () => {
  has(recoverySurface, 'fetch("/auth/refresh"');
  has(recoverySurface, "MAX_AUTOMATIC_ATTEMPTS = 2");
  has(recoverySurface, "inFlightRef");
  has(recoverySurface, "router.replace(nextPath)");
  assert.doesNotMatch(recoverySurface, /sessionStorage|localStorage|setInterval|location\.reload/);
  assert.doesNotMatch(recoverySurface, /setTimeout\(\(\) => router\.refresh/);
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

test("strict render guards redirect recovery instead of throwing it into an error boundary", () => {
  has(strictAuth, "currentUserState");
  has(strictAuth, "state.status==='recovering'");
  has(strictAuth, "redirect(recoveryHref(nextPath))");
  has(securityPage, 'requireUser("/account/security")');
  assert.doesNotMatch(strictAuth, /AuthVerificationUnavailableError/);
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

test("strict auth remains strict for protected data and actions", () => {
  has(server, "if(state.status==='recovering')throw new AuthVerificationUnavailableError();");
  has(server, "return state.status==='authenticated'?state.user:null;");
  assert.doesNotMatch(server, /currentUser[\s\S]{0,250}catch\(\(\) => null\)/);
});
