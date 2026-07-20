import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasMacosNotarizationCredentials,
  notarizeMacosDmgs,
  resolveDmgDirectory,
  resolveTauriTarget,
} from "./notarize-macos-dmgs.mjs";

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
  const root = mkdtempSync(join(tmpdir(), "aisw-notarize-dmg-"));
  tempDirs.push(root);
  return root;
}

describe("notarize-macos-dmgs", () => {
  it("resolves the tauri target triple and dmg directory", () => {
    const root = createWorkspace();

    expect(resolveTauriTarget(["--target", "aarch64-apple-darwin", "--bundles", "dmg"])).toBe(
      "aarch64-apple-darwin",
    );
    expect(resolveTauriTarget(["--bundles", "dmg"])).toBeNull();
    expect(resolveDmgDirectory(root, ["--target", "aarch64-apple-darwin"])).toBe(
      resolve(root, "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg"),
    );
    expect(resolveDmgDirectory(root, [])).toBe(resolve(root, "src-tauri/target/release/bundle/dmg"));
  });

  it("detects when Apple notarization credentials are fully configured", () => {
    expect(
      hasMacosNotarizationCredentials({
        APPLE_ID: "ship@example.com",
        APPLE_PASSWORD: "app-password",
        APPLE_TEAM_ID: "TEAMID1234",
      }),
    ).toBe(true);
    expect(
      hasMacosNotarizationCredentials({
        APPLE_ID: "ship@example.com",
        APPLE_PASSWORD: "",
        APPLE_TEAM_ID: "TEAMID1234",
      }),
    ).toBe(false);
  });

  it("skips dmg notarization when not running on macOS or credentials are absent", () => {
    const root = createWorkspace();
    const spawn = vi.fn();

    expect(notarizeMacosDmgs(root, [], spawn, {}, "linux")).toBeUndefined();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("notarizes and staples dmg artifacts when Apple credentials are present on macOS", () => {
    const root = createWorkspace();
    const dmgDir = resolve(root, "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg");
    writeFixture(root, "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/AI Switcher.dmg", "dmg");

    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const env = {
      APPLE_ID: "ship@example.com",
      APPLE_PASSWORD: "app-password",
      APPLE_TEAM_ID: "TEAMID1234",
    };

    expect(notarizeMacosDmgs(root, ["--target", "aarch64-apple-darwin"], spawn, env, "darwin")).toBe(0);
    expect(spawn.mock.calls).toEqual([
      [
        "xcrun",
        [
          "notarytool",
          "submit",
          resolve(dmgDir, "AI Switcher.dmg"),
          "--apple-id",
          "ship@example.com",
          "--password",
          "app-password",
          "--team-id",
          "TEAMID1234",
          "--wait",
        ],
        { cwd: root, stdio: "inherit" },
      ],
      [
        "xcrun",
        ["stapler", "staple", resolve(dmgDir, "AI Switcher.dmg")],
        { cwd: root, stdio: "inherit" },
      ],
      [
        "spctl",
        ["-a", "-t", "open", "--context", "context:primary-signature", "-vv", resolve(dmgDir, "AI Switcher.dmg")],
        { cwd: root, stdio: "inherit" },
      ],
    ]);
  });
});
