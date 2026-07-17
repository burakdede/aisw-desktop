import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { consumeStringOption } from "./cli-arg-utils.mjs";
import {
  resolveRepository,
  resolveValue,
  setEnvironmentSecret,
} from "./github-secret-utils.mjs";

export const DEFAULT_ENVIRONMENT = "production";

const SECRET_NAMES = {
  appleId: "APPLE_ID",
  applePassword: "APPLE_PASSWORD",
  certificate: "APPLE_CERTIFICATE",
  certificatePassword: "APPLE_CERTIFICATE_PASSWORD",
  signingIdentity: "APPLE_SIGNING_IDENTITY",
  teamId: "APPLE_TEAM_ID",
};

function base64Encode(bytes) {
  return Buffer.from(bytes).toString("base64");
}

const STRING_ARGUMENT_KEYS = {
  "--apple-id": "appleId",
  "--apple-password": "applePassword",
  "--cert": "cert",
  "--cert-password": "certPassword",
  "--env": "environment",
  "--env-file": "envFile",
  "--repo": "repo",
  "--signing-identity": "signingIdentity",
  "--team-id": "teamId",
};

function parseEnvFileContents(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Invalid env file line: ${rawLine}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function loadEnvFile(path) {
  return parseEnvFileContents(readFileSync(path, "utf8"));
}

export function parseArgs(argv) {
  const options = {
    appleId: "",
    applePassword: "",
    cert: "",
    certPassword: "",
    dryRun: false,
    environment: DEFAULT_ENVIRONMENT,
    envFile: "",
    repo: "",
    signingIdentity: "",
    teamId: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const optionKey = STRING_ARGUMENT_KEYS[argument];
    if (optionKey) {
      index = consumeStringOption(options, optionKey, argv, index);
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
  const mergedEnv = options.envFile ? { ...env, ...loadEnvFile(options.envFile) } : env;
  const environment = options.environment || DEFAULT_ENVIRONMENT;
  const repo = options.repo || resolveRepository(mergedEnv, runner);
  const entries = collectMacosSigningSecrets(options, mergedEnv);

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
