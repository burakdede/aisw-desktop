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
          "prepare:updater": "node ./scripts/prepare-updater.mjs",
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
  writeFixture(
    root,
    "src-tauri/permissions/desktop-commands.json",
    JSON.stringify(
      {
        permission: [
          {
            identifier: "desktop-commands",
            commands: {
              allow: [
                "get_bootstrap",
                "get_snapshot",
                "get_settings",
                "get_shell_guidance",
                "check_for_updates",
                "install_update",
                "update_settings",
                "run_init",
                "add_profile",
                "add_profile_oauth",
                "use_profile",
                "use_all_profiles",
                "use_context",
                "activate_profile_set",
                "rename_profile",
                "remove_profile",
                "restore_backup",
                "run_doctor",
                "run_verify",
                "run_repair",
                "export_diagnostic_bundle",
                "list_backups",
                "get_workspace_status",
                "get_project_bindings",
                "workspace_bind",
                "workspace_unbind",
                "workspace_guard",
              ],
              deny: [],
            },
          },
        ],
      },
      null,
      2,
    ),
  );
  writeFixture(
    root,
    "src-tauri/capabilities/main.json",
    JSON.stringify(
      {
        identifier: "main-capability",
        windows: ["main"],
        permissions: [
          "desktop-commands",
          "core:event:allow-listen",
          "core:event:allow-unlisten",
          "notification:allow-is-permission-granted",
          "notification:allow-request-permission",
          "notification:allow-notify",
        ],
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
npm run prepare:updater
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
AISW_DESKTOP_UPDATER_ENDPOINT_STABLE
AISW_DESKTOP_UPDATER_ENDPOINT_BETA
TAURI_SIGNING_PUBLIC_KEY
`,
  );
  writeFixture(
    root,
    "docs/desktop-acceptance-matrix.md",
    overrides.acceptanceMatrix ??
      `
This does not replace the local-only product spec.
## Architecture Summary
validates target-compatible binary formats
least-privilege capability
## Acceptance Criteria
API key never appears in logs
## Verification Matrix
npm test
`,
  );
  writeFixture(
    root,
    "docs/release-runbook.md",
    overrides.runbook ??
      `
npm run prepare:sidecar -- /absolute/path/to/aisw
prepare:sidecar validates the binary format against the requested target triple
npm run prepare:updater
npm run tauri:build
npm test
npm run build
npm run test:e2e
npm run verify:release
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
## Platform signing flow
APPLE_SIGNING_IDENTITY
plugins.updater.channels
Confirm notarization completed
Verify the generated installer is code signed
Validate the generated \`.deb\`, \`.rpm\`, and AppImage artifacts
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
        expect.objectContaining({
          ok: true,
          label: "tauri main window capability stays least-privilege",
        }),
        expect.objectContaining({
          ok: true,
          label: "acceptance matrix tracks architecture, security, and verification evidence",
        }),
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
## Platform signing flow
APPLE_SIGNING_IDENTITY
plugins.updater.channels
Confirm notarization completed
Verify the generated installer is code signed
Validate the generated \`.deb\`, \`.rpm\`, and AppImage artifacts
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
npm run prepare:updater
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
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "publish workflow configures updater channels",
        ok: false,
      }),
    );
  });

  it("fails when the Tauri desktop permission surface drifts or broad permissions are reintroduced", () => {
    const root = createReleaseFixture();
    writeFixture(
      root,
      "src-tauri/permissions/desktop-commands.json",
      JSON.stringify(
        {
          permission: [
            {
              identifier: "desktop-commands",
              commands: {
                allow: ["get_bootstrap", "workspace_guard"],
                deny: [],
              },
            },
          ],
        },
        null,
        2,
      ),
    );
    writeFixture(
      root,
      "src-tauri/capabilities/main.json",
      JSON.stringify(
        {
          identifier: "main-capability",
          windows: ["main"],
          permissions: ["desktop-commands", "core:default"],
        },
        null,
        2,
      ),
    );

    const result = verifyReleaseContract(root);
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "tauri desktop permission allowlist matches the registered invoke surface",
        ok: false,
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "tauri main window capability stays least-privilege",
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
## Platform signing flow
APPLE_SIGNING_IDENTITY
plugins.updater.channels
Confirm notarization completed
Verify the generated installer is code signed
Validate the generated \`.deb\`, \`.rpm\`, and AppImage artifacts
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

  it("fails when the acceptance matrix drops the delivery evidence", () => {
    const root = createReleaseFixture({
      acceptanceMatrix: `
## Architecture Summary
## Acceptance Criteria
`,
    });

    const result = verifyReleaseContract(root);
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "acceptance matrix tracks architecture, security, and verification evidence",
        ok: false,
      }),
    );
  });

  it("fails when the runbook drops repeatable signing guidance", () => {
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
        label: "runbook documents repeatable platform signing flows",
        ok: false,
      }),
    );
  });
});
