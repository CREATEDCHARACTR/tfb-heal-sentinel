import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/analyze.mjs";
import { formatPrComment } from "../src/formatPrComment.mjs";

test("formatPrComment renders the consumer-facing report", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");
  const report = await analyze(diff, { includeRiverbed: false });
  const markdown = formatPrComment(report, {
    certLink: "https://example.test/cert.json",
    aboutLink: "https://example.test/heal-sentinel"
  });

  assert.match(markdown, /Heal Sentinel/);
  assert.match(markdown, /NO_BYPASS/);
  assert.match(markdown, /D-VERIFY-BIND-BEFORE-ANNOUNCING|D-HEAL-NOT-FIX/);
  assert.match(markdown, /bypass-accepted/);
});
