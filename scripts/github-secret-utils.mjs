import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

export function stripSingleTrailingNewline(value) {
  return value.replace(/\r?\n$/, "");
}

export function resolveValue({ direct, file, label }) {
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

export function resolveSecretValue(secretName, env = process.env) {
  return resolveValue({
    direct: env[secretName],
    file: env[`${secretName}_FILE`],
    label: secretName,
  });
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

export function runGhCommand(args, runner = spawnSync, stdin = "") {
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
