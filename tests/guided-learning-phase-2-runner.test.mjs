import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Guided Learning Phase 2 TypeScript engine suite passes", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", "tests/guided-learning-phase-2.test.ts"],
    { cwd: process.cwd(), encoding: "utf8", env: process.env },
  );
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join("\n") || "Guided Learning Phase 2 tests failed without output.");
});
