import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".test-build", { recursive: true });
await build({ entryPoints: ["tests/data.test.ts"], outfile: ".test-build/data.test.mjs", bundle: true, platform: "node", format: "esm", target: "node22" });
const result = spawnSync(process.execPath, ["--test", ".test-build/data.test.mjs"], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
