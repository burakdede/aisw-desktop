import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

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

export function notarizeMacosDmgs(
  rootDir = process.cwd(),
  extraArgs = process.argv.slice(2),
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = notarizeMacosDmgs(repoRoot) ?? 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
