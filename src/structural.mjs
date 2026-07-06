import { makeFinding } from "./lexical.mjs";

const PREDICTION_RE = /\bshould\s+(still\s+)?(work|be\s+(fine|safe|enough|ok|okay)|handle|process|catch|prevent|cover|allow|pass|produce|return|behave|render|emit|not\s+(regress|break|fail|crash|leak|fire|trigger))/i;
const CONSTRAINT_WORDS = /\b(because|constraint|trade-?off|instead of|rather than|limit|bound|avoid|afford|latency|risk|cost|privacy|security|public claim|access)\b/i;
const LOAD_BEARING_PATHS = /^(scripts\/|firebase\/public\/|agents\/|tfb_schedule\.json|\.cloudflared\/|heal-sentinel\/)/;

export function scanStructural(files, catalog, options = {}) {
  const findings = [];
  findings.push(...scanExceptPatterns(files, catalog));
  findings.push(...scanShouldPredictions(files, catalog));
  findings.push(...scanConjoinedTry(files, catalog));
  findings.push(...scanCrossBoundary(files, catalog));
  findings.push(...scanUnnamedConstraint(files, catalog, options));
  findings.push(...scanUnbackedReportClaims(files, catalog));
  findings.push(...scanProducerWithoutVisibleConsumer(files, catalog));
  findings.push(...scanMagicThreshold(files, catalog));
  return findings;
}

function scanExceptPatterns(files, catalog) {
  const findings = [];
  for (const file of files.filter((f) => f.file.endsWith(".py"))) {
    const added = file.added;
    for (let i = 0; i < added.length; i += 1) {
      const line = added[i];
      if (!/^\s*except\b.*:\s*$/.test(line.text)) continue;
      const next = nextMeaningfulAdded(added, i + 1);
      if (!next) continue;
      if (/^\s*pass\s*$/.test(next.text)) {
        findings.push(makeFinding({
          rule: "Q1_BARE_EXCEPT_PASS",
          layer: "ast",
          doctrine: "D-EVERY-FAIL-SOFT-NAMES-ITS-FALLBACK-EXPLICITLY",
          severity: "critical",
          file: line.file,
          line: line.line,
          snippet: `+ ${line.text}\n+ ${next.text}`,
          riverbed: "The exception branch erases the failure and gives the caller no path information. The wound is not the pass line alone; it is a boundary that refuses to narrate what happened.",
          heal_shape: "Catch the owned exception, split unrelated operations before the catch, and return a structured Result naming primary path, fallback path, and error detail."
        }, catalog));
      }
      if (/^\s*return\s+(None|True|False|\[\]|\{\}|["'][^"']*["']|\{.*status.*\})?\s*$/.test(next.text)) {
        findings.push(makeFinding({
          rule: "Q1_SYNTHETIC_SUCCESS_FROM_EXCEPT",
          layer: "ast",
          doctrine: "D-EVERY-FAIL-SOFT-NAMES-ITS-FALLBACK-EXPLICITLY",
          severity: "high",
          file: line.file,
          line: line.line,
          snippet: `+ ${line.text}\n+ ${next.text}`,
          riverbed: "The exception path returns a success-shaped value. Downstream cannot distinguish real success from absorbed failure.",
          heal_shape: "Return a failure-shaped Result or re-raise. If absorbing is intentional, name the fallback kind and the caller-visible consequence."
        }, catalog));
      }
    }
  }
  return findings;
}

function scanShouldPredictions(files, catalog) {
  const findings = [];
  for (const file of files) {
    for (const line of file.added) {
      if (!PREDICTION_RE.test(line.text)) continue;
      findings.push(makeFinding({
        rule: "Q1_SHOULD_AS_PREDICTION",
        layer: "ast",
        doctrine: "D-VERIFY-BIND-BEFORE-ANNOUNCING",
        severity: "medium",
        file: line.file,
        line: line.line,
        snippet: `+ ${line.text}`,
        riverbed: "The line predicts behavior instead of binding it to evidence. It invites a future reader to trust intent where the code needs proof.",
        heal_shape: "Replace the prediction with observed behavior, add the missing assertion, or label the gap as unverified with a concrete follow-up owner."
      }, catalog));
    }
  }
  return findings;
}

