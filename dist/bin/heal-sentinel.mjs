#!/usr/bin/env node
import { readFile } from "node:fs/promises";
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

function takeValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

const json = takeFlag("--json");
const markdown = takeFlag("--markdown");
const noRiverbed = takeFlag("--no-riverbed");
const severityFloor = takeValue("--severity-floor") || "medium";
const commitMessage = takeValue("--commit-message") || "";
const commitMessageFile = takeValue("--commit-message-file");
const bypassCommentFile = takeValue("--bypass-comment-file");
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
  includeRiverbed: !noRiverbed
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
