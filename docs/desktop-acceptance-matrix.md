# AISW Desktop Acceptance Matrix

This document tracks the shipped desktop architecture, acceptance criteria, and verification evidence for this repository. It intentionally complements `docs/desktop-delivery-plan.md` and does not replace the local-only product spec kept out of Git.

## Architecture Summary

### Runtime model

- The desktop app defaults to a bundled `aisw` sidecar and can switch to system or custom runtimes through Settings.
- Sidecar staging validates target-compatible binary formats before release packaging.
- The Rust bridge is the only layer that executes `aisw` commands.
- The frontend consumes typed JSON responses validated at the boundary.

### Trust boundary

- `aisw` remains the single source of truth for profile state, switching, rollback, backups, keyring behavior, and tool-specific auth handling.
- The desktop frontend never reads provider credential files directly.
- API keys are submitted through stdin-backed desktop commands and cleared from UI state immediately after submission.

### Desktop shell constraints

- The Tauri main window is bound to an explicit least-privilege capability under `src-tauri/capabilities/main.json`.
- The app invoke surface is enumerated in `src-tauri/permissions/desktop-commands.json`.
- OAuth progress uses event listeners only; desktop notifications use the narrow notification permission set only.
- Tray-triggered mutations use the same post-mutation refresh contract as in-window actions, so overview, diagnostics, workspaces, backups, and bootstrap-derived state stay coherent.

## Acceptance Criteria

### 1. Existing Claude login can be imported as a named profile

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers onboarding import and diagnostics import flows.
  - `src/App.test.tsx` covers add-profile flows and post-refresh state.

### 2. Existing Codex login can be imported as a named profile

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers onboarding import and first-switch setup.
  - `src/App.test.tsx` covers import mutation payloads and refreshed snapshots.

### 3. Existing Gemini login can be imported as a named profile

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers onboarding import and Gemini state-mode constraints.
  - `src/App.test.tsx` covers invalid shared-mode prevention and onboarding state.

### 4. Switching one tool updates `status --json`

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers overview switching, tray switching, and post-switch refresh behavior.
  - `src/App.test.tsx` asserts invalidation and refreshed state after tool mutations.

### 5. Switching all tools to `work` updates all matching active profiles

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers onboarding first switch, overview shared switching, and context/profile-set activation.
  - `src/App.test.tsx` covers switch-all mutation serialization and refresh behavior.

### 6. Live mismatch is detected and offers re-apply/import-current actions

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers live mismatch cards in overview and diagnostics plus direct-fix flows.
  - `src/App.test.tsx` covers mismatch rendering and command dispatch.

### 7. Missing binary renders actionable install/PATH guidance

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers onboarding blockers, diagnostics install guidance, updater remediation, and runtime compatibility failures.
  - `src/App.test.tsx` covers missing-tool and invalid-runtime render states.

### 8. API key never appears in logs, frontend devtools state, or backend traces

- Status: implemented
- Evidence:
  - `src/App.test.tsx` verifies API keys are cleared from the field and not stored in React Query mutation variables.
  - `src-tauri/src/bridge.rs` verifies API-key profile creation uses `--api-key-stdin` and never serializes the secret into CLI args.
  - `src-tauri/src/redaction.rs` and bridge failure tests verify stderr redaction for known token families.

### 9. Failed switch rolls back through `aisw`; UI refresh shows previous valid state

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers failed switch-all rollback and stale-profile re-apply failures with refreshed previous state.
  - `src/App.test.tsx` covers mutation result recording and state invalidation on failure.

### 10. Backup restore flow warns that restore does not activate until `use` is run

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers restore-only and restore-then-activate flows, warning copy, and latest-backup restore actions.
  - `src/App.test.tsx` covers restore confirmation and post-action refresh behavior.

### 11. Tray mutations refresh dependent desktop surfaces

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` covers tray-triggered refresh of overview, workspaces, and backups.
  - `src/App.test.tsx` covers tray-result invalidation across snapshot, workspace, bindings, and backup queries.

### 12. Backend init cannot race with desktop mutations

- Status: implemented
- Evidence:
  - `src-tauri/src/state.rs` serializes init, CLI mutations, profile-set activation, and bridge-backed write commands through a shared mutation lock.
  - `src-tauri/src/state.rs` includes a concurrency test proving later operations cannot enter the critical section before the active mutation exits.

### 13. Remediation actions land on targeted settings guidance

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` verifies onboarding and diagnostics remediation actions open the correct shell/keyring settings section.
  - `src/App.test.tsx` verifies focused settings shortcuts are selected for shell-hook and keyring remediation flows.

### 14. Guided OAuth capture shows a stable five-step desktop wizard

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` verifies the OAuth capture flow renders the fixed five-step wizard and streams inline progress details.
  - `src/App.test.tsx` verifies OAuth progress events are normalized into the desktop wizard contract even when the upstream event stream varies.

### 15. Editable state-mode choices explain isolated versus shared behavior

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` verifies supported tools can choose `Shared` during profile restore-and-activate while Gemini remains non-configurable.
  - `src/App.test.tsx` verifies profile mutations preserve the selected `shared` state mode when the guided radio choice is used.

### 16. Missing-tool diagnostics support install guidance and in-place refresh

