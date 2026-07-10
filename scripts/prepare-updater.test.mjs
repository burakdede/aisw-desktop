import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareUpdaterConfig } from "./prepare-updater.mjs";

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
  const root = mkdtempSync(join(tmpdir(), "aisw-updater-"));
  tempDirs.push(root);
  writeFixture(
    root,
    "src-tauri/tauri.conf.json",
    JSON.stringify(
      {
        plugins: {
          updater: {
            channels: {},
            endpoints: [],
            pubkey: "",
          },
        },
      },
      null,
      2,
    ),
  );
  return root;
}

describe("prepare-updater", () => {
  it("writes configured updater channels into tauri.conf.json", () => {
    const root = createWorkspace();
    const result = prepareUpdaterConfig(root, {
      AISW_DESKTOP_UPDATER_ENDPOINT_STABLE: "https://updates.example.com/stable.json",
      AISW_DESKTOP_UPDATER_ENDPOINT_BETA: "https://updates.example.com/beta.json",
      TAURI_SIGNING_PUBLIC_KEY: "minisign-pubkey",
    });

    expect(result.channels).toEqual({
      stable: "https://updates.example.com/stable.json",
      beta: "https://updates.example.com/beta.json",
    });

    const tauriConfig = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.json"), "utf8"));
    expect(tauriConfig.plugins.updater.channels).toEqual(result.channels);
    expect(tauriConfig.plugins.updater.pubkey).toBe("minisign-pubkey");
  });

  it("fails when no updater channel env vars are provided", () => {
    const root = createWorkspace();
    expect(() =>
      prepareUpdaterConfig(root, {
        TAURI_SIGNING_PUBLIC_KEY: "minisign-pubkey",
      }),
    ).toThrow(
      "Provide at least one AISW_DESKTOP_UPDATER_ENDPOINT_<CHANNEL> value before preparing updater channels.",
    );
  });

  it("fails when the updater public key is missing", () => {
    const root = createWorkspace();
    expect(() =>
      prepareUpdaterConfig(root, {
        AISW_DESKTOP_UPDATER_ENDPOINT_STABLE: "https://updates.example.com/stable.json",
      }),
    ).toThrow(
      "Provide TAURI_SIGNING_PUBLIC_KEY or AISW_DESKTOP_UPDATER_PUBKEY before preparing updater channels.",
    );
  });

  it("fails when a configured updater channel is not HTTPS", () => {
    const root = createWorkspace();
    expect(() =>
      prepareUpdaterConfig(root, {
        AISW_DESKTOP_UPDATER_ENDPOINT_STABLE: "http://updates.example.com/stable.json",
        TAURI_SIGNING_PUBLIC_KEY: "minisign-pubkey",
      }),
    ).toThrow("AISW_DESKTOP_UPDATER_ENDPOINT_STABLE must use https://");
  });
});