function scanConjoinedTry(files, catalog) {
  const findings = [];
  for (const file of files.filter((f) => /\.(mjs|js|ts|tsx|py)$/.test(f.file))) {
    const added = file.added;
    for (let i = 0; i < added.length; i += 1) {
      const line = added[i];
      if (!/^\s*try\s*:?\s*\{?\s*$/.test(line.text)) continue;
      const indent = leadingSpaces(line.text);
      const body = [];
      for (let j = i + 1; j < added.length; j += 1) {
        const candidate = added[j];
        if (candidate.text.trim() && leadingSpaces(candidate.text) <= indent && !candidate.text.trim().startsWith("}")) {
          break;
        }
        body.push(candidate.text);
        if (body.length > 24) break;
      }
      const categories = new Set();
      const joined = body.join("\n");
      if (/\b(fetch|axios|requests\.|httpx\.|urllib\.|client\.chat|anthropic|openai)\b/.test(joined)) categories.add("network");
      if (/\b(JSON\.parse|\.json\(|json\.loads|yaml\.safe_load)\b/.test(joined)) categories.add("parse");
      if (/\b(readFile|writeFile|open\(|\.read_text|\.write_text|\.write_bytes)\b/.test(joined)) categories.add("filesystem");
      if (/\b(INSERT|UPDATE|DELETE|conn\.commit|supabase|from\(|\.execute\()\b/.test(joined)) categories.add("database");
      if (categories.size >= 2) {
        findings.push(makeFinding({
          rule: "Q1_CONJOINED_TRY",
          layer: "ast",
          doctrine: "D-FAILURE-SOFT-AT-EVERY-EXTERNAL-BOUNDARY",
          severity: "high",
          file: line.file,
          line: line.line,
          snippet: `+ ${line.text}`,
          riverbed: `One try block owns multiple boundary kinds: ${Array.from(categories).join(", ")}. When it fails, the caller cannot know which boundary broke.`,
          heal_shape: "Split the operations by boundary. Give each catch path its own error name, fallback kind, and caller-visible Result field."
        }, catalog));
      }
    }
  }
  return findings;
}

function scanCrossBoundary(files, catalog) {
  const patterns = [
    { re: /\.fresh\b|markers\s*\/\s*["']/i, kind: "fs:marker_emission", need: "signed receipt or dual marker valve" },
    { re: /subprocess\.(run|Popen|call|check_output)\(/, kind: "process:subprocess", need: "returncode check plus structured Result" },
    { re: /requests\.(get|post|put|delete|patch)\(|urllib\.|httpx\./, kind: "network:http", need: "status check plus named fallback" },
    { re: /\.write_text\(|\.write_bytes\(|open\([^,)]+,\s*["'][wa]/, kind: "fs:write", need: "durable write receipt" },
    { re: /spawn_task\(|notify_slack\.|post_alert\(/, kind: "agent:handoff", need: "handoff envelope or named fallback" },
    { re: /\.execute\(\s*["']INSERT|\.execute\(\s*["']UPDATE|conn\.commit\(\)/, kind: "db:write", need: "transaction boundary and idempotency key" }
  ];
  const findings = [];
  for (const file of files) {
    for (const line of file.added) {
      const trimmed = line.text.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
      for (const pattern of patterns) {
        if (!pattern.re.test(line.text)) continue;
        findings.push(makeFinding({
          rule: "QX_CROSS_BOUNDARY_ASSERTION",
          layer: "ast",
          doctrine: "D-CROSS-BOUNDARY-ASSERTIONS-REQUIRE-EXPLICIT-EVIDENCE",
          severity: "medium",
          file: line.file,
          line: line.line,
          snippet: `+ ${line.text}`,
          riverbed: `The new line crosses a ${pattern.kind} boundary. The code asserts another surface accepted work, but the receipt path is not visible in the added line.`,
          heal_shape: `Add ${pattern.need}, or return a named fallback that says this boundary is unverified.`
        }, catalog));
      }
    }
  }
  return findings;
}

function scanUnnamedConstraint(files, catalog, options) {
  const msg = String(options.commitMessage || "").trim();
  if (!msg) return [];
  const touchesLoadBearing = files.some((file) => LOAD_BEARING_PATHS.test(file.file));
  if (!touchesLoadBearing) return [];
  if (CONSTRAINT_WORDS.test(msg)) return [];
  return [makeFinding({
    rule: "Q7_CONSTRAINT_UNNAMED",
    layer: "ast",
    doctrine: "D-CONSTRAINT-FIRST-NOT-CAPABILITY-FIRST",
    severity: "medium",
    file: "<commit-message>",
    line: 1,
    snippet: msg.split(/\r?\n/)[0],
    riverbed: "The change is framed capability-first. The future maintainer cannot see what constraint made the change necessary.",
    heal_shape: "Add a constraint sentence: because <measured pain>, instead of <rejected path>, bounded by <risk or cost>."
  }, catalog)];
}

function scanUnbackedReportClaims(files, catalog) {
  const findings = [];
  for (const file of files.filter((f) => /\.md$/i.test(f.file))) {
    for (const line of file.added) {
      if (!/Heal Sentinel/i.test(line.text)) continue;
      if (!/`?NO_FINDINGS`?/i.test(line.text)) continue;
      if (/\.state\/heal_sentinel_audit\/[^\s`]+\.json/i.test(line.text)) continue;
      findings.push(makeFinding({
        rule: "Q1_UNBACKED_CLAIM_IN_REPORT",
        layer: "ast",
        doctrine: "D-VERIFY-BIND-BEFORE-ANNOUNCING",
        severity: "high",
        file: line.file,
        line: line.line,
        snippet: `+ ${line.text}`,
        riverbed: "The report announces a machine verdict but does not cite the stored receipt. The claim crosses a boundary without the artifact that lets the next reader verify it.",
        heal_shape: "Save the structured audit result to disk and cite the receipt path in the report line."
      }, catalog));
    }
  }
  return findings;
}

function scanProducerWithoutVisibleConsumer(files, catalog) {
  const findings = [];
  for (const file of files.filter((f) => /\.(html|mjs|js|ts|tsx)$/.test(f.file))) {
    const added = file.added;
    for (let i = 0; i < added.length; i += 1) {
      const line = added[i];
      if (!/statusText\.textContent\s*=\s*note\b/.test(line.text)) continue;
      const windowLines = added.slice(i + 1, i + 7).map((candidate) => candidate.text).join("\n");
      if (!/status\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/.test(windowLines)) continue;
      findings.push(makeFinding({
        rule: "Q2_PRODUCER_WITHOUT_VISIBLE_CONSUMER",
        layer: "ast",
        doctrine: "D-WATCHERS-WATCH-WATCHERS-AND-PROPOSALS-MUST-BE-ACTIONABLE",
        severity: "medium",
        file: line.file,
        line: line.line,
        snippet: `+ ${line.text}`,
        riverbed: "The code produces a meaningful status note and then hides the only visible consumer. The signal exists, but the user cannot receive it.",
        heal_shape: "Render the note for a bounded visible interval, or remove the unused producer so the code does not pretend to communicate."
      }, catalog));
    }
  }
  return findings;
}

function scanMagicThreshold(files, catalog) {
  const findings = [];
  for (const file of files.filter((f) => /\.(html|mjs|js|ts|tsx)$/.test(f.file))) {
    const added = file.added;
    for (let i = 0; i < added.length; i += 1) {
      const line = added[i];
      if (!/\bif\s*\([^)]*\bdelta\b[^)]*(?:<=|>=|<|>)\s*\d+(?:\.\d+)?[^)]*\)/.test(line.text)) continue;
      const windowLines = added.slice(i, i + 4).map((candidate) => candidate.text).join("\n");
      if (!/pixel_liveness_absent|liveness/i.test(windowLines)) continue;
      findings.push(makeFinding({
        rule: "Q3_MAGIC_THRESHOLD",
        layer: "ast",
        doctrine: "D-INSTRUMENT-WHAT-EXISTS-NOT-WHAT-IS-IMAGINED",
        severity: "medium",
        file: line.file,
        line: line.line,
        snippet: `+ ${line.text}`,
        riverbed: "The liveness proof depends on a numeric threshold that is not tied to a named measurement or multi-sample contract.",
        heal_shape: "Move the threshold into a named proof contract, measure it, or replace single-point proof with a multi-region majority check."
      }, catalog));
    }
  }
  return findings;
}

function nextMeaningfulAdded(lines, start) {
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].text.trim()) return lines[i];
  }
  return null;
}

function leadingSpaces(text) {
  return (text.match(/^\s*/) || [""])[0].length;
}
