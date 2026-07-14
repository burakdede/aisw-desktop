# Contributing

## Development setup

1. Install Node.js 20+, Rust stable, and the Tauri 2 system prerequisites for your platform.
2. Install dependencies:

```sh
npm install
```

3. Stage an `aisw` runtime binary for local desktop development:

```sh
npm run prepare:sidecar -- /absolute/path/to/aisw
```

4. Start the desktop app:

```sh
npm run tauri:dev
```

## Verification

Run the same checks expected by CI before opening a pull request:

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

## Change guidelines

- Keep the Tauri invoke surface narrow and update `src-tauri/permissions/desktop-commands.json` when commands change.
- Prefer feature-local React code and shared helpers under `src/features/shared/` over cross-screen duplication.
- Validate desktop bridge payloads at the boundary and keep Rust-to-frontend contracts typed.
- Do not commit staged sidecar binaries, local specs, screenshots, or other machine-specific artifacts.
- Keep UI changes covered by Vitest and add Rust tests when bridge, state, or command behavior changes.

## Pull requests

- Use focused commits with clear messages.
- Include the user-facing impact and the verification commands you ran.
- Call out platform-specific behavior if a change is macOS, Windows, or Linux specific.
