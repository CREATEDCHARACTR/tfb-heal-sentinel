import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const result = spawnSync("npx", ["tfb-skybridge", "check", "."], {
  encoding: "utf8",
  shell: false
});

const stdout = result.stdout || "";
const stderr = result.stderr || "";
if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

if (result.error) {
  console.error(JSON.stringify({
    op: "heal_sentinel.admit",
    ok: false,
    actions: ["attempted_tfb_skybridge_admission"],
    skips: [],
    errors: [{ name: result.error.name, message: result.error.message }],
    metrics: {},
    next: "Install or authorize tfb-skybridge, then rerun npm run admit."
  }, null, 2));
  process.exit(1);
}

const verdictMatch = stdout.match(/Verdict:\s*[✓\u2713]?\s*([A-Z_]+)\s*·\s*Tier\s+([A-Z])/);
const admitted = (result.status ?? 1) === 0 && verdictMatch?.[1] === "ADMIT";
const root = fileURLToPath(new URL("..", import.meta.url));
const releaseDir = join(root, "release");
await mkdir(releaseDir, { recursive: true });
await writeFile(join(releaseDir, "skybridge-admission.receipt.json"), JSON.stringify({
  op: "heal_sentinel.skybridge_admission",
  ok: admitted,
  verdict: verdictMatch?.[1] || "UNKNOWN",
  tier: verdictMatch?.[2] || null,
  actions: ["ran_tfb_skybridge_check", "wrote_durable_admission_receipt"],
  skips: [],
  errors: admitted ? [] : [{ name: "skybridge_admission_not_admitted", message: stderr || stdout || "No admission verdict parsed." }],
  metrics: {
    exit_status: result.status ?? 1,
    admitted_at: new Date().toISOString(),
    stdout_bytes: Buffer.byteLength(stdout),
    stderr_bytes: Buffer.byteLength(stderr)
  },
  next: admitted
    ? "Keep this receipt with the release packet; CEO publish approval remains separate."
    : "Heal the Skybridge admission finding before public publish.",
  stdout
}, null, 2));

process.exit(result.status ?? 1);
