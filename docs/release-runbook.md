# AISW Desktop Release Runbook

## Goal

Produce signed desktop bundles that embed the exact `aisw` binary validated for that OS/architecture.

## Sidecar contract

- Tauri bundles `src-tauri/binaries/aisw-$TARGET_TRIPLE[.exe]` via `externalBin`.
- The desktop bridge resolves bundled binaries only from packaged sidecar locations or explicit desktop overrides.
- Sidecar binaries are intentionally not tracked in Git.

## Prepare a local release build

1. Build or obtain the platform-matching `aisw` binary.
2. Stage it for Tauri:

```sh
npm run prepare:sidecar -- /absolute/path/to/aisw
```

To stage a binary for a non-host target triple during CI or cross-compilation:

```sh
npm run prepare:sidecar -- --target x86_64-apple-darwin /absolute/path/to/aisw
```

3. Verify application gates:

```sh
npm test
npm run build
npm run test:e2e
npm run verify:release
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

4. Build the desktop bundle:

```sh
npm run tauri:build
```

## Acceptance criteria

- `prepare:sidecar` writes a target-suffixed binary into `src-tauri/binaries/`.
- A packaged build contains an `aisw` sidecar for the host target.
- `Bundled` runtime mode reports blocked when no packaged sidecar exists.
- `System` runtime mode resolves `aisw` from `PATH` without relying on bundled paths.
- The standard frontend and Rust test suites pass before packaging.
- CI and publish workflows enforce the same verification matrix used for local release checks.

## Release test cases

- Positive:
  - Prepare a valid host `aisw` binary and confirm `npm run tauri:build` succeeds.
  - Launch the packaged app in `Bundled` mode and confirm runtime status resolves the embedded binary path.
  - Switch a profile from the packaged app and confirm tray state updates immediately.
- Negative:
  - Remove `src-tauri/binaries/aisw-$TARGET_TRIPLE*` and confirm packaged `Bundled` mode reports runtime blocked.
  - Configure `Custom` mode with a missing path and confirm bootstrap shows runtime compatibility issues.
  - Remove `aisw` from `PATH`, switch to `System` mode, and confirm the app reports `aisw` could not be resolved.

## Signing checklist

- macOS: sign and notarize the app bundle for both Apple Silicon and Intel builds.
- Windows: sign the installer to reduce SmartScreen friction.
- Linux: validate generated `.deb`, `.rpm`, and AppImage artifacts on a clean machine before release.

## Release checklist

- Stage the correct `aisw` sidecar for the target with `npm run prepare:sidecar`.
- Pass the standard verification matrix:
  `npm test`, `npm run build`, `npm run test:e2e`, `npm run verify:release`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml`.
- Build the desktop bundle with `npm run tauri:build`.
- Launch the packaged app in `Bundled` mode and confirm the embedded `aisw` path resolves in runtime status.
- Switch a profile in the packaged app and confirm the tray summary refreshes immediately.
- Confirm negative runtime cases:
  missing bundled sidecar blocks `Bundled`, missing `PATH` entry blocks `System`, and a missing custom path surfaces compatibility issues.
- Complete platform signing checks:
  notarized macOS bundle, signed Windows installer, and validated Linux package artifacts.

## CI release workflow inputs

The repository workflow at `.github/workflows/publish.yml` expects these secrets:

- `AISW_SIDECAR_URL_MACOS_ARM64`
- `AISW_SIDECAR_URL_MACOS_X64`
- `AISW_SIDECAR_URL_LINUX_X64`
- `AISW_SIDECAR_URL_WINDOWS_X64`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The private key must match the updater public key committed in `src-tauri/tauri.conf.json`.

Optional signing secrets:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
