# AI Switch Desktop Acceptance Matrix

This document tracks the shipped desktop architecture, acceptance criteria, and verification evidence for this repository. It intentionally complements `docs/desktop-delivery-plan.md` and does not replace the local-only product spec kept out of Git.

## Architecture Summary

### Runtime model

- The desktop app defaults to a bundled AI Switch sidecar and can switch to system or custom runtimes through Settings.
- Sidecar staging validates target-compatible binary formats before release packaging.
- The Rust bridge is the only layer that executes switching-engine commands.
- The frontend consumes typed JSON responses validated at the boundary.

### Trust boundary

- The bundled AI Switch engine remains the single source of truth for profile state, switching, rollback, backups, keyring behavior, and tool-specific auth handling.
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

### 9. Failed switch rolls back through the switching engine; UI refresh shows previous valid state

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

### 27. Contexts screen marks the active CLI context and prevents redundant activation

- Status: implemented
- Evidence:
  - `src/features/contexts/components/ContextsPanel.tsx` derives the active CLI context from workspace status, appends the active marker to the current context row, and replaces the action with a disabled `Active context` button when that context is already selected.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify the Contexts screen updates from `Activate CLI context` to `Active context` after activation and shows the active marker alongside the saved display label.

### 28. Workspaces screen marks the explicit binding row that currently matches

- Status: implemented
- Evidence:
  - `src/features/workspaces/components/WorkspacesPanel.tsx` derives the current matched binding from workspace status and annotates the matching explicit binding row with `Matched binding ✓`.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify the matched-binding marker appears for the active `/code/acme` workspace binding.

### 29. Tray context entries prefer saved labels and mark the active context

- Status: implemented
- Evidence:
  - `src-tauri/src/tray.rs` derives tray context entry labels from saved profile-set labels and appends the active marker when `workspace_status.current_context` matches that context.
  - `src-tauri/src/tray.rs` unit tests verify `client-acme` renders as `Client Acme ✓` in the tray context section while unmatched raw context ids stay unchanged.

### 30. Tray prefers native CLI contexts over duplicate profile-set entries

- Status: implemented
- Evidence:
  - `src-tauri/src/tray.rs` filters profile-set tray entries when a saved profile set already matches an available CLI context id, so the tray does not render duplicate `client-acme` actions in both sections.
  - `src-tauri/src/tray.rs` unit tests verify matching `client-acme` profile sets are omitted from the tray profile-set section while unrelated profile sets still remain available.

### 31. Profile creation exposes explicit credential-backend selection

- Status: implemented
- Evidence:
  - `src/features/profiles/components/ProfilesPanel.tsx`, `src/lib/client.ts`, and `src-tauri/src/bridge.rs` expose `credential_backend` through the desktop add-profile and OAuth flows, including explicit `file` and `system-keyring` selection for supported tools.
  - `src/App.test.tsx`, `tests/e2e/app.spec.ts`, and `src-tauri/src/bridge.rs` unit tests verify the desktop sends `system-keyring` and `file` backend requests through the add-profile command contract.

### 32. Keyring diagnostics route users into file-backed profile setup

- Status: implemented
- Evidence:
  - `src/features/diagnostics/components/DiagnosticsPanel.tsx` adds a `Use file-backed storage` direct-fix action that opens profile setup with file-backed storage preselected.
  - `src/App.tsx`, `src/features/profiles/components/ProfilesPanel.tsx`, `src/App.test.tsx`, and `tests/e2e/app.spec.ts` verify the diagnostics action lands on Profiles with `from_live` mode and `file` backend selected.

### 33. Profile setup options follow runtime-advertised auth and backend capabilities

- Status: implemented
- Evidence:
  - `src/lib/schemas.ts`, `src-tauri/src/models.rs`, and `src/features/shared/profile-capabilities.ts` preserve `auth_methods` and `credential_backends` from the `aisw capabilities --json` contract, normalizing them for desktop use while retaining the previous desktop defaults as a compatibility fallback.
  - `src/features/profiles/components/ProfilesPanel.tsx` derives the import-mode and credential-backend selectors from those runtime capabilities instead of hardcoded per-tool assumptions.
  - `src/App.test.tsx` verifies both the narrowed capability-driven UI and the legacy fallback path when compatible runtimes omit the new capability fields.

### 34. Runtime compatibility fails closed when required desktop features are missing

- Status: implemented
- Evidence:
  - `src-tauri/src/state.rs` requires the full `aisw` desktop feature set at bootstrap, including `api_key_stdin`, `mutation_json`, `progress_json`, non-prompting init, live detection, verify, repair, contexts, and workspace bindings.
  - `src-tauri/src/state.rs` unit tests verify compatible runtimes must advertise every required feature and that missing features are surfaced explicitly in the runtime issue list instead of allowing partial desktop behavior.

### 35. Unsupported live-import entry points fall back to supported profile setup

