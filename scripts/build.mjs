import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const repo = dirname(root);
const dist = join(root, "dist");
const publicDir = join(repo, "firebase/public/heal-sentinel");

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "src"), { recursive: true });
await cp(join(root, "src"), join(dist, "src"), { recursive: true });
await cp(join(root, "doctrines.json"), join(dist, "doctrines.json"));
await cp(join(root, "skybridge.json"), join(dist, "skybridge.json"));
await cp(join(root, "index.mjs"), join(dist, "index.mjs"));
await cp(join(root, "bin"), join(dist, "bin"), { recursive: true });
await cp(join(root, "release"), join(dist, "release"), { recursive: true });
await cp(join(root, "ops"), join(dist, "ops"), { recursive: true });

await mkdir(join(publicDir, "lib"), { recursive: true });
await cp(join(root, "src"), join(publicDir, "lib"), { recursive: true });
await cp(join(root, "doctrines.json"), join(publicDir, "doctrines.json"));

await writeFile(join(dist, "skybridge-cert.placeholder.json"), JSON.stringify({
  op: "heal_sentinel.admission.placeholder",
  ok: false,
  reason: "Dist carries release/skybridge-admission.receipt.json when npm run admit has been run. This placeholder is not a release certificate.",
  next: "npm run admit && npm run build"
}, null, 2));

console.log(JSON.stringify({
  op: "heal_sentinel.build",
  ok: true,
  actions: [
    "copied_src_to_dist",
    "copied_doctrine_catalog",
    "copied_release_contracts",
    "synced_browser_demo_lib"
  ],
  skips: [],
  errors: [],
  metrics: {
    dist,
    publicDir
  },
  next: "npm run admit before public publish"
}, null, 2));
