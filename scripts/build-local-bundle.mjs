import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

export function resolveTauriTarget(extraArgs = []) {
  const targetIndex = extraArgs.findIndex((arg) => arg === "--target");
  if (targetIndex === -1) {
    return null;
  }
  return extraArgs[targetIndex + 1] ?? null;
}

export function resolveDmgDirectory(rootDir = process.cwd(), extraArgs = []) {
  const target = resolveTauriTarget(extraArgs);
  return target
    ? resolve(rootDir, "src-tauri", "target", target, "release", "bundle", "dmg")
    : resolve(rootDir, "src-tauri", "target", "release", "bundle", "dmg");
}

export function hasMacosNotarizationCredentials(env = process.env) {
  return Boolean(env.APPLE_ID && env.APPLE_PASSWORD && env.APPLE_TEAM_ID);
}

export function notarizeLocalMacosDmgs(
  rootDir = process.cwd(),
  extraArgs = [],
  spawn = spawnSync,
  env = process.env,
  platform = process.platform,
) {
  if (platform !== "darwin" || !hasMacosNotarizationCredentials(env)) {
    return;
  }

  const dmgDir = resolveDmgDirectory(rootDir, extraArgs);
  const dmgFiles = readdirSync(dmgDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".dmg"))
    .map((entry) => resolve(dmgDir, entry.name));

  for (const dmgPath of dmgFiles) {
    const submitResult = spawn(
      "xcrun",
      [
        "notarytool",
        "submit",
        dmgPath,
        "--apple-id",
        env.APPLE_ID,
        "--password",
        env.APPLE_PASSWORD,
        "--team-id",
        env.APPLE_TEAM_ID,
        "--wait",
      ],
      {
        cwd: rootDir,
        stdio: "inherit",
      },
    );
    if (submitResult.error) {
      throw submitResult.error;
    }
    if ((submitResult.status ?? 1) !== 0) {
      return submitResult.status ?? 1;
    }

    const stapleResult = spawn("xcrun", ["stapler", "staple", dmgPath], {
      cwd: rootDir,
      stdio: "inherit",
    });
    if (stapleResult.error) {
      throw stapleResult.error;
    }
    if ((stapleResult.status ?? 1) !== 0) {
      return stapleResult.status ?? 1;
    }

    const verifyResult = spawn(
      "spctl",
      ["-a", "-t", "open", "--context", "context:primary-signature", "-vv", dmgPath],
      {
        cwd: rootDir,
        stdio: "inherit",
      },
    );
    if (verifyResult.error) {
      throw verifyResult.error;
    }
    if ((verifyResult.status ?? 1) !== 0) {
      return verifyResult.status ?? 1;
    }
  }

  return 0;
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
    const buildStatus = result.status ?? 1;
    if (buildStatus !== 0) {
      return buildStatus;
    }

    const notarizeStatus = notarizeLocalMacosDmgs(rootDir, extraArgs, spawn);
    return notarizeStatus ?? 0;
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
