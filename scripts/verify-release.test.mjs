import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyReleaseContract } from "./verify-release.mjs";

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

function createReleaseFixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "aisw-release-"));
  tempDirs.push(root);

  writeFixture(
    root,
    "package.json",
    JSON.stringify(
      {
        scripts: {
          "prepare:sidecar": "node ./scripts/prepare-sidecar.mjs",
          "tauri:build": "tauri build",
        },
      },
      null,
      2,
    ),
  );
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
            endpoints: [],
            pubkey:
              "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDYyMjc5RjUwRkFBNUEwQzcKUldUSG9LWDZVSjhuWWdMQWE4WDFhMGV5QnBxek5Gd3VHU2VXdG52ZlVHY3YxYzN0WjVBVjNDZkEK",
          },
        },
      },
      null,
      2,
    ),
  );
  writeFixture(
    root,
    ".github/workflows/ci.yml",
    overrides.ciWorkflow ??
      `
run: |
  npm test
  npm run test:e2e
  npm run build
  npm run verify:release
  cargo test --manifest-path src-tauri/Cargo.toml
  cargo check --manifest-path src-tauri/Cargo.toml
`,
  );
  writeFixture(
    root,
    ".github/workflows/publish.yml",
    overrides.publishWorkflow ??
      `
Download aisw sidecar
npm run prepare:sidecar -- --target \${{ matrix.target }} "\${{ runner.temp }}/aisw"
npm test
npm run test:e2e
npm run build
npm run verify:release
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
tauri-apps/tauri-action@v1
TAURI_SIGNING_PRIVATE_KEY
aarch64-apple-darwin
x86_64-apple-darwin
x86_64-unknown-linux-gnu
x86_64-pc-windows-msvc
AISW_SIDECAR_URL_MACOS_ARM64
AISW_SIDECAR_URL_MACOS_X64
AISW_SIDECAR_URL_LINUX_X64
AISW_SIDECAR_URL_WINDOWS_X64
`,
  );
  writeFixture(
    root,
    "docs/release-runbook.md",
    overrides.runbook ??
      `
npm run prepare:sidecar -- /absolute/path/to/aisw
npm run tauri:build
npm test
npm run build
npm run test:e2e
npm run verify:release
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
## Release checklist
Launch the packaged app in \`Bundled\` mode
Switch a profile in the packaged app
Complete platform signing checks
`,
  );

  return root;
}

describe("verify-release", () => {
  it("passes when release contract files stay aligned", () => {
    const root = createReleaseFixture();
    expect(verifyReleaseContract(root)).toEqual({
      ok: true,
      checks: expect.arrayContaining([
        expect.objectContaining({ ok: true, label: "publish workflow enforces verification matrix" }),
        expect.objectContaining({ ok: true, label: "publish workflow covers every supported release target" }),
      ]),
    });
  });

  it("fails when the publish workflow stops enforcing release checks", () => {
    const root = createReleaseFixture({
      publishWorkflow: `
Download aisw sidecar
npm run prepare:sidecar -- --target \${{ matrix.target }} "\${{ runner.temp }}/aisw"
tauri-apps/tauri-action@v1
TAURI_SIGNING_PRIVATE_KEY
`,
      runbook: `
npm run prepare:sidecar -- /absolute/path/to/aisw
npm run tauri:build
npm test
npm run build
npm run test:e2e
npm run verify:release
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
## Release checklist
Launch the packaged app in \`Bundled\` mode
Switch a profile in the packaged app
Complete platform signing checks
`,
    });
    const result = verifyReleaseContract(root);
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "publish workflow enforces verification matrix",
        ok: false,
      }),
    );
  });

  it("fails when updater config, artifacts, or release targets drift out of the contract", () => {
    const root = createReleaseFixture({
      publishWorkflow: `
Download aisw sidecar
npm run prepare:sidecar -- --target \${{ matrix.target }} "\${{ runner.temp }}/aisw"
npm test
npm run test:e2e
npm run build
npm run verify:release
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
tauri-apps/tauri-action@v1
TAURI_SIGNING_PRIVATE_KEY
aarch64-apple-darwin
x86_64-apple-darwin
x86_64-unknown-linux-gnu
AISW_SIDECAR_URL_MACOS_ARM64
AISW_SIDECAR_URL_MACOS_X64
AISW_SIDECAR_URL_LINUX_X64
`,
    });
    writeFixture(
      root,
      "src-tauri/tauri.conf.json",
      JSON.stringify(
        {
          bundle: {
            createUpdaterArtifacts: false,
            externalBin: ["binaries/aisw"],
          },
          plugins: {
            updater: {
              endpoints: [],
              pubkey: "",
            },
          },
        },
        null,
        2,
      ),
    );

    const result = verifyReleaseContract(root);
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "tauri produces updater artifacts for signed desktop releases",
        ok: false,
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "tauri declares updater plugin config for bundling",
        ok: false,
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "publish workflow covers every supported release target",
        ok: false,
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "publish workflow wires target-specific sidecar secrets",
        ok: false,
      }),
    );
  });

  it("fails when the runbook drops the explicit release checklist", () => {
    const root = createReleaseFixture({
      runbook: `
npm run prepare:sidecar -- /absolute/path/to/aisw
npm run tauri:build
npm test
npm run build
npm run test:e2e
npm run verify:release
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
`,
    });
    const result = verifyReleaseContract(root);
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "runbook includes a release checklist",
        ok: false,
      }),
    );
  });
});
