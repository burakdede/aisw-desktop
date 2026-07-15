import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_ENVIRONMENT = "production";

const SECRET_NAMES = {
  appleId: "APPLE_ID",
  applePassword: "APPLE_PASSWORD",
  certificate: "APPLE_CERTIFICATE",
  certificatePassword: "APPLE_CERTIFICATE_PASSWORD",
  signingIdentity: "APPLE_SIGNING_IDENTITY",
  teamId: "APPLE_TEAM_ID",
};

function stripSingleTrailingNewline(value) {
  return value.replace(/\r?\n$/, "");
}

function base64Encode(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function resolveValue({ direct, file, label }) {
  if (direct && file) {
    throw new Error(`Set either ${label} or ${label}_FILE, not both.`);
  }

  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  if (typeof file === "string" && file.length > 0) {
    return stripSingleTrailingNewline(readFileSync(file, "utf8"));
  }

  return null;
}

function parseArgs(argv) {
  const options = {
    appleId: "",
    applePassword: "",
    cert: "",
    certPassword: "",
    dryRun: false,
    environment: DEFAULT_ENVIRONMENT,
    repo: "",
    signingIdentity: "",
    teamId: "",
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
    if (argument === "--cert") {
      options.cert = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument === "--cert-password") {
      options.certPassword = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument === "--signing-identity") {
      options.signingIdentity = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument === "--apple-id") {
      options.appleId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument === "--apple-password") {
      options.applePassword = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument === "--team-id") {
      options.teamId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function resolveRepository(env = process.env, runner = spawnSync) {
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

function setEnvironmentSecret({ environment, repo, name, value }, runner = spawnSync) {
  runGhCommand(["secret", "set", name, "--repo", repo, "--env", environment], runner, value);
}

export function collectMacosSigningSecrets(options = {}, env = process.env) {
  const certPath =
    options.cert ||
    resolveValue({
      direct: env.APPLE_CERTIFICATE_P12,
      file: env.APPLE_CERTIFICATE_P12_FILE,
      label: "APPLE_CERTIFICATE_P12",
    }) ||
    resolveValue({
      direct: env.APPLE_CERTIFICATE_PATH,
      file: env.APPLE_CERTIFICATE_PATH_FILE,
      label: "APPLE_CERTIFICATE_PATH",
    });

  if (!certPath) {
    throw new Error("Provide --cert /path/to/certificate.p12 or APPLE_CERTIFICATE_P12/APPLE_CERTIFICATE_PATH.");
  }

  const certificate = base64Encode(readFileSync(certPath));
  const certificatePassword =
    options.certPassword ||
    resolveValue({
      direct: env.APPLE_CERTIFICATE_PASSWORD,
      file: env.APPLE_CERTIFICATE_PASSWORD_FILE,
      label: "APPLE_CERTIFICATE_PASSWORD",
    });
  const signingIdentity =
    options.signingIdentity ||
    resolveValue({
      direct: env.APPLE_SIGNING_IDENTITY,
      file: env.APPLE_SIGNING_IDENTITY_FILE,
      label: "APPLE_SIGNING_IDENTITY",
    });
  const appleId =
    options.appleId ||
    resolveValue({
      direct: env.APPLE_ID,
      file: env.APPLE_ID_FILE,
      label: "APPLE_ID",
    });
  const applePassword =
    options.applePassword ||
    resolveValue({
      direct: env.APPLE_PASSWORD,
      file: env.APPLE_PASSWORD_FILE,
      label: "APPLE_PASSWORD",
    });
  const teamId =
    options.teamId ||
    resolveValue({
      direct: env.APPLE_TEAM_ID,
      file: env.APPLE_TEAM_ID_FILE,
      label: "APPLE_TEAM_ID",
    });

  const entries = [
    { name: SECRET_NAMES.certificate, value: certificate },
    { name: SECRET_NAMES.certificatePassword, value: certificatePassword },
    { name: SECRET_NAMES.signingIdentity, value: signingIdentity },
    { name: SECRET_NAMES.appleId, value: appleId },
    { name: SECRET_NAMES.applePassword, value: applePassword },
    { name: SECRET_NAMES.teamId, value: teamId },
  ];

  const missing = entries.filter((entry) => entry.value === null || entry.value === "").map((entry) => entry.name);
  if (missing.length > 0) {
    throw new Error(`Missing required macOS signing values: ${missing.join(", ")}.`);
  }

  return entries;
}

export function configureMacosSigningSecrets(
  options = {},
  { env = process.env, runner = spawnSync, stdout = process.stdout } = {},
) {
  const environment = options.environment || DEFAULT_ENVIRONMENT;
  const repo = options.repo || resolveRepository(env, runner);
  const entries = collectMacosSigningSecrets(options, env);

  stdout.write(`Using ${repo} / ${environment}\n`);
  stdout.write(`Uploading ${entries.length} macOS signing secrets.\n`);

  if (options.dryRun) {
    stdout.write("Dry run only. No secrets were uploaded.\n");
    return {
      dryRun: true,
      environment,
      repo,
      secretCount: entries.length,
      secretNames: entries.map((entry) => entry.name),
    };
  }

  for (const entry of entries) {
    setEnvironmentSecret({ environment, repo, name: entry.name, value: entry.value }, runner);
    stdout.write(`Uploaded ${entry.name}\n`);
  }

  return {
    dryRun: false,
    environment,
    repo,
    secretCount: entries.length,
    secretNames: entries.map((entry) => entry.name),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2));
    configureMacosSigningSecrets(options);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
