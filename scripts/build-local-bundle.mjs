import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

export function createLocalBundleConfig(rootDir = process.cwd()) {
  const tauriConfigPath = resolve(rootDir, "src-tauri/tauri.conf.json");
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
  tauriConfig.bundle ??= {};
  tauriConfig.bundle.createUpdaterArtifacts = false;
  return tauriConfig;
}

export function buildLocalBundleInvocation(rootDir = process.cwd(), extraArgs = []) {
  const tempDir = mkdtempSync(join(tmpdir(), "aisw-local-bundle-"));
  const configPath = join(tempDir, "tauri.local.bundle.json");
  const config = createLocalBundleConfig(rootDir);
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  return {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["tauri", "build", "--config", configPath, ...extraArgs],
    config,
    configPath,
    cleanup() {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

export function runLocalBundleBuild(
  rootDir = process.cwd(),
  extraArgs = process.argv.slice(2),
  spawn = spawnSync,
) {
  const invocation = buildLocalBundleInvocation(rootDir, extraArgs);
  try {
    const result = spawn(invocation.command, invocation.args, {
      cwd: rootDir,
      stdio: "inherit",
    });
    if (result.error) {
      throw result.error;
    }
    return result.status ?? 1;
  } finally {
    invocation.cleanup();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runLocalBundleBuild(repoRoot);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
