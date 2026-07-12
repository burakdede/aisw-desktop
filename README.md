# AI Switch Desktop

AI Switch Desktop is a Tauri 2 + Rust + React/TypeScript desktop control plane for the AI Switch CLI and bundled switching engine.

## Current scope

- Bundled/system/custom switching engine selection
- Bundled AI Switch sidecar packaging via Tauri `externalBin`
- Typed Rust bridge for AI Switch JSON contracts
- Desktop bootstrap and compatibility gating
- Overview, profiles, contexts, diagnostics, backups, and settings screens
- Local settings persistence
- Mutation queue on the Rust side
- Frontend schema validation with Zod

## Commands

```sh
npm install
npm run prepare:sidecar -- /absolute/path/to/aisw
npm run tauri:dev
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

## Real-app testing

For local macOS testing, use the bundled desktop window instead of the browser-only Vite server:

```sh
npm install
npm run prepare:sidecar -- /absolute/path/to/aisw
npm run tauri:dev
```

That starts the Vite frontend and the Tauri desktop shell together. For the current codebase, this is the primary way to exercise onboarding, set switching, project rules, tray behavior, diagnostics, and settings in the real app.

## Notes

- The local product spec file is intentionally ignored and not tracked in Git.
- The tracked delivery architecture, acceptance criteria, and verification plan live in `docs/desktop-delivery-plan.md`.
- The desktop app treats the bundled AI Switch engine as the source of truth and does not parse provider auth files directly.
- Sidecar binaries are staged into `src-tauri/binaries/` and intentionally remain untracked.
- Release-specific build and verification steps live in `docs/release-runbook.md`.
