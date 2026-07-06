import { doctrineById, normalizeSeverity } from "./doctrines.mjs";
import { findingId } from "./hash.mjs";

export function scanLexical(addedLines, catalog) {
  const findings = [];
  const patternCache = new Map();

  for (const line of addedLines) {
    for (const doctrine of catalog) {
      for (const trigger of doctrine.lexical_triggers) {
        const key = `${trigger.rule}:${trigger.pattern}`;
        let pattern = patternCache.get(key);
        if (!pattern) {
          pattern = new RegExp(trigger.pattern, "i");
          patternCache.set(key, pattern);
        }
        const match = pattern.exec(line.text);
        if (!match) continue;
        if (isQuotedPayloadMention(line.text, match.index, match[0])) continue;
        findings.push(makeFinding({
          rule: trigger.rule,
          layer: "lexical",
          doctrine: doctrine.id,
          severity: trigger.severity || doctrine.severity_default,
          file: line.file,
          line: line.line,
          snippet: `+ ${line.text}`,
          riverbed: doctrine.example_riverbed,
          heal_shape: trigger.motive || doctrine.tagline,
          meta: {
            category: trigger.category || "lexical",
            evidence: match[0]
          }
        }, catalog));
      }
    }
  }

  return findings;
}

function isQuotedPayloadMention(text, index, evidence) {
  const before = text.slice(0, index);
  const after = text.slice(index + evidence.length);
  const quoted = (
    before.lastIndexOf("\"") > before.lastIndexOf("\n") && after.includes("\"")
  ) || (
    before.lastIndexOf("'") > before.lastIndexOf("\n") && after.includes("'")
  ) || (
    before.lastIndexOf("`") > before.lastIndexOf("\n") && after.includes("`")
  );
  if (!quoted) return false;
  return /\b(fixture|payload|quoted|reviewed text|text says|literal|example)\b/i.test(text);
}

export function makeFinding(input, catalog) {
  const doctrine = doctrineById(catalog, input.doctrine);
  const severity = normalizeSeverity(input.severity || doctrine.severity_default);
  const snippet = String(input.snippet ?? "");
  const id = findingId(input.rule, input.file, input.line, snippet);
  return {
    id,
    rule: input.rule,
    layer: input.layer,
    doctrine: doctrine.id,
    severity,
    file: input.file,
    line: input.line || 1,
    snippet,
    riverbed: input.riverbed || doctrine.example_riverbed,
    heal_shape: input.heal_shape || doctrine.tagline,
    named_fallback_accepted: undefined,
    meta: input.meta || {}
  };
}
