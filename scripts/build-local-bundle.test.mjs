import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLocalBundleInvocation, createLocalBundleConfig, runLocalBundleBuild } from "./build-local-bundle.mjs";

const tempDirs = [];

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

function writeFixture(root, relativePath, contents) {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function createWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "aisw-local-bundle-"));
  tempDirs.push(root);
  writeFixture(
    root,
    "src-tauri/tauri.conf.json",
    JSON.stringify(
      {
        bundle: {
          createUpdaterArtifacts: true,
          externalBin: ["binaries/aisw"],
        },
        plugins: {
          updater: {
            channels: {
              stable: "https://updates.example.com/stable.json",
            },
            endpoints: ["https://updates.example.com/stable.json"],
            pubkey: "minisign-pubkey",
          },
        },
      },
      null,
      2,
    ),
  );
  return root;
}

describe("build-local-bundle", () => {
  it("disables updater artifact generation for local bundle smoke builds", () => {
    const root = createWorkspace();
    const config = createLocalBundleConfig(root);
    expect(config.bundle.createUpdaterArtifacts).toBe(false);
    expect(config.bundle.externalBin).toEqual(["binaries/aisw"]);
    expect(config.plugins.updater.channels).toEqual({
      stable: "https://updates.example.com/stable.json",
    });
  });

  it("writes a temporary config override and forwards extra tauri args", () => {
    const root = createWorkspace();
    const invocation = buildLocalBundleInvocation(root, ["--debug", "--bundles", "app"]);
    const tempConfig = JSON.parse(readFileSync(invocation.configPath, "utf8"));

    expect(invocation.args).toEqual([
      "tauri",
      "build",
      "--config",
      invocation.configPath,
      "--debug",
      "--bundles",
      "app",
    ]);
    expect(tempConfig.bundle.createUpdaterArtifacts).toBe(false);

    invocation.cleanup();
    expect(existsSync(invocation.configPath)).toBe(false);
  });

  it("cleans up the temporary config after invoking tauri build", () => {
    const root = createWorkspace();
    const spawn = vi.fn().mockReturnValue({ status: 0 });

    const status = runLocalBundleBuild(root, ["--bundles", "app"], spawn);

    expect(status).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawn.mock.calls[0];
    expect(command).toMatch(/npx(?:\.cmd)?$/);
    expect(args.slice(0, 3)).toEqual(["tauri", "build", "--config"]);
    expect(args.slice(4)).toEqual(["--bundles", "app"]);
    expect(options).toMatchObject({ cwd: root, stdio: "inherit" });
    expect(existsSync(args[3])).toBe(false);
  });

  it("notarizes local macOS dmg outputs after a successful build when credentials exist", () => {
    const root = createWorkspace();
    const dmgDir = resolve(root, "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg");
    mkdirSync(dmgDir, { recursive: true });
    writeFixture(root, "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/AI Switcher.dmg", "dmg");

    const spawn = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 });

    const originalEnv = {
      APPLE_ID: process.env.APPLE_ID,
      APPLE_PASSWORD: process.env.APPLE_PASSWORD,
      APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
    };

    process.env.APPLE_ID = "ship@example.com";
    process.env.APPLE_PASSWORD = "app-password";
    process.env.APPLE_TEAM_ID = "TEAMID1234";

    try {
      const status = runLocalBundleBuild(root, ["--target", "aarch64-apple-darwin"], spawn, "darwin");
      expect(status).toBe(0);
      expect(spawn).toHaveBeenCalledTimes(4);
      expect(spawn.mock.calls[1][0]).toBe("xcrun");
      expect(spawn.mock.calls[2][1]).toEqual([
        "stapler",
        "staple",
        resolve(dmgDir, "AI Switcher.dmg"),
      ]);
      expect(spawn.mock.calls[3][0]).toBe("spctl");
    } finally {
      if (originalEnv.APPLE_ID === undefined) {
        delete process.env.APPLE_ID;
      } else {
        process.env.APPLE_ID = originalEnv.APPLE_ID;
      }
      if (originalEnv.APPLE_PASSWORD === undefined) {
        delete process.env.APPLE_PASSWORD;
      } else {
        process.env.APPLE_PASSWORD = originalEnv.APPLE_PASSWORD;
      }
      if (originalEnv.APPLE_TEAM_ID === undefined) {
        delete process.env.APPLE_TEAM_ID;
      } else {
        process.env.APPLE_TEAM_ID = originalEnv.APPLE_TEAM_ID;
      }
    }
  });
});
