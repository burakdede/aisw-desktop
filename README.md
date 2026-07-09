# AISW Desktop

AISW Desktop is a Tauri 2 + Rust + React/TypeScript desktop control plane for `aisw`.

## Current scope

- Bundled/system/custom `aisw` runtime selection
- Typed Rust bridge for `aisw` JSON contracts
- Desktop bootstrap and compatibility gating
- Overview, profiles, contexts, diagnostics, backups, and settings screens
- Local settings persistence
- Mutation queue on the Rust side
- Frontend schema validation with Zod

## Commands

```sh
npm install
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## Notes

- The local product spec file is intentionally ignored and not tracked in Git.
- The desktop app treats `aisw` as the source of truth and does not parse provider auth files directly.
