#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
import { analyze } from "../src/analyze.mjs";
import { formatPrComment } from "../src/formatPrComment.mjs";

const args = process.argv.slice(2);

function takeFlag(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  args.splice(index, 1);
  return true;
}

function takeAliasFlag(...names) {
  for (const name of names) {
    const found = takeFlag(name);
    if (found) return true;
  }
  return null;
}

function takeValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

if (takeAliasFlag("--version", "-v")) {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  process.stdout.write(`tfb-heal-sentinel ${pkg.version}\n`);
  process.exit(0);
}

if (takeAliasFlag("--help", "-h")) {
  process.stdout.write([
    "tfb-heal-sentinel — anti-sycophant AI code reviewer",
    "",
    "Usage:",
    "  tfb-heal-sentinel <diff-file>            # analyze a unified diff; text output",
    "  tfb-heal-sentinel <diff-file> --json     # JSON report",
    "  cat diff | tfb-heal-sentinel -           # read diff from stdin",
    "",
    "Options:",
    "  --json                          Emit JSON to stdout",
    "  --markdown                      Emit markdown (default)",
    "  --no-riverbed                   Skip the LLM riverbed layer (fast; catalog only)",
    "  --severity-floor <level>        medium (default) | high | critical",
    "  --commit-message <text>         Commit message body to scan for bypass acceptances",
    "  --commit-message-file <path>    Read commit-message body from file",
    "  --bypass-comment-file <path>    Read bypass-acceptance comments from file",
    "  --llm-provider <p>              openrouter | anthropic | auto (default: auto)",
    "  --llm-model <id>                Model override (default per provider)",
    "  --openrouter-api-key <key>      Explicit OpenRouter key (or set OPENROUTER_API_KEY)",
    "  --anthropic-api-key <key>       Explicit Anthropic key (or set ANTHROPIC_API_KEY)",
    "  --version, -v                   Print version and exit",
    "  --help, -h                      Print this help and exit",
    "",
    "Exit codes:",
    "  0  clean (no findings above severity floor, or all bypasses accepted)",
    "  2  findings above severity floor present (report generated; not an error)",
    "",
    "Docs: https://github.com/CREATEDCHARACTR/tfb-heal-sentinel",
    ""
  ].join("\n"));
  process.exit(0);
}

const json = takeFlag("--json");
const markdown = takeFlag("--markdown");
const noRiverbed = takeFlag("--no-riverbed");
const severityFloor = takeValue("--severity-floor") || "medium";
const commitMessage = takeValue("--commit-message") || "";
const commitMessageFile = takeValue("--commit-message-file");
const bypassCommentFile = takeValue("--bypass-comment-file");
const llmProvider = takeValue("--llm-provider");
const llmModel = takeValue("--llm-model");
const openrouterApiKey = takeValue("--openrouter-api-key");
const anthropicApiKey = takeValue("--anthropic-api-key");
const diffPath = args[0] || "-";

const diff = diffPath === "-"
  ? await readStdin()
  : await readFile(diffPath, "utf8");
const commitMessageBody = commitMessageFile
  ? await readFile(commitMessageFile, "utf8")
  : commitMessage;
const bypassComments = bypassCommentFile
  ? await readFile(bypassCommentFile, "utf8")
  : "";

const report = await analyze(diff, {
  severity_floor: severityFloor,
  commitMessage: commitMessageBody,
  bypassComments,
  includeRiverbed: !noRiverbed,
  llmProvider,
  model: llmModel,
  openrouterApiKey,
  llmApiKey: anthropicApiKey
});

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`${formatPrComment(report)}\n`);
}

process.exitCode = report.verdict === "NO_BYPASS" ? 2 : 0;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