- Status: implemented
- Evidence:
  - `tests/e2e/app.spec.ts` verifies diagnostics missing-tool cards expose both install-guide and refresh actions, and that refresh reruns doctor checks plus desktop snapshot reads.
  - `src/App.test.tsx` verifies the missing-tool diagnostics card can reopen the install guide and trigger a fresh diagnostics run and snapshot refresh from the same recovery surface.

### 17. Tray result messaging uses the same saved labels as tray menus

- Status: implemented
- Evidence:
  - `src-tauri/src/tray.rs` derives tray success messages for shared profiles, profile sets, contexts, and per-tool profiles from the same saved-label helpers used to build tray menu entries.
  - `src-tauri/src/tray.rs` includes unit tests proving tray result labels prefer profile-set labels and per-tool label overrides over raw ids.

### 18. Inactive profile details do not reuse live runtime diagnostics

- Status: implemented
- Evidence:
  - `src/features/profiles/components/ProfilesPanel.tsx` limits credential-backend, live-match, permission, and token-warning details to the desktop-active profile while still showing stored auth metadata for inactive rows.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify inactive profile details show the activation hint instead of the active profile's runtime diagnostics.

### 19. Routed profile details reset when the user switches tools manually

- Status: implemented
- Evidence:
  - `src/features/profiles/components/ProfilesPanel.tsx` treats route-provided profile expansion as a one-time navigation state and clears it when the user changes the selected tool locally.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify overview-driven profile details open correctly, then close when the tool picker changes to another tool.

### 20. Manual sidebar navigation clears stale routed profile and settings targets

- Status: implemented
- Evidence:
  - `src/App.tsx` clears route-only profile and settings state when the user opens those sections directly from the sidebar instead of a remediation or deep-link action.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify routed profile details and routed shell-settings focus do not persist after leaving the section and reopening it manually.

### 21. Backup restore warnings and confirmations use saved profile labels

- Status: implemented
- Evidence:
  - `src/features/backups/components/BackupsPanel.tsx` and `src/features/profiles/components/ProfilesPanel.tsx` use display-label helpers for backup restore warnings and confirmations instead of raw profile ids.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify backup catalog and latest-backup restore copy prefer saved labels such as `Sandbox`, `Office`, and `Code Work`.

### 22. CLI context activation results prefer matching saved profile-set labels

- Status: implemented
- Evidence:
  - `src/features/contexts/components/ContextsPanel.tsx` passes the resolved context display label through `useContextMutation`, while `src/features/shared/useDesktopActions.ts` prefers that label in success messages without changing the backend request.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify activating the `client-acme` CLI context reports `Client Acme` when a matching saved profile set exists, while raw CLI ids remain intact for unlabeled contexts.

### 23. In-window switch results prefer saved profile labels over raw ids

- Status: implemented
- Evidence:
  - `src/features/shared/useDesktopActions.ts` accepts optional display labels for single-tool and switch-all mutations and uses them only for frontend success copy, leaving backend payload ids unchanged.
  - `src/features/overview/components/OverviewPanel.tsx`, `src/features/profiles/components/ProfilesPanel.tsx`, `src/features/backups/components/BackupsPanel.tsx`, `src/features/diagnostics/components/DiagnosticsPanel.tsx`, and `src/features/onboarding/components/SetupPanel.tsx` pass saved labels into switch mutations from each desktop entry point.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify result strings such as `Switched Codex to Code Work.` and `Switched all tools to Office.` while tray-result payloads keep the backend event contract.

### 24. Nonessential onboarding and settings reads pause while mutations are running

- Status: implemented
- Evidence:
  - `src/features/onboarding/components/SetupPanel.tsx` and `src/features/settings/components/SettingsPanel.tsx` gate `shell-guidance` reads behind `useMutationAwareQueryEnabled`, matching the same queue-aware read policy already used for doctor, verify, repair, backups, and workspace reads.
  - `src/App.test.tsx` verifies shell guidance does not query while the desktop mutation queue is busy, then automatically loads after the queued mutation settles in both onboarding and settings surfaces.

### 25. CLI context lists prefer saved profile-set labels while preserving raw context ids

- Status: implemented
- Evidence:
  - `src/features/contexts/components/ContextsPanel.tsx` renders CLI contexts with `contextDisplayLabel(settings, context.name)` in the primary heading, but still shows `CLI context id: ...` whenever the saved display label differs from the backend context id.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify the Contexts screen shows `Client Acme` alongside `CLI context id: client-acme`, while activation results and workspace summaries continue to use the same saved label.

### 26. CI keeps cross-platform desktop smoke coverage for supported platforms

- Status: implemented
- Evidence:
  - `.github/workflows/ci.yml` runs the desktop verification matrix on `macos-latest`, `ubuntu-22.04`, and `windows-latest` through a shared platform matrix.
  - `scripts/verify-release.mjs` and `scripts/verify-release.test.mjs` fail release-contract verification if the CI workflow drops the shared matrix or any required desktop platform runner.

## Verification Matrix

Run the full matrix before merging or releasing a behavior slice:

```sh
npm test
npm run build
npm run test:e2e
npm run verify:release
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## Release Readiness Checks

- Runtime selection stays compatible across bundled, system, and custom `aisw`.
- The Tauri command surface stays least-privilege and avoids shell, opener, or filesystem plugin expansion.
- Tray actions and in-window mutations share the same refresh and serialization guarantees.
- Release workflows stage a target-specific sidecar and enforce the same verification matrix as local release builds.
