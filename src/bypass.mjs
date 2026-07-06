export function parseBypassComments(input) {
  const comments = String(input || "");
  const accepted = new Map();
  const re = /^heal-sentinel:\s*bypass-accepted\s+(\S+)\s+reason:\s*(.{12,})$/gim;
  let match;
  while ((match = re.exec(comments)) !== null) {
    accepted.set(match[1].trim(), match[2].trim());
  }
  return accepted;
}

export function applyBypasses(findings, bypassComments) {
  const accepted = bypassComments instanceof Map
    ? bypassComments
    : parseBypassComments(bypassComments);
  if (!accepted.size) return findings;
  return findings.map((finding) => {
    const reason = accepted.get(finding.id) || accepted.get(finding.rule);
    if (!reason) return finding;
    return {
      ...finding,
      named_fallback_accepted: reason
    };
  });
}
