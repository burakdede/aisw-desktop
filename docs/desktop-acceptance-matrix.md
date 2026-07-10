# AISW Desktop Acceptance Matrix

This document tracks the shipped desktop architecture, acceptance criteria, and verification evidence for this repository. It intentionally complements `docs/desktop-delivery-plan.md` and does not replace the local-only product spec kept out of Git.

## Architecture Summary

### Runtime model

- The desktop app defaults to a bundled `aisw` sidecar and can switch to system or custom runtimes through Settings.
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
- Release workflows stage a target-specific sidecar and enforce the same verification matrix as local release builds.
