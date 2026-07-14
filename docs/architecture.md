# Architecture

AI Switch Desktop is a local-first Tauri application that provides a native control plane for the `aisw` runtime.

## Stack

- Frontend: React 18, TypeScript, Vite, TanStack Query, Zustand, Zod
- Desktop shell: Tauri 2
- Native layer: Rust
- Runtime integration: bundled or externally selected `aisw` sidecar

## Runtime model

The desktop app does not read provider credential files directly. All credential capture, switching, backup, restore, verification, and repair operations go through the `aisw` runtime.

Runtime sources:

- `Bundled`: packaged sidecar shipped with the app
- `System`: runtime resolved from `PATH`
- `Custom`: explicit user-provided runtime path

## Application layers

1. React UI
   - Screen-level features under `src/features/`
   - Shared desktop hooks and helpers under `src/features/shared/`
   - Reusable UI primitives under `src/components/`
2. Tauri command surface
   - Commands defined in `src-tauri/src/commands.rs`
   - Least-privilege capability in `src-tauri/capabilities/main.json`
   - Explicit desktop command allowlist in `src-tauri/permissions/desktop-commands.json`
3. Rust bridge and state
   - Bridge logic in `src-tauri/src/bridge.rs`
   - App state, settings, tray, updater, and redaction modules isolated by concern
   - Serialized mutation behavior prevents overlapping state-changing runtime calls
4. `aisw` runtime
   - Source of truth for profile state, contexts, backups, verification, and repairs

## Design rules

- Keep the invoke surface explicit and reviewable.
- Keep bridge responses typed and normalized before they reach the UI.
- Avoid direct shell mutation from the UI; guidance is allowed, arbitrary execution is not.
- Prefer feature-local code to large cross-cutting view components.
- Treat local security boundaries as part of the product design, not an afterthought.
