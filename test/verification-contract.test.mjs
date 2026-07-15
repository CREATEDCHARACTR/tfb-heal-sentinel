import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("verify is a read-only test selector", () => {
  assert.equal(packageJson.scripts.verify, "npm test");
  assert.doesNotMatch(packageJson.scripts.verify, /\b(?:build|admit|release)\b/);
});

test("release verification retains the build-bearing lane", () => {
  assert.equal(packageJson.scripts["verify:release"], "npm test && npm run build");
  assert.equal(
    packageJson.scripts.prepublishOnly,
    "npm run test && npm run build && npm run admit",
  );
});
