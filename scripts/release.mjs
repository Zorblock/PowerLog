import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
const repo = "Zorblock/PowerLog";

if (mode === "--help" || mode === "-h") {
  console.log("Usage: npm run release | npm run patch");
  console.log("release bumps the yearly minor version; patch bumps the patch version.");
  process.exit(0);
}

if (mode !== "minor" && mode !== "patch") {
  console.error("[release] Expected 'minor' or 'patch'.");
  process.exit(1);
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });
}

function output(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fail(message) {
  console.error(`[release] ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  writeFileSync(join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function replaceVersion(relativePath, pattern, version) {
  const path = join(root, relativePath);
  const current = readFileSync(path, "utf8");
  const updated = current.replace(pattern, `$1${version}$2`);
  if (updated === current) fail(`Could not update the version in ${relativePath}.`);
  writeFileSync(path, updated);
}

function nextVersion(current, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) fail(`Invalid semantic version: ${current}`);

  const [, majorText, minorText, patchText] = match;
  const yearlyMajor = Number(String(new Date().getFullYear()).slice(-2));
  const major = Number(majorText);
  const minor = Number(minorText);
  const patch = Number(patchText);

  // A new calendar year starts a fresh x.0.0 release line.
  if (major !== yearlyMajor) return `${yearlyMajor}.0.0`;
  return kind === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

function githubReleaseExists(tag) {
  const result = spawnSync("gh", ["release", "view", tag, "--repo", repo], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status === 0) return true;
  if (result.status === 1 && /not found/i.test(result.stderr || "")) return false;
  fail(`Could not check whether ${tag} already exists on GitHub: ${(result.stderr || result.error || "unknown error").toString().trim()}`);
}

try {
  if (process.arch !== "x64") fail(`This workflow produces an x64 binary, but Node is running on ${process.arch}.`);
  if (output("git", ["status", "--porcelain"])) {
    fail("Working tree is not clean. Commit or stash changes before releasing.");
  }
  run("gh", ["auth", "status"]);
  run("git", ["fetch", "origin", "--tags"]);

  const packageJson = readJson("package.json");
  const version = nextVersion(packageJson.version, mode);
  const tag = `v${version}`;

  if (output("git", ["tag", "--list", tag])) fail(`Tag ${tag} already exists.`);
  if (githubReleaseExists(tag)) fail(`GitHub release ${tag} already exists.`);

  packageJson.version = version;
  writeJson("package.json", packageJson);
  replaceVersion("src-tauri/tauri.conf.json", /("version"\s*:\s*")[^"]+("?)/, version);
  replaceVersion("src-tauri/Cargo.toml", /(version\s*=\s*")[^"]+("\s*$)/m, version);

  // Keep package-lock's root package metadata in sync without changing deps.
  run("npm", ["install", "--package-lock-only", "--ignore-scripts"]);
  run("npx", ["tauri", "build", "--no-bundle"]);
  run("node", ["scripts/package-release.mjs"]);

  const asset = join(root, "release", `PowerLog-x64-${version}.exe`);
  if (!existsSync(asset)) fail(`Expected release asset was not created: ${asset}`);

  run("git", ["add", "package.json", "package-lock.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml"]);
  run("git", ["commit", "-m", `release: v${version}`]);
  run("git", ["tag", "-a", tag, "-m", `PowerLog ${version}`]);
  run("git", ["push", "origin", "HEAD"]);
  run("git", ["push", "origin", tag]);
  run("gh", ["release", "create", tag, asset, "--repo", repo, "--title", `PowerLog v${version}`, "--generate-notes"]);

  console.log(`\n[release] Published ${tag}: https://github.com/${repo}/releases/tag/${tag}`);
} catch (error) {
  if (error?.stderr) process.stderr.write(error.stderr);
  fail(error?.message || "Release failed.");
}
