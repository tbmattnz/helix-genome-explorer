import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = {};
for (const name of (await readdir("public/data")).filter(n => n.endsWith(".json")).sort()) {
  const bytes = await readFile("public/data/" + name);
  files[name] = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
await writeFile("public/data-manifest.json", JSON.stringify({ snapshot: "2026-11-16", files }, null, 2) + "\n");
