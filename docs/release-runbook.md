# AI Switch Desktop Release Runbook

## Goal

Produce signed desktop bundles that embed the exact AI Switch runtime binary validated for that OS/architecture.

## Sidecar contract

- Tauri bundles `src-tauri/binaries/aisw-$TARGET_TRIPLE[.exe]` via `externalBin`.
- The desktop bridge resolves bundled binaries only from packaged sidecar locations or explicit desktop overrides.
- `prepare:sidecar` validates the binary format against the requested target triple before staging it and always writes a Windows `.exe` sidecar for Windows targets.
- `prepare:updater` accepts HTTPS release feeds only and stages them into `plugins.updater.channels` before packaging.
- Sidecar binaries are intentionally not tracked in Git.

## Prepare a local release build

1. Build or obtain the platform-matching AI Switch runtime binary.
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
npm run test:coverage
npm run build
npm run test:e2e
npm run verify:release
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

4. Build the desktop bundle:

```sh
npm run tauri:bundle-local
```

This local smoke-build path keeps the sidecar contract intact but disables updater artifact generation, so it succeeds without `TAURI_SIGNING_PRIVATE_KEY` while still producing a launchable packaged app bundle.
On macOS, if `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` are exported, it now also notarizes and staples the generated `.dmg` so local release candidates match Gatekeeper behavior.

5. Build the signed release bundle after staging updater channels and signing secrets:

```sh
npm run tauri:build
```

## Acceptance criteria

- `prepare:sidecar` writes a target-suffixed binary into `src-tauri/binaries/`.
- `prepare:sidecar` rejects sidecars whose binary format does not match the requested target triple.
- A packaged build contains the AI Switch sidecar for the host target.
- `Bundled` runtime mode reports blocked when no packaged sidecar exists.
- `System` runtime mode resolves the AI Switch runtime from `PATH` without relying on bundled paths.
- The standard frontend and Rust test suites pass before packaging.
- Rust formatting and clippy checks pass before packaging.
- Frontend coverage stays above the enforced Vitest thresholds before packaging.
- CI and publish workflows enforce the same verification matrix used for local release checks.

## Release test cases

- Positive:
  - Prepare a valid host AI Switch runtime binary and confirm `npm run tauri:bundle-local` succeeds without signing secrets.
  - After staging updater channels and signing secrets, confirm `npm run tauri:build` succeeds.
  - Launch the packaged app in `Bundled` mode and confirm runtime status resolves the embedded binary path.
  - Switch a profile from the packaged app and confirm tray state updates immediately.
- Negative:
  - Remove `src-tauri/binaries/aisw-$TARGET_TRIPLE*` and confirm packaged `Bundled` mode reports runtime blocked.
  - Configure `Custom` mode with a missing path and confirm bootstrap shows runtime compatibility issues.
  - Remove the AI Switch runtime from `PATH`, switch to `System` mode, and confirm the app reports that the runtime could not be resolved.

## Signing checklist

- macOS: sign and notarize the app bundle for both Apple Silicon and Intel builds.
- Windows: sign the installer to reduce SmartScreen friction.
- Linux: validate generated `.deb`, `.rpm`, and AppImage artifacts on a clean machine before release.

## Platform signing flow

### macOS

1. Export signing inputs before running `npm run tauri:build`:
   `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and `TAURI_SIGNING_PUBLIC_KEY`.
   The `.p12` must be a clean `Developer ID Application` export matching `APPLE_SIGNING_IDENTITY`.
   Do not upload a mixed export that also contains `Apple Development` or other non-release identities.
2. Configure `plugins.updater.channels` in `src-tauri/tauri.conf.json` for every release channel you intend to ship, or provide `AISW_DESKTOP_UPDATER_ENDPOINT[_CHANNEL]` overrides for a non-production build.
   CI release builds do this with `npm run prepare:updater`.
3. Build with the target-specific sidecar staged:
   `npm run tauri:build`
4. Confirm the build produced a signed `.app`, a signed `.dmg`, and an updater archive plus `.sig`.
5. Confirm notarization completed and the app launches without Gatekeeper warnings on a clean macOS machine.
   Tauri notarizes the `.app`, but Gatekeeper still checks the outer `.dmg`; run `npm run notarize:macos-dmg -- --target <triple>` before shipping any signed DMG that was produced outside the publish workflow.
   At minimum, validate the `.dmg` with `spctl -a -t open --context context:primary-signature -vv`, mount it, then validate the shipped `.app` with `spctl -a -vv` and `xcrun stapler validate`.

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
4. Confirm the packaged app resolves the bundled AI Switch sidecar in `Bundled` mode.

## Release checklist

- Stage the correct AI Switch sidecar for the target with `npm run prepare:sidecar`.
- Pass the standard verification matrix:
  `npm test`, `npm run test:coverage`, `npm run build`, `npm run test:e2e`, `npm run verify:release`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml`.
