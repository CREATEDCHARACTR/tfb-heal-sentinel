import { parseUnifiedDiff, addedLines, changedFileCount } from "./diffParser.mjs";
import { loadDoctrineCatalog, severityRank, normalizeSeverity } from "./doctrines.mjs";
import { scanLexical } from "./lexical.mjs";
import { scanStructural } from "./structural.mjs";
import { applyBypasses } from "./bypass.mjs";
import { enrichRiverbeds } from "./riverbed.mjs";

export async function analyze(diff, options = {}) {
  const started = now();
  const actions = [];
  const skips = [];
  const errors = [];
  let fallback = null;

  const catalog = await loadDoctrineCatalog(options);
  actions.push(`loaded_${catalog.length}_doctrine(s)`);

  const files = parseUnifiedDiff(diff);
  const lines = addedLines(files);
  actions.push(`parsed_${files.length}_file_diff(s)`);

  if (!String(diff || "").trim()) {
    skips.push({ reason: "empty_diff", file: "<input>" });
  }

  const lexical = scanLexical(lines, catalog);
  const structural = scanStructural(files, catalog, options);
  actions.push(`lexical_findings_${lexical.length}`);
  actions.push(`structural_findings_${structural.length}`);

  const byId = new Map();
  for (const finding of [...lexical, ...structural]) {
    byId.set(finding.id, finding);
  }

  const severityFloor = normalizeSeverity(options.severity_floor || options.severityFloor || "medium");
  let findings = Array.from(byId.values())
    .filter((finding) => severityRank(finding.severity) >= severityRank(severityFloor))
    .sort((a, b) => {
      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      if (severityDelta) return severityDelta;
      const fileDelta = String(a.file).localeCompare(String(b.file));
      if (fileDelta) return fileDelta;
      return (a.line || 0) - (b.line || 0);
    });

  findings = applyBypasses(findings, options.bypassComments || "");
  const riverbed = await enrichRiverbeds(findings, catalog, options);
  findings = riverbed.findings;
  actions.push(...riverbed.actions);
  errors.push(...riverbed.errors);
  fallback = riverbed.fallback || fallback;

  const unresolved = findings.filter((finding) => !finding.named_fallback_accepted);
  const verdict = findings.length === 0
    ? "NO_FINDINGS"
    : unresolved.length === 0
      ? "BYPASS_ACCEPTED_WITH_NAMED_FALLBACK"
      : "NO_BYPASS";

  const doctrines = Array.from(new Set(findings.map((finding) => finding.doctrine))).sort();
  const bySeverity = { critical: 0, high: 0, medium: 0 };
  for (const finding of findings) bySeverity[finding.severity] += 1;

  return {
    op: "heal_sentinel.analyze",
    ok: verdict !== "NO_BYPASS",
    verdict,
    findings,
    doctrines_invoked: doctrines,
    metrics: {
      n_files_scanned: changedFileCount(files),
      n_added_lines_scanned: lines.length,
      n_findings: findings.length,
      n_lexical_findings: findings.filter((finding) => finding.layer === "lexical").length,
      n_structural_findings: findings.filter((finding) => finding.layer === "ast").length,
      n_riverbed_calls: riverbed.calls,
      by_severity: bySeverity,
      time_to_verdict_ms: Math.max(0, Math.round(now() - started)),
      llm_tokens_used: riverbed.tokens
    },
    actions,
    skips,
    errors,
    fallback
  };
}

function now() {
  if (typeof performance !== "undefined" && performance.now) return performance.now();
  return Date.now();
}

export default analyze;
