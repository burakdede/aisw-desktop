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

## Request flow

1. React feature panels collect user intent and call typed helpers in `src/lib/client.ts`.
2. The helpers invoke the Tauri command layer through the narrow desktop API wrapper in `src/lib/tauri.ts`.
3. Rust commands delegate to bridge, state, updater, tray, or settings modules under `src-tauri/src/`.
4. The bridge executes the selected `aisw` runtime, normalizes stdout and stderr, and maps failures into structured desktop errors.
5. The frontend invalidates the shared query keys after every mutation so overview, profiles, sets, diagnostics, backups, and activity stay coherent.

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

## Key frontend modules

- `src/App.tsx`
  - top-level routing, cross-screen state handoff, window-wide mutations, and shared overlays
- `src/features/shared/useDesktop.ts`
  - bootstrap, snapshot, and init query orchestration
- `src/features/shared/useDesktopActions.ts`
  - mutation serialization, user-facing result recording, notifications, and post-mutation refresh
- `src/features/shared/lastCommandResult.ts`
  - in-memory plus local-persistence store for recent command results and activity timeline entries
- `src/features/shared/mutationQueue.ts`
  - single-writer mutation queue that pauses nonessential reads while state-changing operations are running

## Key Rust modules

- `src-tauri/src/commands.rs`
  - Tauri command registration and the public desktop invoke surface
- `src-tauri/src/bridge.rs`
  - runtime process execution, JSON parsing, argument shaping, stdin handling, and error normalization
- `src-tauri/src/state.rs`
  - runtime compatibility checks, serialized mutation lock, and app-level state helpers
- `src-tauri/src/tray.rs`
  - native menu construction and tray-triggered mutation dispatch
- `src-tauri/src/updater.rs`
  - updater endpoint validation and signed-update configuration resolution
- `src-tauri/src/redaction.rs`
  - secret scrubbing for command failures and exported diagnostics

## Invariants

- The UI never shells out directly and never reads credential files directly.
- All state-changing runtime calls pass through the serialized mutation queue.
- Runtime compatibility fails closed when required desktop features are missing.
- The invoke surface stays least-privilege and explicit in checked-in capability and permission manifests.
- Errors crossing the Rust/UI boundary must be structured, typed, and safe to display or persist.

## Testing strategy

- Vitest covers UI state, shared stores, query orchestration, parsing helpers, and contributor-facing flows.
- Playwright covers desktop smoke paths against a production preview build rather than the dev HMR server.
- Rust tests cover bridge command shaping, error classification, updater validation, tray behavior, and state locking.
- `scripts/verify-release.mjs` enforces packaging, workflow, permission, and release-contract expectations before publish.

## Design rules

- Keep the invoke surface explicit and reviewable.
- Keep bridge responses typed and normalized before they reach the UI.
- Avoid direct shell mutation from the UI; guidance is allowed, arbitrary execution is not.
- Prefer feature-local code to large cross-cutting view components.
- Treat local security boundaries as part of the product design, not an afterthought.