- Run `npm run tauri:bundle-local` to smoke-test an unsigned local bundle before release signing.
- Build the desktop bundle with `npm run tauri:build`.
- Launch the packaged app in `Bundled` mode and confirm the embedded runtime path resolves in runtime status.
- Switch a profile in the packaged app and confirm the tray summary refreshes immediately.
- Confirm negative runtime cases:
  missing bundled sidecar blocks `Bundled`, missing `PATH` entry blocks `System`, and a missing custom path surfaces compatibility issues.
- Complete platform signing checks:
  notarized macOS bundle, signed Windows installer, and validated Linux package artifacts.

## CI release workflow inputs

The repository workflow at `.github/workflows/publish.yml` publishes through the protected `production` GitHub environment.

Create or refresh that environment with:

```sh
npm run configure:release-secrets -- --repo burakdede/aisw-desktop
```

This helper ensures the `production` GitHub environment exists and then uploads every locally available release secret with `gh secret set --env production`.

The repository workflow expects these required secrets:

- `AISW_SIDECAR_URL_MACOS_ARM64`
- `AISW_SIDECAR_URL_MACOS_X64`
- `AISW_SIDECAR_URL_LINUX_X64`
- `AISW_SIDECAR_URL_WINDOWS_X64`
- `AISW_DESKTOP_UPDATER_ENDPOINT_STABLE`
- `TAURI_SIGNING_PUBLIC_KEY`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The private key must match the public key staged into `src-tauri/tauri.conf.json` by `npm run prepare:updater`.
Release channel endpoints and updater public key are staged into `plugins.updater` in `src-tauri/tauri.conf.json`.
`AISW_DESKTOP_UPDATER_ENDPOINT_BETA` is optional until a separate beta feed exists.

Optional signing secrets:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

macOS signing is opt-in in the GitHub publish workflow.
Set the repository variable `AISW_ENABLE_MACOS_SIGNING=1` only after the uploaded Apple certificate and `APPLE_SIGNING_IDENTITY` refer to the same Developer ID identity.
Until then, private test releases still publish unsigned macOS artifacts alongside signed updater metadata for the other platforms.

The helper reads each secret from either `$SECRET_NAME` or `$SECRET_NAME_FILE`.
That makes it safe to keep multiline values such as `TAURI_SIGNING_PRIVATE_KEY` and `APPLE_CERTIFICATE` in local files instead of shell history.

To upload the macOS signing and notarization secrets in one step with direct CLI flags, run:

```sh
npm run configure:macos-signing -- \
  --repo burakdede/aisw-desktop \
  --cert /absolute/path/to/DeveloperID.p12 \
  --cert-password 'certificate-password' \
  --signing-identity 'Developer ID Application: Example, Inc. (TEAMID1234)' \
  --apple-id 'ship@example.com' \
  --apple-password 'app-specific-password' \
  --team-id 'TEAMID1234'
```

This helper base64-encodes the `.p12` locally and uploads all six Apple secrets to the target GitHub environment.

To avoid leaving secrets in shell history, copy `.env.macos-signing.example` to `.env.macos-signing`, point the `*_FILE` entries at local secret files, then run:

```sh
npm run configure:macos-signing -- \
  --repo burakdede/aisw-desktop \
  --env-file .env.macos-signing
```

Supported env-file keys match the helper inputs:
`APPLE_CERTIFICATE_PATH`, `APPLE_CERTIFICATE_P12`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_CERTIFICATE_PASSWORD_FILE`, `APPLE_SIGNING_IDENTITY`, `APPLE_SIGNING_IDENTITY_FILE`, `APPLE_ID`, `APPLE_ID_FILE`, `APPLE_PASSWORD`, `APPLE_PASSWORD_FILE`, `APPLE_TEAM_ID`, and `APPLE_TEAM_ID_FILE`.
