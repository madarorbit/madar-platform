import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
const recoverySurface = await readFile(new URL("../components/auth/SessionRecoveryState.tsx", import.meta.url), "utf8");

test("expired restored-tab RSC requests cannot rotate refresh tokens", () => {
  assert.match(proxy, /function isRscRequest/);
  assert.match(proxy, /if\(refresh&&isRscRequest\(request\)\)return recoveryPendingResponse\(request\);/);
  const rscGuard = proxy.indexOf("if(refresh&&isRscRequest(request))");
  const refreshCall = proxy.indexOf("const result=await refreshSession");
  assert.ok(rscGuard >= 0 && refreshCall > rscGuard, "RSC recovery guard must run before refresh rotation");
});

test("restored-tab recovery has one in-flight refresh request and one completion navigation", () => {
  assert.match(recoverySurface, /inFlightRef/);
  assert.match(recoverySurface, /fetch\("\/auth\/refresh"/);
  assert.match(recoverySurface, /router\.replace\(nextPath\)/);
  assert.doesNotMatch(recoverySurface, /router\.refresh\(|sessionStorage|localStorage/);
});

test("refresh bypass is limited to known public assets instead of arbitrary file-like routes", () => {
  assert.match(proxy, /path\.startsWith\('\/brand\/'\)/);
  assert.match(proxy, /path\.startsWith\('\/assets\/'\)/);
  assert.match(proxy, /PUBLIC_ROOT_ASSET/);
  assert.match(proxy, /PUBLIC_SERVICE_ASSET/);
  assert.doesNotMatch(proxy, /path\.startsWith\('\/services\/'\)/);
  assert.doesNotMatch(proxy, /pdf\|zip|zip\|pdf/);
});
