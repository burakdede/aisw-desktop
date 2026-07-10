import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const scriptPath = join(repoRoot, "scripts/prepare-sidecar.mjs");
const tempDirs = [];

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("prepare-sidecar", () => {
  it("copies the source binary into the target-suffixed sidecar path", () => {
    const workspace = mkdtempSync(join(tmpdir(), "aisw-sidecar-"));
    tempDirs.push(workspace);
    const sourcePath = join(workspace, "aisw");
    writeFileSync(sourcePath, "fake aisw");

    const output = execFileSync(
      process.execPath,
      [scriptPath, "--target", "x86_64-apple-darwin", sourcePath],
      {
        cwd: workspace,
        encoding: "utf8",
      },
    ).trim();

    const sidecarPath = join(workspace, "src-tauri/binaries/aisw-x86_64-apple-darwin");
    expect(realpathSync(output)).toBe(realpathSync(sidecarPath));
    expect(readFileSync(sidecarPath, "utf8")).toBe("fake aisw");
    expect(statSync(sidecarPath).mode & 0o777).toBe(0o755);
  });

  it("preserves the windows executable extension", () => {
    const workspace = mkdtempSync(join(tmpdir(), "aisw-sidecar-"));
    tempDirs.push(workspace);
    const sourcePath = join(workspace, "aisw.exe");
    writeFileSync(sourcePath, "fake windows aisw");

    const output = execFileSync(
      process.execPath,
      [scriptPath, "--target", "x86_64-pc-windows-msvc", sourcePath],
      {
        cwd: workspace,
        encoding: "utf8",
      },
    ).trim();

    const sidecarPath = join(workspace, "src-tauri/binaries/aisw-x86_64-pc-windows-msvc.exe");
    expect(realpathSync(output)).toBe(realpathSync(sidecarPath));
    expect(readFileSync(sidecarPath, "utf8")).toBe("fake windows aisw");
  });

  it("accepts source and target from environment variables", () => {
    const workspace = mkdtempSync(join(tmpdir(), "aisw-sidecar-"));
    tempDirs.push(workspace);
    const sourcePath = join(workspace, "aisw");
    writeFileSync(sourcePath, "fake aisw from env");

    const output = execFileSync(process.execPath, [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        AISW_DESKTOP_AISW_SOURCE: sourcePath,
        AISW_DESKTOP_TARGET_TRIPLE: "aarch64-apple-darwin",
      },
    }).trim();

    const sidecarPath = join(workspace, "src-tauri/binaries/aisw-aarch64-apple-darwin");
    expect(realpathSync(output)).toBe(realpathSync(sidecarPath));
    expect(readFileSync(sidecarPath, "utf8")).toBe("fake aisw from env");
  });

  it("fails with a helpful message when no source binary is provided", () => {
    const workspace = mkdtempSync(join(tmpdir(), "aisw-sidecar-"));
    tempDirs.push(workspace);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
      env: process.env,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Provide an aisw binary path as the first argument or AISW_DESKTOP_AISW_SOURCE.",
    );
  });
});
