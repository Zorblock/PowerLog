import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exe = join(root, "release", "PowerLog.exe");

if (!existsSync(exe)) {
  console.error(`[start] Binary not found: ${exe}`);
  process.exit(1);
}

console.log(`[start] Launching ${exe}`);
spawn(exe, [], { detached: true, stdio: "ignore" }).unref();