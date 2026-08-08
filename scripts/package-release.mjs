import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const architecture = process.arch === "x64" ? "x64" : process.arch;
const exe = join(root, "src-tauri", "target", "release", "PowerLog.exe");

if (!existsSync(exe)) {
  console.error(`[package] Binary not found: ${exe}`);
  process.exit(1);
}

const outDir = join(root, "release");
const filename = `PowerLog-${architecture}-${version}.exe`;
const destination = join(outDir, filename);
mkdirSync(outDir, { recursive: true });
copyFileSync(exe, destination);

console.log(`[package] Portable exe created: ${destination}`);
console.log(`[package] Size: ${(statSync(destination).size / 1024 / 1024).toFixed(1)} MB`);
