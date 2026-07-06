#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { analyze } from "../src/analyze.mjs";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const repo = dirname(root);
const requirePublicReady = process.argv.includes("--require-public-ready");

const result = {
  op: "heal_sentinel.release_gate",
  ok: false,
  decision: "BLOCKED",
  actions: [],
  skips: [],
  errors: [],
  warnings: [],
  metrics: {},
  next: []
};

await checkSyntax();
await checkExamples();
await checkClaimLock();
await checkHeaders();
await checkRouteString();
await checkSkybridgeReceipt();
await checkBrowserProofSurface();
await checkWatcherReceipt();

const claimLock = await readJson(join(root, "release/claim-lock.json"));
const claims = Array.isArray(claimLock?.claims) ? claimLock.claims : [];
const publicReady = claims.length > 0 && claims.every((claim) => claim.status === "green");

result.metrics.public_ready = publicReady;
result.metrics.claim_count = claims.length;
result.ok = result.errors.length === 0 && (!requirePublicReady || publicReady);
result.decision = result.ok
  ? publicReady ? "PUBLIC_READY" : "HOLD_WITH_NAMED_GAPS"
  : "BLOCKED";
result.next = result.ok
  ? publicReady
    ? ["Public-ready receipts are green; confirm CEO publish approval before release action."]
    : ["Keep public-ready wording disabled until all claim-lock entries are green."]
  : ["Heal release-gate errors, then rerun npm run release:gate."];

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

async function checkSyntax() {
  const files = await listFiles(root, (path) => path.endsWith(".mjs"));
  let checked = 0;
  for (const file of files) {
    const proc = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    checked += 1;
    if (proc.status !== 0) {
      result.errors.push({
        name: "node_check_failed",
        file: relative(root, file),
        stderr: proc.stderr
      });
    }
  }
  result.actions.push("node_syntax_checked_after_build_surface_stable");
  result.metrics.node_check_files = checked;
}

async function checkExamples() {
  const cases = [
    { file: "examples/sample.diff", expected: "NO_BYPASS" },
    { file: "examples/clean.diff", expected: "NO_FINDINGS" },
    { file: "examples/hard-negative-refactor.diff", expected: "NO_FINDINGS" },
    { file: "examples/adversarial-text.diff", expected: "NO_FINDINGS" },
    { file: "examples/malformed.diff", expected: "NO_FINDINGS" }
  ];
  for (const fixture of cases) {
    const diff = await readFile(join(root, fixture.file), "utf8");
    const report = await analyze(diff, { includeRiverbed: false });
    if (report.verdict !== fixture.expected) {
      result.errors.push({
        name: "fixture_verdict_mismatch",
        file: fixture.file,
        expected: fixture.expected,
        actual: report.verdict,
        findings: report.findings.map((finding) => finding.rule)
      });
    }
  }
  result.actions.push("drawbridge_hard_negative_fixtures_checked");
  result.metrics.fixture_count = cases.length;
}

async function checkClaimLock() {
  const lock = await readJson(join(root, "release/claim-lock.json"));
  if (lock?.schema_version !== "heal_sentinel.release_claim_lock.v1") {
    result.errors.push({ name: "claim_lock_schema_invalid" });
    return;
  }
  const claims = Array.isArray(lock.claims) ? lock.claims : [];
  const ids = new Set(claims.map((claim) => claim.id));
  for (const id of [
    "local_build_exists",
    "drawbridge_false_positive_restraint",
    "skybridge_admitted",
    "security_header_contract",
    "browser_result_proof",
    "route_string_contract",
    "watcher_liveness",
    "telescope_claim_boundary",
    "public_release_approval"
  ]) {
    if (!ids.has(id)) result.errors.push({ name: "claim_missing", id });
  }
  for (const claim of claims) {
    if (!["green", "yellow", "red", "hold"].includes(claim.status)) {
      result.errors.push({ name: "claim_status_invalid", id: claim.id, status: claim.status });
    }
    if (claim.status !== "green" && !Array.isArray(claim.missing_receipts)) {
      result.errors.push({ name: "claim_gap_not_named", id: claim.id });
    }
    if (!claim.public_wording_allowed) {
      result.errors.push({ name: "claim_public_wording_missing", id: claim.id });
    }
  }
  result.actions.push("telescope_claim_lock_checked");
}

