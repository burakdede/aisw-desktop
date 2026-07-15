import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const DEFAULT_ENVIRONMENT = "production";

export const requiredReleaseSecrets = [
  "AISW_SIDECAR_URL_MACOS_ARM64",
  "AISW_SIDECAR_URL_MACOS_X64",
  "AISW_SIDECAR_URL_LINUX_X64",
  "AISW_SIDECAR_URL_WINDOWS_X64",
  "AISW_DESKTOP_UPDATER_ENDPOINT_STABLE",
  "AISW_DESKTOP_UPDATER_ENDPOINT_BETA",
  "TAURI_SIGNING_PUBLIC_KEY",
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
];

export const optionalReleaseSecrets = [
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "APPLE_SIGNING_IDENTITY",
  "APPLE_ID",
  "APPLE_PASSWORD",
  "APPLE_TEAM_ID",
];

function stripSingleTrailingNewline(value) {
  return value.replace(/\r?\n$/, "");
}

export function parseArgs(argv) {
  const options = {
    environment: DEFAULT_ENVIRONMENT,
    dryRun: false,
    repo: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repo") {
      options.repo = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument === "--env") {
      options.environment = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.environment) {
    throw new Error("Missing value for --env");
  }

  return options;
}

export function resolveSecretValue(secretName, env = process.env) {
  const directValue = env[secretName];
  const fileValue = env[`${secretName}_FILE`];

  if (directValue && fileValue) {
    throw new Error(`Set either ${secretName} or ${secretName}_FILE, not both.`);
  }

  if (typeof directValue === "string" && directValue.length > 0) {
    return directValue;
  }

  if (typeof fileValue === "string" && fileValue.length > 0) {
    return stripSingleTrailingNewline(readFileSync(fileValue, "utf8"));
  }

  return null;
}

export function collectReleaseSecrets(env = process.env) {
  const required = [];
  const optional = [];
  const missing = [];

  for (const secretName of requiredReleaseSecrets) {
    const value = resolveSecretValue(secretName, env);
    if (value === null) {
      missing.push(secretName);
      continue;
    }
    required.push({ name: secretName, value });
  }

  for (const secretName of optionalReleaseSecrets) {
    const value = resolveSecretValue(secretName, env);
    if (value !== null) {
      optional.push({ name: secretName, value });
    }
  }

  return { required, optional, missing };
}

export function resolveRepository(env = process.env, runner = spawnSync) {
  if (typeof env.GITHUB_REPOSITORY === "string" && env.GITHUB_REPOSITORY.length > 0) {
    return env.GITHUB_REPOSITORY;
  }

  const result = runner("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error("Unable to resolve the GitHub repository. Pass --repo owner/name or export GITHUB_REPOSITORY.");
  }

  return result.stdout.trim();
}

function runGhCommand(args, runner = spawnSync, stdin = "") {
  const result = runner("gh", args, {
    encoding: "utf8",
    input: stdin,
  });

  if (result.status !== 0) {
    const errorOutput = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(errorOutput || `gh ${args.join(" ")} failed`);
  }
}

export function createEnvironment({ environment, repo }, runner = spawnSync) {
  runGhCommand(
    [
      "api",
      "--method",
      "PUT",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${repo}/environments/${environment}`,
    ],
    runner,
  );
}

export function setEnvironmentSecret({ environment, repo, name, value }, runner = spawnSync) {
  runGhCommand(["secret", "set", name, "--repo", repo, "--env", environment], runner, value);
}

export function configureReleaseSecrets(
  { environment = DEFAULT_ENVIRONMENT, repo, dryRun = false } = {},
  { env = process.env, runner = spawnSync, stdout = process.stdout } = {},
) {
  const repository = repo || resolveRepository(env, runner);
  const { required, optional, missing } = collectReleaseSecrets(env);

  if (missing.length > 0) {
    throw new Error(
      `Missing required release secrets in the local environment: ${missing.join(", ")}.`,
    );
  }

  const secretCount = required.length + optional.length;
  stdout.write(`Using ${repository} / ${environment}\n`);
  stdout.write(`Required secrets: ${required.length}, optional secrets provided: ${optional.length}\n`);

  if (dryRun) {
    stdout.write(`Dry run only. Would create the GitHub environment and upload ${secretCount} secrets.\n`);
    return {
      dryRun: true,
      environment,
      optionalCount: optional.length,
      repo: repository,
      requiredCount: required.length,
      secretCount,
    };
  }

  createEnvironment({ environment, repo: repository }, runner);
  stdout.write(`Ensured GitHub environment \`${environment}\` exists.\n`);

  for (const secret of [...required, ...optional]) {
    setEnvironmentSecret({ environment, repo: repository, name: secret.name, value: secret.value }, runner);
    stdout.write(`Uploaded ${secret.name}\n`);
  }

  return {
    dryRun: false,
    environment,
    optionalCount: optional.length,
    repo: repository,
    requiredCount: required.length,
    secretCount,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2));
    configureReleaseSecrets(options);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
