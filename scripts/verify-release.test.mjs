import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { expectedDesktopCommands, verifyReleaseContract } from "./verify-release.mjs";

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
          "tauri:bundle-local": "node ./scripts/build-local-bundle.mjs",
          "prepare:sidecar": "node ./scripts/prepare-sidecar.mjs",
          "prepare:updater": "node ./scripts/prepare-updater.mjs",
          "configure:release-secrets": "node ./scripts/configure-release-secrets.mjs",
          "test:coverage": "vitest run --coverage",
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
              allow: expectedDesktopCommands,
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
  npm run test:coverage
  npm run test:e2e
  npm run build
  npm run verify:release
  cargo fmt --manifest-path src-tauri/Cargo.toml --check
  cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
  cargo test --manifest-path src-tauri/Cargo.toml
  cargo check --manifest-path src-tauri/Cargo.toml
runs-on: \${{ matrix.platform }}
strategy:
  matrix:
    platform:
      - macos-latest
      - ubuntu-22.04
      - windows-latest
node-version: 20.19.0
`,
  );
  writeFixture(
    root,
    ".github/workflows/publish.yml",
    overrides.publishWorkflow ??
      `
environment:
  name: production
Download aisw sidecar
npm run prepare:sidecar -- --target \${{ matrix.target }} "\${{ runner.temp }}/aisw"
npm run prepare:updater
npm test
npm run test:coverage
npm run test:e2e
npm run build
npm run verify:release
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
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
TAURI_SIGNING_PUBLIC_KEY
node-version: 20.19.0
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
Remediation actions land on targeted settings guidance
Guided OAuth capture shows a stable five-step desktop wizard
Editable state-mode choices explain isolated versus shared behavior
Missing-tool diagnostics support install guidance and in-place refresh
Tray result messaging uses the same saved labels as tray menus
Inactive profile details do not reuse live runtime diagnostics
Routed profile details reset when the user switches tools manually
Manual sidebar navigation clears stale routed profile and settings targets
Backup restore warnings and confirmations use saved profile labels
CLI context activation results prefer matching saved profile-set labels
In-window switch results prefer saved profile labels over raw ids
Nonessential onboarding and settings reads pause while mutations are running
CLI context lists prefer saved profile-set labels while preserving raw context ids
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
npm run tauri:bundle-local
npm run prepare:updater
npm run configure:release-secrets
npm run tauri:build
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run verify:release
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
## Platform signing flow
APPLE_SIGNING_IDENTITY
plugins.updater.channels
Confirm notarization completed
Verify the generated installer is code signed
Validate the generated \`.deb\`, \`.rpm\`, and AppImage artifacts
Use the \`production\` GitHub environment with gh secret set.
## Release checklist
Run \`npm run tauri:bundle-local\` to smoke-test an unsigned local bundle
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
        expect.objectContaining({
          ok: true,
          label: "publish workflow requires the protected production environment",
        }),
        expect.objectContaining({
          ok: true,
          label: "package.json exposes release secret provisioning",
        }),
        expect.objectContaining({ ok: true, label: "publish workflow covers every supported release target" }),
        expect.objectContaining({
          ok: true,
          label: "CI workflow keeps cross-platform desktop smoke coverage",
        }),
        expect.objectContaining({
          ok: true,
          label: "tauri main window capability stays least-privilege",
        }),
        expect.objectContaining({
          ok: true,
          label: "acceptance matrix tracks architecture, security, and verification evidence",
        }),
        expect.objectContaining({
          ok: true,
          label: "runbook documents protected environment secret provisioning",
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
npm run tauri:bundle-local
npm run tauri:build
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run verify:release
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
## Platform signing flow
APPLE_SIGNING_IDENTITY
plugins.updater.channels
Confirm notarization completed
Verify the generated installer is code signed
Validate the generated \`.deb\`, \`.rpm\`, and AppImage artifacts
## Release checklist
Run \`npm run tauri:bundle-local\` to smoke-test an unsigned local bundle
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
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "publish workflow requires the protected production environment",
        ok: false,
      }),
    );
  });

  it("fails when the CI workflow drops required desktop platforms", () => {
    const root = createReleaseFixture({
      ciWorkflow: `
run: |
  npm test
  npm run test:e2e
  npm run build
  npm run verify:release
  cargo test --manifest-path src-tauri/Cargo.toml
  cargo check --manifest-path src-tauri/Cargo.toml
runs-on: ubuntu-22.04
`,
    });

    const result = verifyReleaseContract(root);
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "CI workflow keeps cross-platform desktop smoke coverage",
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

  it("fails when staged updater endpoints are not HTTPS", () => {
    const root = createReleaseFixture();
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
                stable: "http://updates.example.com/stable.json",
              },
              endpoints: ["http://updates.example.com/fallback.json"],
              pubkey: "minisign-pubkey",
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
        label: "tauri updater endpoints stay HTTPS-only",
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
npm run tauri:bundle-local
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
npm run tauri:bundle-local
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

  it("fails when the repo drops the local bundle smoke-build path", () => {
    const root = createReleaseFixture();
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

    const result = verifyReleaseContract(root);
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "package.json exposes local unsigned bundle smoke build",
        ok: false,
      }),
    );
  });

  it("fails when the repo drops release secret provisioning or environment runbook guidance", () => {
    const root = createReleaseFixture({
      runbook: `
npm run prepare:sidecar -- /absolute/path/to/aisw
npm run tauri:bundle-local
npm run prepare:updater
npm run tauri:build
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run verify:release
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
## Platform signing flow
APPLE_SIGNING_IDENTITY
plugins.updater.channels
Confirm notarization completed
Verify the generated installer is code signed
Validate the generated \`.deb\`, \`.rpm\`, and AppImage artifacts
## Release checklist
Run \`npm run tauri:bundle-local\` to smoke-test an unsigned local bundle
Launch the packaged app in \`Bundled\` mode
Switch a profile in the packaged app
Complete platform signing checks
`,
    });
    writeFixture(
      root,
      "package.json",
      JSON.stringify(
        {
          scripts: {
            "tauri:bundle-local": "node ./scripts/build-local-bundle.mjs",
            "prepare:sidecar": "node ./scripts/prepare-sidecar.mjs",
            "prepare:updater": "node ./scripts/prepare-updater.mjs",
            "test:coverage": "vitest run --coverage",
            "tauri:build": "tauri build",
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
        label: "package.json exposes release secret provisioning",
        ok: false,
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        label: "runbook documents protected environment secret provisioning",
        ok: false,
      }),
    );
  });
});
