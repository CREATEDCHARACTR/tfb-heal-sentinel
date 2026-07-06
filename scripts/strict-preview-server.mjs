#!/usr/bin/env node
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const publicRoot = join(root, "firebase/public");
const firebase = JSON.parse(await readFile(join(root, "firebase/firebase.json"), "utf8"));
const healHeaders = Object.fromEntries(
  firebase.hosting.headers
    .find((entry) => entry.source === "/heal-sentinel/**")
    .headers
    .map((header) => [header.key, header.value])
);
const port = Number(process.env.PORT || process.argv[2] || 4180);

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = url.pathname === "/heal-sentinel" ? "/heal-sentinel/" : url.pathname;
  if (!pathname.startsWith("/heal-sentinel/")) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }

  for (const [key, value] of Object.entries(healHeaders)) res.setHeader(key, value);
  let target = normalize(join(publicRoot, pathname));
  if (!target.startsWith(publicRoot)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, "index.html");
    await stat(target);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }

  res.setHeader("content-type", contentType(target));
  res.writeHead(200);
  createReadStream(target).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({
    op: "heal_sentinel.strict_preview_server",
    ok: true,
    url: `http://127.0.0.1:${port}/heal-sentinel/`,
    headers: Object.keys(healHeaders).sort()
  }, null, 2));
});

function contentType(path) {
  switch (extname(path)) {
    case ".html": return "text/html; charset=utf-8";
    case ".mjs":
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    default: return "application/octet-stream";
  }
}
