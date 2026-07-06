import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyze } from "../src/analyze.mjs";

test("analyze returns structured findings for lexical and structural wounds", async () => {
  const diff = await readFile(new URL("../examples/sample.diff", import.meta.url), "utf8");
  const report = await analyze(diff, {
    includeRiverbed: false,
    commitMessage: "Add payload loader"
  });

  assert.equal(report.op, "heal_sentinel.analyze");
  assert.equal(report.verdict, "NO_BYPASS");
  assert.ok(report.findings.length >= 5);
  assert.ok(report.metrics.n_files_scanned >= 2);
  assert.ok(report.metrics.n_lexical_findings >= 2);
  assert.ok(report.metrics.n_structural_findings >= 2);
  assert.ok(report.doctrines_invoked.includes("D-EVERY-FAIL-SOFT-NAMES-ITS-FALLBACK-EXPLICITLY"));
  assert.deepEqual(report.errors, []);
});

test("severity floor filters medium findings", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const report = await analyze(diff, {
    includeRiverbed: false,
    severity_floor: "high"
  });

  assert.equal(report.verdict, "NO_FINDINGS");
  assert.equal(report.metrics.n_findings, 0);
});

test("hard-negative fixtures do not become praise-shaped false positives", async () => {
  for (const name of [
    "clean.diff",
    "hard-negative-refactor.diff",
    "adversarial-text.diff",
    "malformed.diff"
  ]) {
    const diff = await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8");
    const report = await analyze(diff, { includeRiverbed: false });

    assert.equal(report.verdict, "NO_FINDINGS", name);
    assert.equal(report.metrics.n_findings, 0, name);
    assert.deepEqual(report.errors, [], name);
  }
});

test("named fallback bypass changes verdict when all findings are accepted", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const report = await analyze(diff, {
    includeRiverbed: false,
    bypassComments: [
      "heal-sentinel: bypass-accepted Q1_SHOULD reason: comment is a quoted fixture exercising the detector path",
      "heal-sentinel: bypass-accepted Q1_SHOULD_AS_PREDICTION reason: same quoted fixture covers the structural detector path"
    ].join("\n")
  });

  assert.equal(report.verdict, "BYPASS_ACCEPTED_WITH_NAMED_FALLBACK");
  assert.equal(report.findings[0].named_fallback_accepted.includes("quoted fixture"), true);
});

test("riverbed provider can enrich findings without network", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const report = await analyze(diff, {
    riverbedProvider: async () => ({
      riverbed: "custom riverbed",
      heal_shape: "custom heal"
    })
  });

  assert.equal(report.metrics.n_riverbed_calls, report.findings.length);
  assert.equal(report.findings[0].riverbed, "custom riverbed");
  assert.equal(report.findings[0].heal_shape, "custom heal");
});

test("OpenRouter path chosen when OPENROUTER_API_KEY is present", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const seenUrls = [];
  const mockFetch = async (url, init) => {
    seenUrls.push(url);
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(init.headers.authorization, "Bearer test-or-key");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "deepseek/deepseek-v4-pro");
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              riverbed: "openrouter riverbed prose",
              heal_shape: "openrouter heal shape"
            })
          }
        }]
      })
    };
  };

  const report = await analyze(diff, {
    openrouterApiKey: "test-or-key",
    fetch: mockFetch
  });

  assert.equal(report.findings[0].riverbed, "openrouter riverbed prose");
  assert.equal(report.findings[0].heal_shape, "openrouter heal shape");
  assert.equal(report.fallback, null);
  assert.equal(seenUrls.length, report.findings.length);
});

test("Anthropic path chosen when only ANTHROPIC_API_KEY is present", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const seenUrls = [];
  const mockFetch = async (url, init) => {
    seenUrls.push(url);
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(init.headers["x-api-key"], "test-anthropic-key");
    return {
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify({ riverbed: "anthropic riverbed", heal_shape: "anthropic heal" }) }]
      })
    };
  };

  const report = await analyze(diff, {
    llmApiKey: "test-anthropic-key",
    fetch: mockFetch
  });

  assert.equal(report.findings[0].riverbed, "anthropic riverbed");
  assert.equal(seenUrls.length, report.findings.length);
});

