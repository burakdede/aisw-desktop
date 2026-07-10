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
          externalBin: ["binaries/aisw"],
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
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
tauri-apps/tauri-action@v1
TAURI_SIGNING_PRIVATE_KEY
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
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
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
});
