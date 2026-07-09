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

3. Verify application gates:

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
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
