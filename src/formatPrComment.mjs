export function formatPrComment(report, options = {}) {
  const certLink = options.certLink || "dist/skybridge-cert.json";
  const aboutLink = options.aboutLink || "https://projecttfb.com/heal-sentinel/";
  const lines = [];
  lines.push(`## Heal Sentinel - ${report.metrics.n_findings} finding(s), ${report.verdict}`);
  lines.push("");
  lines.push("> AI code review that refuses praise. Anchored to the TFB doctrine system.");
  lines.push(`> [Admission cert](${certLink}) | [About this tool](${aboutLink})`);
  lines.push("");

  if (!report.findings.length) {
    lines.push("No findings. The diff did not trip the current lexical or structural detectors.");
    return lines.join("\n");
  }

  for (const finding of report.findings) {
    lines.push(`### [${finding.severity.toUpperCase()}] [${finding.rule}] \`${finding.file}:${finding.line}\``);
    lines.push("");
    lines.push("```text");
    lines.push(finding.snippet);
    lines.push("```");
    lines.push("");
    lines.push(`**Doctrine:** ${finding.doctrine}`);
    lines.push("");
    lines.push(`**Riverbed:** ${finding.riverbed}`);
    lines.push("");
    lines.push(`**Heal:** ${finding.heal_shape}`);
    if (finding.named_fallback_accepted) {
      lines.push("");
      lines.push(`**Named fallback accepted:** ${finding.named_fallback_accepted}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("### Verdict");
  lines.push("");
  if (report.verdict === "NO_BYPASS") {
    lines.push("**NO_BYPASS** - surface the findings above and resubmit.");
  } else if (report.verdict === "BYPASS_ACCEPTED_WITH_NAMED_FALLBACK") {
    lines.push("**BYPASS_ACCEPTED_WITH_NAMED_FALLBACK** - every finding has an explicit fallback reason.");
  } else {
    lines.push("**NO_FINDINGS** - no current detector fired.");
  }
  lines.push("");
  lines.push("To accept a bypass with a named fallback contract, add a PR comment:");
  lines.push("");
  lines.push("```text");
  lines.push("heal-sentinel: bypass-accepted <finding-id-or-rule> reason: <one sentence>");
  lines.push("```");
  return lines.join("\n");
}
