import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const architecture = process.arch === "x64" ? "x64" : process.arch;
const exe = join(root, "release", `PowerLog-${architecture}-${version}.exe`);

if (!existsSync(exe)) {
  console.error(`[start] Binary not found: ${exe}`);
  process.exit(1);
}

console.log(`[start] Launching ${exe}`);
spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
