import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ENVIRONMENT,
  collectMacosSigningSecrets,
  configureMacosSigningSecrets,
  inspectMacosSigningCertificate,
  loadEnvFile,
  parseArgs,
} from "./configure-macos-signing-secrets.mjs";

const tempDirs = [];

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

function makeTempFile(name, contents) {
  const directory = mkdtempSync(join(tmpdir(), "aisw-macos-signing-"));
  const path = join(directory, name);
  tempDirs.push(directory);
  writeFileSync(path, contents);
  return path;
}

function makeEnv(overrides = {}) {
  return {
    APPLE_CERTIFICATE_PASSWORD: "certificate-password",
    APPLE_SIGNING_IDENTITY: "Developer ID Application: Example, Inc. (TEAMID1234)",
    APPLE_ID: "ship@example.com",
    APPLE_PASSWORD: "app-specific-password",
    APPLE_TEAM_ID: "TEAMID1234",
    ...overrides,
  };
}

function makeOpenSslRunner(friendlyNames = ["Developer ID Application: Example, Inc. (TEAMID1234)"]) {
  return vi.fn(() => ({
    status: 0,
    stdout: "",
    stderr: friendlyNames.map((name) => `friendlyName: ${name}`).join("\n"),
  }));
}

describe("configure-macos-signing-secrets", () => {
  it("parses CLI arguments", () => {
    expect(
      parseArgs([
        "--repo",
        "burakdede/aisw-desktop",
        "--env",
        "staging",
        "--env-file",
        ".env.macos-signing",
        "--cert",
        "/tmp/certificate.p12",
        "--cert-password",
        "cert-password",
        "--signing-identity",
        "Developer ID Application: Example, Inc. (TEAMID1234)",
        "--apple-id",
        "ship@example.com",
        "--apple-password",
        "app-specific-password",
        "--team-id",
        "TEAMID1234",
        "--dry-run",
      ]),
    ).toEqual({
      appleId: "ship@example.com",
      applePassword: "app-specific-password",
      cert: "/tmp/certificate.p12",
      certPassword: "cert-password",
      dryRun: true,
      environment: "staging",
      envFile: ".env.macos-signing",
      repo: "burakdede/aisw-desktop",
      signingIdentity: "Developer ID Application: Example, Inc. (TEAMID1234)",
      teamId: "TEAMID1234",
    });

    expect(parseArgs([])).toEqual({
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
    });
  });

  it("collects a base64 certificate and the remaining Apple signing values", () => {
    const certPath = makeTempFile("certificate.p12", "binary-p12-contents");
    const secrets = collectMacosSigningSecrets({ cert: certPath }, makeEnv(), makeOpenSslRunner());

    expect(secrets).toEqual([
      { name: "APPLE_CERTIFICATE", value: Buffer.from("binary-p12-contents").toString("base64") },
      { name: "APPLE_CERTIFICATE_PASSWORD", value: "certificate-password" },
      { name: "APPLE_SIGNING_IDENTITY", value: "Developer ID Application: Example, Inc. (TEAMID1234)" },
      { name: "APPLE_ID", value: "ship@example.com" },
      { name: "APPLE_PASSWORD", value: "app-specific-password" },
      { name: "APPLE_TEAM_ID", value: "TEAMID1234" },
    ]);
  });

  it("supports environment-provided certificate paths and *_FILE values", () => {
    const certPath = makeTempFile("certificate.p12", "p12");
    const passwordFile = makeTempFile("password.txt", "password-from-file\n");
    const secrets = collectMacosSigningSecrets(
      {},
      makeEnv({
        APPLE_CERTIFICATE_PASSWORD: undefined,
        APPLE_CERTIFICATE_PASSWORD_FILE: passwordFile,
        APPLE_CERTIFICATE_PATH: certPath,
      }),
      makeOpenSslRunner(),
    );

    expect(secrets[0]).toEqual({
      name: "APPLE_CERTIFICATE",
      value: Buffer.from("p12").toString("base64"),
    });
    expect(secrets[1]).toEqual({
      name: "APPLE_CERTIFICATE_PASSWORD",
      value: "password-from-file",
    });
  });

  it("loads macOS signing values from an env file", () => {
    const certPath = makeTempFile("certificate.p12", "p12");
    const envFilePath = makeTempFile(
      ".env.macos-signing",
      [
        "# macOS signing",
        `APPLE_CERTIFICATE_PATH=${certPath}`,
        "APPLE_CERTIFICATE_PASSWORD=certificate-password",
        "APPLE_SIGNING_IDENTITY='Developer ID Application: Example, Inc. (TEAMID1234)'",
        "APPLE_ID=ship@example.com",
        "APPLE_PASSWORD=app-specific-password",
        "APPLE_TEAM_ID=TEAMID1234",
      ].join("\n"),
    );

    expect(loadEnvFile(envFilePath)).toEqual({
      APPLE_CERTIFICATE_PATH: certPath,
      APPLE_CERTIFICATE_PASSWORD: "certificate-password",
      APPLE_SIGNING_IDENTITY: "Developer ID Application: Example, Inc. (TEAMID1234)",
      APPLE_ID: "ship@example.com",
      APPLE_PASSWORD: "app-specific-password",
      APPLE_TEAM_ID: "TEAMID1234",
    });

    const runner = vi.fn(() => {
      return {
        status: 0,
        stdout: "",
        stderr: "friendlyName: Developer ID Application: Example, Inc. (TEAMID1234)",
      };
    });
    const stdout = { write: vi.fn() };

    const result = configureMacosSigningSecrets(
      {
        dryRun: true,
        envFile: envFilePath,
        repo: "burakdede/aisw-desktop",
      },
      {
        env: {},
        runner,
        stdout,
      },
    );

    expect(result.dryRun).toBe(true);
    expect(result.secretCount).toBe(6);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(
      "openssl",
      [
        "pkcs12",
        "-legacy",
        "-in",
        certPath,
        "-nokeys",
        "-passin",
        "pass:certificate-password",
        "-info",
      ],
      { encoding: "utf8" },
    );
  });

  it("fails when a required value is missing", () => {
    const certPath = makeTempFile("certificate.p12", "p12");
    expect(() =>
      collectMacosSigningSecrets(
        { cert: certPath },
        makeEnv({
          APPLE_PASSWORD: "",
        }),
        makeOpenSslRunner(),
      ),
    ).toThrow("Missing required macOS signing values: APPLE_PASSWORD.");
  });

  it("rejects certificates that are not Developer ID Application exports", () => {
    const certPath = makeTempFile("certificate.p12", "p12");

    expect(() =>
      inspectMacosSigningCertificate(
        certPath,
        "certificate-password",
        "Developer ID Application: Example, Inc. (TEAMID1234)",
        makeOpenSslRunner(["Apple Development: Example, Inc. (TEAMID1234)"]),
      ),
    ).toThrow("The provided .p12 does not contain a Developer ID Application certificate.");
  });

  it("rejects mixed Apple Development and Developer ID exports", () => {
    const certPath = makeTempFile("certificate.p12", "p12");

    expect(() =>
      inspectMacosSigningCertificate(
        certPath,
        "certificate-password",
        "Developer ID Application: Example, Inc. (TEAMID1234)",
        makeOpenSslRunner([
          "Developer ID Application: Example, Inc. (TEAMID1234)",
          "Apple Development: Example, Inc. (TEAMID1234)",
        ]),
      ),
    ).toThrow("The provided .p12 mixes non-release Apple identities");
  });

  it("rejects signing identities that do not match the Developer ID export", () => {
    const certPath = makeTempFile("certificate.p12", "p12");

    expect(() =>
      inspectMacosSigningCertificate(
        certPath,
        "certificate-password",
        "Developer ID Application: Wrong, Inc. (TEAMID9999)",
        makeOpenSslRunner(["Developer ID Application: Example, Inc. (TEAMID1234)"]),
      ),
    ).toThrow("APPLE_SIGNING_IDENTITY does not match the Developer ID identity inside the .p12.");
  });

  it("uploads all six secrets in one run", () => {
    const certPath = makeTempFile("certificate.p12", "p12");
    const commands = [];
    const runner = vi.fn((command, args, options = {}) => {
      commands.push({ command, args, input: options.input ?? "" });
      if (command === "openssl") {
        return {
          status: 0,
          stdout: "",
          stderr: "friendlyName: Developer ID Application: Example, Inc. (TEAMID1234)",
        };
      }
      if (args[0] === "repo" && args[1] === "view") {
        return { status: 0, stdout: "burakdede/aisw-desktop\n", stderr: "" };
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    const stdout = { write: vi.fn() };

    const result = configureMacosSigningSecrets(
      { cert: certPath },
      {
        env: makeEnv(),
        runner,
        stdout,
      },
    );

    expect(result).toEqual({
      dryRun: false,
      environment: "production",
      repo: "burakdede/aisw-desktop",
      secretCount: 6,
      secretNames: [
        "APPLE_CERTIFICATE",
        "APPLE_CERTIFICATE_PASSWORD",
        "APPLE_SIGNING_IDENTITY",
        "APPLE_ID",
        "APPLE_PASSWORD",
        "APPLE_TEAM_ID",
      ],
    });
    expect(commands[0].args).toEqual(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
    expect(commands[1]).toEqual({
      command: "openssl",
      args: [
        "pkcs12",
        "-legacy",
        "-in",
        certPath,
        "-nokeys",
        "-passin",
        "pass:certificate-password",
        "-info",
      ],
      input: "",
    });
    expect(commands[2]).toEqual({
      command: "gh",
      args: [
        "secret",
        "set",
        "APPLE_CERTIFICATE",
        "--repo",
        "burakdede/aisw-desktop",
        "--env",
        "production",
      ],
      input: Buffer.from("p12").toString("base64"),
    });
    expect(commands).toHaveLength(8);
  });

  it("supports a dry run", () => {
    const certPath = makeTempFile("certificate.p12", "p12");
    const runner = vi.fn(() => {
      return {
        status: 0,
        stdout: "",
        stderr: "friendlyName: Developer ID Application: Example, Inc. (TEAMID1234)",
      };
    });
    const stdout = { write: vi.fn() };

    const result = configureMacosSigningSecrets(
      { cert: certPath, dryRun: true, repo: "burakdede/aisw-desktop" },
      {
        env: makeEnv(),
        runner,
        stdout,
      },
    );

    expect(result.dryRun).toBe(true);
    expect(result.secretCount).toBe(6);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(
      "openssl",
      [
        "pkcs12",
        "-legacy",
        "-in",
        certPath,
        "-nokeys",
        "-passin",
        "pass:certificate-password",
        "-info",
      ],
      { encoding: "utf8" },
    );
  });
});
