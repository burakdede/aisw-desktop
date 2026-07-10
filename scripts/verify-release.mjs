import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

export function verifyReleaseContract(rootDir = repoRoot) {
  const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
  const tauriConfig = JSON.parse(readFileSync(resolve(rootDir, "src-tauri/tauri.conf.json"), "utf8"));
  const ciWorkflow = readFileSync(resolve(rootDir, ".github/workflows/ci.yml"), "utf8");
  const publishWorkflow = readFileSync(resolve(rootDir, ".github/workflows/publish.yml"), "utf8");
  const runbook = readFileSync(resolve(rootDir, "docs/release-runbook.md"), "utf8");

  const checks = [
    {
      label: "package.json exposes tauri build",
      ok: packageJson.scripts?.["tauri:build"] === "tauri build",
    },
    {
      label: "package.json exposes sidecar staging",
      ok: packageJson.scripts?.["prepare:sidecar"] === "node ./scripts/prepare-sidecar.mjs",
    },
    {
      label: "tauri bundles aisw via externalBin",
      ok: Array.isArray(tauriConfig.bundle?.externalBin) && tauriConfig.bundle.externalBin.includes("binaries/aisw"),
    },
    {
      label: "runbook documents sidecar staging",
      ok:
        runbook.includes("npm run prepare:sidecar -- /absolute/path/to/aisw") &&
        runbook.includes("npm run tauri:build"),
    },
    {
      label: "runbook captures verification matrix",
      ok:
        runbook.includes("npm test") &&
        runbook.includes("npm run build") &&
        runbook.includes("npm run test:e2e") &&
        runbook.includes("cargo test --manifest-path src-tauri/Cargo.toml") &&
        runbook.includes("cargo check --manifest-path src-tauri/Cargo.toml"),
    },
    {
      label: "CI workflow enforces frontend verification matrix",
      ok:
        ciWorkflow.includes("npm test") &&
        ciWorkflow.includes("npm run test:e2e") &&
        ciWorkflow.includes("npm run build"),
    },
    {
      label: "CI workflow enforces Rust verification matrix",
      ok:
        ciWorkflow.includes("cargo test --manifest-path src-tauri/Cargo.toml") &&
        ciWorkflow.includes("cargo check --manifest-path src-tauri/Cargo.toml"),
    },
    {
      label: "publish workflow stages a target-specific sidecar",
      ok:
        publishWorkflow.includes("npm run prepare:sidecar -- --target ${{ matrix.target }}") &&
        publishWorkflow.includes("Download aisw sidecar"),
    },
    {
      label: "publish workflow enforces verification matrix",
      ok:
        publishWorkflow.includes("npm test") &&
        publishWorkflow.includes("npm run test:e2e") &&
        publishWorkflow.includes("npm run build") &&
        publishWorkflow.includes("cargo test --manifest-path src-tauri/Cargo.toml") &&
        publishWorkflow.includes("cargo check --manifest-path src-tauri/Cargo.toml"),
    },
    {
      label: "publish workflow produces signed Tauri artifacts",
      ok:
        publishWorkflow.includes("tauri-apps/tauri-action@v1") &&
        publishWorkflow.includes("TAURI_SIGNING_PRIVATE_KEY"),
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyReleaseContract();
  result.checks.forEach((check) => {
    process.stdout.write(`${check.ok ? "PASS" : "FAIL"} ${check.label}\n`);
  });
  if (!result.ok) {
    process.exitCode = 1;
  }
}
