# AISW Desktop Release Runbook

## Goal

Produce signed desktop bundles that embed the exact `aisw` binary validated for that OS/architecture.

## Sidecar contract

- Tauri bundles `src-tauri/binaries/aisw-$TARGET_TRIPLE[.exe]` via `externalBin`.
- The desktop bridge resolves bundled binaries only from packaged sidecar locations or explicit desktop overrides.
- `prepare:sidecar` validates the binary format against the requested target triple before staging it and always writes a Windows `.exe` sidecar for Windows targets.
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
- `prepare:sidecar` rejects sidecars whose binary format does not match the requested target triple.
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

## Platform signing flow

### macOS

1. Export signing inputs before running `npm run tauri:build`:
   `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and `TAURI_SIGNING_PUBLIC_KEY`.
2. Configure `plugins.updater.channels` in `src-tauri/tauri.conf.json` for every release channel you intend to ship, or provide `AISW_DESKTOP_UPDATER_ENDPOINT[_CHANNEL]` overrides for a non-production build.
   CI release builds do this with `npm run prepare:updater`.
3. Build with the target-specific sidecar staged:
   `npm run tauri:build`
4. Confirm the build produced a signed `.app`, a signed `.dmg`, and an updater archive plus `.sig`.
5. Confirm notarization completed and the app launches without Gatekeeper warnings on a clean macOS machine.

### Windows

1. Export `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and `TAURI_SIGNING_PUBLIC_KEY`.
2. Configure `plugins.updater.channels` in `src-tauri/tauri.conf.json` for the Windows release channels you publish.
   CI release builds do this with `npm run prepare:updater`.
3. Build the Windows target after staging the matching sidecar.
4. Verify the generated installer is code signed.
5. Install on a clean Windows machine and confirm SmartScreen reputation is the only remaining trust variable.

### Linux

1. Build the Linux target after staging the matching sidecar.
2. Configure `plugins.updater.channels` in `src-tauri/tauri.conf.json` for every Linux release channel you publish.
   CI release builds do this with `npm run prepare:updater`.
3. Validate the generated `.deb`, `.rpm`, and AppImage artifacts on a clean machine or container.
4. Confirm the packaged app resolves the bundled `aisw` sidecar in `Bundled` mode.

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
- `AISW_DESKTOP_UPDATER_ENDPOINT_STABLE`
- `AISW_DESKTOP_UPDATER_ENDPOINT_BETA`
- `TAURI_SIGNING_PUBLIC_KEY`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The private key must match the public key staged into `src-tauri/tauri.conf.json` by `npm run prepare:updater`.
Release channel endpoints and updater public key are staged into `plugins.updater` in `src-tauri/tauri.conf.json`.

Optional signing secrets:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
