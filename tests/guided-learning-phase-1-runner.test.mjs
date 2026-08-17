import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

/**
 * Keep MADAR's existing node:test command unchanged. Only the Guided Learning
 * contract suite needs the already-installed tsx loader because it exercises
 * TypeScript source directly.
 */
test("Guided Learning Phase 1 TypeScript contract suite passes", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", "tests/guided-learning-phase-1.test.ts"],
    { cwd: process.cwd(), encoding: "utf8", env: process.env },
  );

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n") || "Guided Learning tests failed without output.",
  );
});