async function checkHeaders() {
  const firebase = await readJson(join(repo, "firebase/firebase.json"));
  const blocks = firebase?.hosting?.headers || [];
  const block = blocks.find((entry) => entry.source === "/heal-sentinel/**");
  if (!block) {
    result.errors.push({ name: "heal_sentinel_header_block_missing" });
    return;
  }
  const headers = Object.fromEntries(block.headers.map((header) => [header.key.toLowerCase(), header.value]));
  for (const key of [
    "x-content-type-options",
    "referrer-policy",
    "content-security-policy",
    "permissions-policy",
    "strict-transport-security"
  ]) {
    if (!headers[key]) result.errors.push({ name: "security_header_missing", key });
  }
  const csp = headers["content-security-policy"] || "";
  if (csp.includes("'unsafe-inline'") || csp.includes("'unsafe-eval'")) {
    result.errors.push({ name: "heal_sentinel_csp_contains_unsafe_directive" });
  }
  if (!/script-src\s+'self'/.test(csp) || !/style-src\s+'self'/.test(csp)) {
    result.errors.push({ name: "heal_sentinel_csp_static_asset_boundary_missing" });
  }
  result.actions.push("app_specific_security_header_contract_checked");
}

async function checkRouteString() {
  const string = await readJson(join(root, "ops/release-string.json"));
  if (string?.schema_version !== "heal_sentinel.release_string.v1") {
    result.errors.push({ name: "release_string_schema_invalid" });
    return;
  }
  if (string.route !== "/heal-sentinel/") {
    result.errors.push({ name: "release_string_route_mismatch", route: string.route });
  }
  if (!Array.isArray(string.six_link_string) || string.six_link_string.length !== 6) {
    result.errors.push({ name: "release_string_not_six_links" });
  }
  if (string.cron_required || string.tunnel_required) {
    result.errors.push({ name: "release_string_adds_unneeded_recurring_surface" });
  }
  result.actions.push("dr_cron_route_string_checked");
}

async function checkSkybridgeReceipt() {
  const receipt = await readJson(join(root, "release/skybridge-admission.receipt.json"));
  if (!receipt) {
    result.errors.push({ name: "skybridge_admission_receipt_missing" });
    return;
  }
  if (receipt.verdict !== "ADMIT" || receipt.ok !== true) {
    result.errors.push({ name: "skybridge_admission_not_green", verdict: receipt.verdict });
  }
  result.actions.push("skybridge_admission_receipt_checked");
}

async function checkBrowserProofSurface() {
  const html = await readFile(join(repo, "firebase/public/heal-sentinel/index.html"), "utf8");
  const app = await readFile(join(repo, "firebase/public/heal-sentinel/app.mjs"), "utf8");
  for (const needle of [
    "aria-label=\"Result verdict\"",
    "aria-label=\"Analysis report JSON\""
  ]) {
    if (!html.includes(needle)) result.errors.push({ name: "browser_proof_surface_missing", needle });
  }
  if (!app.includes("selectReportJsonFallback")) {
    result.errors.push({ name: "clipboard_named_fallback_missing" });
  }
  result.actions.push("tfbthumb_result_proof_surface_checked");
}

async function checkWatcherReceipt() {
  const receipt = await readJson(join(root, "release/watcher-liveness.receipt.json"));
  if (!receipt) {
    result.errors.push({ name: "watcher_liveness_receipt_missing" });
    return;
  }
  if (receipt.ok !== true || receipt.metrics?.stale !== 0 || receipt.next !== "all_watchers_alive") {
    result.errors.push({
      name: "watcher_liveness_not_green",
      ok: receipt.ok,
      stale: receipt.metrics?.stale,
      next: receipt.next
    });
  }
  result.actions.push("watcher_liveness_receipt_checked");
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    result.errors.push({ name: "json_read_failed", file: relative(root, path), message: error.message });
    return null;
  }
}

async function listFiles(dir, predicate) {
  const entries = await readdir(dir);
  const out = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) {
      out.push(...await listFiles(path, predicate));
    } else if (predicate(path)) {
      out.push(path);
    }
  }
  return out;
}