- Status: implemented
- Evidence:
  - `src/features/onboarding/components/SetupPanel.tsx`, `src/features/overview/components/OverviewPanel.tsx`, and `src/features/diagnostics/components/DiagnosticsPanel.tsx` now use the shared profile-capability helpers to suppress direct `from_live` imports when the selected runtime does not advertise that mode for the relevant tool.
  - `src/App.tsx` carries the fallback profile-setup mode through route state so the Profiles screen opens in the nearest supported import mode.
  - `src/App.test.tsx` and `tests/e2e/app.spec.ts` verify unsupported onboarding and live-mismatch flows land on Profiles with `from_env` selected instead of trying an invalid live import.

### 36. Updater channels fail closed unless the configured feed uses HTTPS

- Status: implemented
- Evidence:
  - `src-tauri/src/updater.rs` rejects non-HTTPS updater feeds from both environment overrides and staged `plugins.updater.channels` config, matching the desktop remediation contract that requires a valid HTTPS URL.
  - `scripts/prepare-updater.mjs` rejects non-HTTPS release-channel endpoints before they are written into `src-tauri/tauri.conf.json`, while `scripts/verify-release.mjs` fails release verification if staged updater channels or fallback endpoints drift to non-HTTPS URLs.
  - `scripts/prepare-updater.test.mjs`, `scripts/verify-release.test.mjs`, and `src-tauri/src/updater.rs` unit tests verify both build-time and runtime rejection paths.

### 37. Local release-bundle smoke builds succeed without release signing secrets

- Status: implemented
- Evidence:
  - `scripts/build-local-bundle.mjs` stages a temporary Tauri config override with updater artifact generation disabled and then runs `tauri build`, preserving the normal signed-release `tauri:build` path while giving developers a reliable unsigned local bundle flow.
  - `package.json`, `scripts/build-local-bundle.test.mjs`, and `scripts/verify-release.mjs` expose and verify the `tauri:bundle-local` contract, including cleanup of temporary config overrides and release-runbook coverage.
  - A real local `npm run tauri:bundle-local` build produced `/Users/burakdede/Projects/aisw-desktop/src-tauri/target/release/bundle/macos/AI Switch.app` and `/Users/burakdede/Projects/aisw-desktop/src-tauri/target/release/bundle/dmg/AI Switch_0.1.0_aarch64.dmg` without requiring `TAURI_SIGNING_PRIVATE_KEY`.

### 38. Workspace mismatch recovery skips empty same-named profile sets

- Status: implemented
- Evidence:
  - `src/features/workspaces/workspace-activation.ts` now treats only non-empty saved profile sets as valid workspace activation targets, so mismatch recovery falls back to the matching CLI context when a same-named saved set has no mapped profiles.
  - `src/features/workspaces/workspace-activation.test.ts` verifies both branches: a non-empty saved profile set still wins, while an empty same-named set defers to the CLI context and preserves the resolved shared state mode.
  - `tests/e2e/app.spec.ts` verifies the Workspaces mismatch action uses `use_context` and refreshes the UI to `Current context: Client Acme` instead of trying to activate an empty saved profile set.

### 39. Stale workspace targets route users into Contexts instead of sending invalid activations

- Status: implemented
- Evidence:
  - `src/features/workspaces/workspace-activation.ts` now returns `null` when the expected workspace target resolves to neither a non-empty saved profile set nor a live CLI context, instead of fabricating a doomed `use_context` request.
  - `src/App.tsx`, `src/features/overview/components/OverviewPanel.tsx`, `src/features/diagnostics/components/DiagnosticsPanel.tsx`, and `src/features/workspaces/components/WorkspacesPanel.tsx` route that stale-target case into the Contexts screen with `Open contexts` recovery affordances.
  - `src/features/workspaces/workspace-activation.test.ts`, `src/App.test.tsx`, and `tests/e2e/app.spec.ts` verify stale workspace recovery opens Contexts and does not dispatch `use_context` or `activate_profile_set`.

### 40. Stale profile sets fail closed before activation

- Status: implemented
- Evidence:
  - `src/lib/profile-display.ts` distinguishes non-empty profile sets from usable profile sets by reporting missing mapped profiles against the live snapshot.
  - `src/features/overview/components/OverviewPanel.tsx` and `src/features/workspaces/workspace-activation.ts` exclude stale saved profile sets from quick-switch and workspace-binding activation surfaces while still allowing matching CLI contexts to participate.
  - `src/features/contexts/components/ContextsPanel.tsx` keeps stale saved profile sets visible for editing and deletion, disables `Activate set`, and explains which mapped profiles are missing.
  - `src-tauri/src/state.rs` preflights profile-set activation and returns a `ProfileMissing` error before issuing any partial per-tool switch when mapped profiles no longer exist.
  - `src-tauri/src/tray.rs` excludes stale saved profile sets from tray activation sections, matching the main-window fail-closed behavior for quick-switch surfaces.
  - `src/App.test.tsx`, `tests/e2e/app.spec.ts`, `src-tauri/src/state.rs`, and `src-tauri/src/tray.rs` tests verify stale sets are blocked in-window, omitted from activation pickers and tray menus, and rejected by the backend preflight.

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
