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
      label: "package.json exposes updater channel staging",
      ok: packageJson.scripts?.["prepare:updater"] === "node ./scripts/prepare-updater.mjs",
    },
    {
      label: "tauri bundles aisw via externalBin",
      ok: Array.isArray(tauriConfig.bundle?.externalBin) && tauriConfig.bundle.externalBin.includes("binaries/aisw"),
    },
    {
      label: "tauri produces updater artifacts for signed desktop releases",
      ok: tauriConfig.bundle?.createUpdaterArtifacts === true,
    },
    {
      label: "tauri declares updater plugin config for bundling",
      ok:
        typeof tauriConfig.plugins?.updater?.pubkey === "string" &&
        tauriConfig.plugins.updater.pubkey.length > 0 &&
        tauriConfig.plugins.updater.channels &&
        typeof tauriConfig.plugins.updater.channels === "object" &&
        Array.isArray(tauriConfig.plugins.updater.endpoints),
    },
    {
      label: "runbook documents sidecar staging",
      ok:
        runbook.includes("npm run prepare:sidecar -- /absolute/path/to/aisw") &&
        runbook.includes("npm run tauri:build") &&
        runbook.includes("npm run prepare:updater"),
    },
    {
      label: "runbook captures verification matrix",
      ok:
        runbook.includes("npm test") &&
        runbook.includes("npm run build") &&
        runbook.includes("npm run test:e2e") &&
        runbook.includes("npm run verify:release") &&
        runbook.includes("cargo test --manifest-path src-tauri/Cargo.toml") &&
        runbook.includes("cargo check --manifest-path src-tauri/Cargo.toml"),
    },
    {
      label: "runbook includes a release checklist",
      ok:
        runbook.includes("## Release checklist") &&
        runbook.includes("Launch the packaged app in `Bundled` mode") &&
        runbook.includes("Switch a profile in the packaged app") &&
        runbook.includes("Complete platform signing checks"),
    },
    {
      label: "runbook documents repeatable platform signing flows",
      ok:
        runbook.includes("## Platform signing flow") &&
        runbook.includes("APPLE_SIGNING_IDENTITY") &&
        runbook.includes("plugins.updater.channels") &&
        runbook.includes("Confirm notarization completed") &&
        runbook.includes("Verify the generated installer is code signed") &&
        runbook.includes("Validate the generated `.deb`, `.rpm`, and AppImage artifacts"),
    },
    {
      label: "CI workflow enforces frontend verification matrix",
      ok:
        ciWorkflow.includes("npm test") &&
        ciWorkflow.includes("npm run test:e2e") &&
        ciWorkflow.includes("npm run build") &&
        ciWorkflow.includes("npm run verify:release"),
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
      label: "publish workflow configures updater channels",
      ok:
        publishWorkflow.includes("npm run prepare:updater") &&
        publishWorkflow.includes("AISW_DESKTOP_UPDATER_ENDPOINT_STABLE") &&
        publishWorkflow.includes("AISW_DESKTOP_UPDATER_ENDPOINT_BETA"),
    },
    {
      label: "publish workflow covers every supported release target",
      ok:
        publishWorkflow.includes("aarch64-apple-darwin") &&
        publishWorkflow.includes("x86_64-apple-darwin") &&
        publishWorkflow.includes("x86_64-unknown-linux-gnu") &&
        publishWorkflow.includes("x86_64-pc-windows-msvc"),
    },
    {
      label: "publish workflow enforces verification matrix",
      ok:
        publishWorkflow.includes("npm test") &&
        publishWorkflow.includes("npm run test:e2e") &&
        publishWorkflow.includes("npm run build") &&
        publishWorkflow.includes("npm run verify:release") &&
        publishWorkflow.includes("cargo test --manifest-path src-tauri/Cargo.toml") &&
        publishWorkflow.includes("cargo check --manifest-path src-tauri/Cargo.toml"),
    },
    {
      label: "publish workflow produces signed Tauri artifacts",
      ok:
        publishWorkflow.includes("tauri-apps/tauri-action@v1") &&
        publishWorkflow.includes("TAURI_SIGNING_PRIVATE_KEY"),
    },
    {
      label: "publish workflow wires target-specific sidecar secrets",
      ok:
        publishWorkflow.includes("AISW_SIDECAR_URL_MACOS_ARM64") &&
        publishWorkflow.includes("AISW_SIDECAR_URL_MACOS_X64") &&
        publishWorkflow.includes("AISW_SIDECAR_URL_LINUX_X64") &&
        publishWorkflow.includes("AISW_SIDECAR_URL_WINDOWS_X64"),
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