test("OpenRouter beats Anthropic when both keys present (auto precedence)", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const mockFetch = async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ riverbed: "or wins", heal_shape: "or wins" }) } }]
      })
    };
  };

  const report = await analyze(diff, {
    openrouterApiKey: "or-key",
    llmApiKey: "anthropic-key",
    fetch: mockFetch
  });

  assert.equal(report.findings[0].riverbed, "or wins");
});

test("explicit llmProvider=anthropic forces Anthropic even with OpenRouter key set", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const mockFetch = async (url) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    return {
      ok: true,
      json: async () => ({ content: [{ text: JSON.stringify({ riverbed: "forced anthropic", heal_shape: "x" }) }] })
    };
  };

  const report = await analyze(diff, {
    llmProvider: "anthropic",
    openrouterApiKey: "or-key",
    llmApiKey: "anthropic-key",
    fetch: mockFetch
  });

  assert.equal(report.findings[0].riverbed, "forced anthropic");
});

test("no keys → catalog fallback, provider_used field is none", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const report = await analyze(diff, {
    fetch: async () => { throw new Error("should not be called"); }
  });

  assert.equal(report.fallback, "riverbed_llm_unavailable_catalog_fallback");
  assert.ok(report.findings.length > 0);
  assert.ok(report.findings[0].riverbed);
});

test("OpenRouter call failure names the fallback per doctrine", async () => {
  const diff = [
    "diff --git a/src/comment.ts b/src/comment.ts",
    "--- a/src/comment.ts",
    "+++ b/src/comment.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n");

  const mockFetch = async () => ({ ok: false, status: 429, json: async () => ({}) });

  const report = await analyze(diff, {
    openrouterApiKey: "or-key",
    fetch: mockFetch
  });

  assert.equal(report.fallback, "riverbed_openrouter_failed_catalog_fallback");
  assert.ok(report.errors.some((error) => error.name === "riverbed_openrouter_failed"));
});

test("live review findings become Sentinel rules", async () => {
  const diff = [
    "diff --git a/DEVELOPER_REPORT.md b/DEVELOPER_REPORT.md",
    "--- a/DEVELOPER_REPORT.md",
    "+++ b/DEVELOPER_REPORT.md",
    "@@ -79,0 +79,1 @@",
    "+- Heal Sentinel synthetic diff returned `NO_FINDINGS`.",
    "diff --git a/index.html b/index.html",
    "--- a/index.html",
    "+++ b/index.html",
    "@@ -628,0 +628,8 @@",
    "+const note = [",
    "+  gyro.ok ? \"gyro_bound\" : gyro.kind,",
    "+  audio.ok ? \"audio_started\" : audio.kind",
    "+].join(\" / \");",
    "+statusText.textContent = note;",
    "+status.setAttribute(\"aria-hidden\", \"true\");",
    "+if (delta <= 10) return err(\"pixel_liveness_absent\", detail);"
  ].join("\n");

  const report = await analyze(diff, { includeRiverbed: false });
  const rules = new Set(report.findings.map((finding) => finding.rule));

  assert.equal(report.verdict, "NO_BYPASS");
  assert.equal(rules.has("Q1_UNBACKED_CLAIM_IN_REPORT"), true);
  assert.equal(rules.has("Q2_PRODUCER_WITHOUT_VISIBLE_CONSUMER"), true);
  assert.equal(rules.has("Q3_MAGIC_THRESHOLD"), true);
  assert.equal(report.doctrines_invoked.includes("D-VERIFY-BIND-BEFORE-ANNOUNCING"), true);
  assert.equal(report.doctrines_invoked.includes("D-WATCHERS-WATCH-WATCHERS-AND-PROPOSALS-MUST-BE-ACTIONABLE"), true);
  assert.equal(report.doctrines_invoked.includes("D-INSTRUMENT-WHAT-EXISTS-NOT-WHAT-IS-IMAGINED"), true);
});
