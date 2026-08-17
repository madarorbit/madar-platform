import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Phase 2 preserves spotlight geometry while a new target resolves without showing mismatched step copy", () => {
  const host = readFileSync("components/guided-learning/GuidedLearningHost.tsx", "utf8");
  assert.match(host, /geometry:visual\.geometry,spotlight:visual\.spotlight/);
  assert.match(host, /movingBetweenTargets=targetTransitioning&&Boolean\(currentVisual\.spotlight\)/);
  assert.match(host, /جارٍ الانتقال إلى الخطوة التالية/);
});

test("authenticated shell declares fixed and mobile viewport occluders for guide geometry", () => {
  const shell = readFileSync("components/shell/MadarGlobalShell.tsx", "utf8");
  const orby = readFileSync("components/orby/OrbyShell.tsx", "utf8");
  assert.match(shell, /data-madar-guide-occluder="top"/);
  assert.match(shell, /data-madar-guide-occluder="bottom"/);
  assert.match(orby, /data-madar-guide-occluder="top"/);
});

test("production guided-learning boundaries stay idle and fixture-free until a guide is explicitly registered", () => {
  const boundary = readFileSync("components/guided-learning/GuidedLearningBoundary.tsx", "utf8");
  const host = readFileSync("components/guided-learning/GuidedLearningHost.tsx", "utf8");
  assert.match(boundary, /new GuideRegistry\(\)/);
  assert.equal(boundary.includes("phase2EngineFixture"), false);
  assert.match(host, /if\(!clientReady\|\|!active\|\|!guide\|\|!step\)return null/);
});
