import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exe = join(root, "src-tauri", "target", "release", "PowerLog.exe");

if (!existsSync(exe)) {
  console.error(`[release] Binary not found: ${exe}`);
  process.exit(1);
}

const outDir = join(root, "release");
mkdirSync(outDir, { recursive: true });

const dest = join(outDir, "PowerLog.exe");
copyFileSync(exe, dest);

console.log(`[release] Portable exe created: ${dest}`);
console.log(`[release] Size: ${(statSync(dest).size / 1024 / 1024).toFixed(1)} MB`);