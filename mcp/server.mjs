#!/usr/bin/env node
import { analyze } from "../src/analyze.mjs";

if (process.argv.includes("--self-test")) {
  const report = await analyze([
    "diff --git a/x.ts b/x.ts",
    "--- a/x.ts",
    "+++ b/x.ts",
    "@@ -1 +1 @@",
    "+// this should handle the edge case"
  ].join("\n"), { includeRiverbed: false });
  console.log(JSON.stringify({
    op: "heal_sentinel_mcp.self_test",
    ok: report.verdict === "NO_BYPASS",
    actions: ["called_analyze"],
    skips: [],
    errors: [],
    metrics: { findings: report.findings.length },
    next: "Run through an MCP host for protocol-level verification."
  }, null, 2));
  process.exit(report.verdict === "NO_BYPASS" ? 0 : 1);
}

process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) handleLine(line).catch((error) => respond(null, { code: -32603, message: error.message }));
  }
});

async function handleLine(line) {
  const request = JSON.parse(line);
  if (request.method === "initialize") {
    return respond(request.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "heal-sentinel", version: "0.1.0" }
    });
  }
  if (request.method === "tools/list") {
    return respond(request.id, {
      tools: [{
        name: "heal-sentinel/analyze",
        description: "Scan a git diff for root-wound review findings and return a HealReport.",
        inputSchema: {
          type: "object",
          properties: {
            diff: { type: "string" },
            options: { type: "object" }
          },
          required: ["diff"]
        }
      }]
    });
  }
  if (request.method === "tools/call" && request.params?.name === "heal-sentinel/analyze") {
    const args = request.params.arguments || {};
    const report = await analyze(args.diff || "", args.options || {});
    return respond(request.id, {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }]
    });
  }
  return respond(request.id, null, { code: -32601, message: `unknown_method:${request.method}` });
}

function respond(id, result, error) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result, error })}\n`);
}
