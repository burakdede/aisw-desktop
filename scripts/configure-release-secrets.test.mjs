import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ENVIRONMENT,
  collectReleaseSecrets,
  configureReleaseSecrets,
  parseArgs,
  resolveSecretValue,
  requiredReleaseSecrets,
} from "./configure-release-secrets.mjs";

const tempDirs = [];

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

function makeTempFile(contents) {
  const directory = mkdtempSync(join(tmpdir(), "aisw-secret-"));
  const path = join(directory, "value.txt");
  tempDirs.push(directory);
  writeFileSync(path, contents);
  return path;
}

function makeRequiredEnv(overrides = {}) {
  return {
    AISW_SIDECAR_URL_MACOS_ARM64: "https://example.com/aisw-arm64",
    AISW_SIDECAR_URL_MACOS_X64: "https://example.com/aisw-x64",
    AISW_SIDECAR_URL_LINUX_X64: "https://example.com/aisw-linux",
    AISW_SIDECAR_URL_WINDOWS_X64: "https://example.com/aisw-win.exe",
    AISW_DESKTOP_UPDATER_ENDPOINT_STABLE: "https://updates.example.com/stable.json",
    TAURI_SIGNING_PUBLIC_KEY: "public-key",
    TAURI_SIGNING_PRIVATE_KEY: "private-key",
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "secret-password",
    ...overrides,
  };
}

describe("configure-release-secrets", () => {
  it("parses CLI arguments", () => {
    expect(parseArgs(["--repo", "burakdede/aisw-desktop", "--env", "staging", "--dry-run"])).toEqual({
      dryRun: true,
      environment: "staging",
      repo: "burakdede/aisw-desktop",
    });
    expect(parseArgs([])).toEqual({
      dryRun: false,
      environment: DEFAULT_ENVIRONMENT,
      repo: "",
    });
  });

  it("reads secrets from files when *_FILE is provided", () => {
    const path = makeTempFile("file-secret\n");
    expect(resolveSecretValue("TAURI_SIGNING_PRIVATE_KEY", { TAURI_SIGNING_PRIVATE_KEY_FILE: path })).toBe(
      "file-secret",
    );
  });

  it("rejects conflicting direct and file secret inputs", () => {
    const path = makeTempFile("file-secret");
    expect(() =>
      resolveSecretValue("TAURI_SIGNING_PRIVATE_KEY", {
        TAURI_SIGNING_PRIVATE_KEY: "inline-secret",
        TAURI_SIGNING_PRIVATE_KEY_FILE: path,
      }),
    ).toThrow("Set either TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_FILE, not both.");
  });

  it("collects required and optional secrets while reporting missing values", () => {
    const secrets = collectReleaseSecrets(
      makeRequiredEnv({
        APPLE_ID: "ship@example.com",
        APPLE_TEAM_ID: "TEAMID123",
        AISW_SIDECAR_URL_WINDOWS_X64: undefined,
      }),
    );

    expect(secrets.required).toHaveLength(requiredReleaseSecrets.length - 1);
    expect(secrets.optional).toEqual([
      { name: "APPLE_ID", value: "ship@example.com" },
      { name: "APPLE_TEAM_ID", value: "TEAMID123" },
    ]);
    expect(secrets.missing).toEqual(["AISW_SIDECAR_URL_WINDOWS_X64"]);
  });

  it("creates the environment and uploads all available secrets", () => {
    const commands = [];
    const stdout = { write: vi.fn() };
    const runner = vi.fn((command, args, options = {}) => {
      commands.push({ args, command, input: options.input ?? "" });
      if (args[0] === "repo" && args[1] === "view") {
        return { status: 0, stdout: "burakdede/aisw-desktop\n", stderr: "" };
      }
      return { status: 0, stdout: "", stderr: "" };
    });

    const result = configureReleaseSecrets(
      {},
      {
        env: makeRequiredEnv({
          APPLE_SIGNING_IDENTITY: "Developer ID Application: Example",
        }),
        runner,
        stdout,
      },
    );

    expect(result).toEqual({
      dryRun: false,
      environment: "production",
      optionalCount: 1,
      repo: "burakdede/aisw-desktop",
      requiredCount: requiredReleaseSecrets.length,
      secretCount: requiredReleaseSecrets.length + 1,
    });
    expect(commands[0]).toEqual({
      command: "gh",
      args: ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
      input: "",
    });
    expect(commands[1].args).toEqual([
      "api",
      "--method",
      "PUT",
      "-H",
      "Accept: application/vnd.github+json",
      "repos/burakdede/aisw-desktop/environments/production",
    ]);
    expect(commands.slice(2)).toHaveLength(requiredReleaseSecrets.length + 1);
    expect(commands[2]).toEqual({
      command: "gh",
      args: [
        "secret",
        "set",
        "AISW_SIDECAR_URL_MACOS_ARM64",
        "--repo",
        "burakdede/aisw-desktop",
        "--env",
        "production",
      ],
      input: "https://example.com/aisw-arm64",
    });
    expect(stdout.write).toHaveBeenCalled();
  });

  it("supports dry runs without hitting GitHub", () => {
    const runner = vi.fn(() => {
      throw new Error("runner should not be called during dry runs");
    });
    const stdout = { write: vi.fn() };

    const result = configureReleaseSecrets(
      {
        dryRun: true,
        repo: "burakdede/aisw-desktop",
      },
      {
        env: makeRequiredEnv(),
        runner,
        stdout,
      },
    );

    expect(result).toEqual({
      dryRun: true,
      environment: "production",
      optionalCount: 0,
      repo: "burakdede/aisw-desktop",
      requiredCount: requiredReleaseSecrets.length,
      secretCount: requiredReleaseSecrets.length,
    });
    expect(runner).not.toHaveBeenCalled();
    expect(stdout.write).toHaveBeenCalledWith(
      `Dry run only. Would create the GitHub environment and upload ${requiredReleaseSecrets.length} secrets.\n`,
    );
  });

  it("fails before GitHub calls when required values are missing", () => {
    expect(() =>
      configureReleaseSecrets(
        { repo: "burakdede/aisw-desktop" },
        {
          env: {},
          runner: vi.fn(),
          stdout: { write: vi.fn() },
        },
      ),
    ).toThrow("Missing required release secrets in the local environment");
  });
});
