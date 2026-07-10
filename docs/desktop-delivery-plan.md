# AISW Desktop Delivery Plan

This document translates the local product specification into a tracked implementation plan for this repository. It is intentionally separate from `docs/aisw-desktop-product-spec.md`, which remains local-only.

## Product Goal

AISW Desktop is a local-first desktop control plane for `aisw`. The desktop app owns onboarding, visibility, diagnostics, workflows, and quick switching. `aisw` remains the single source of truth for credential capture, storage, switching, rollback, backups, and per-tool compatibility.

## Supported Platforms

- macOS: primary target for first release quality, including notarized builds and menu bar UX.
- Windows: parity target for runtime selection, switching, diagnostics, backups, and tray.
- Linux: parity target for core flows, with packaging and keyring handling validated per distro.

## Architecture

### Layering

1. React + TypeScript frontend
   - Feature screens: onboarding, overview, profiles, contexts, workspaces, diagnostics, backups, settings
   - TanStack Query for reads and mutation invalidation
   - Zod validation at the boundary
2. Tauri Rust command layer
   - Narrow invoke surface
   - Typed request and response models
   - Error normalization and redaction
   - Serialized mutation queue
3. `aisw` bridge
   - Bundled sidecar first
   - System/custom runtime optional
   - JSON-only contract for reads and mutations
4. `aisw`
   - Owns profile state, backups, rollback, keyring, shell guidance, and tool-specific auth behavior

### Non-Negotiable Rules

- The frontend never reads provider credential files directly.
- The frontend never stores credentials beyond immediate submission.
- Mutations are serialized and followed by state refresh.
- Arbitrary shell execution is not exposed to the UI.
- Shell config changes are guided, never silent.
- The app remains usable with bundled `aisw` even if a system install is broken.

## Native UX Strategy

### macOS

- Use Tauri tray/menu bar support as a first-class entry point.
- Respect native file paths, keychain wording, and app-notification patterns.
- Keep window chrome and spacing compact enough for desktop utility usage.

### Windows

- Keep tray wording and status summaries short for constrained menu width.
- Use plain-language remediation for PATH and install issues.
- Avoid macOS-specific terms in shared UI strings.

### Linux

- Treat keyring and permission diagnostics as common first-run paths.
- Keep restore, repair, and file-backed fallback flows explicit.
- Expect variation across Secret Service availability and package formats.

## Workstreams

### 1. Runtime and Bootstrap

Acceptance criteria:
- App starts with bundled runtime by default.
- System and custom runtime paths are visible and selectable.
- Incompatible runtime contracts block mutation surfaces and explain why.
- Runtime compatibility requires the full desktop feature contract from `aisw capabilities --json`, not just basic mutation support.
- Bootstrap reports resolved runtime path, version, channel, and AISW home.

Test cases:
- Loads bundled runtime when compatible.
- Falls back correctly when system runtime is missing or incompatible.
- Shows compatibility blocker when required capabilities are absent.
- Rejects runtimes that omit required desktop features such as progress streaming, verify/repair, contexts, or workspace bindings.
- Persists runtime settings across reloads.

### 2. Onboarding

Acceptance criteria:
- First launch shows welcome, backend check, health check, account import, first switch, and shell guidance.
- Import from live login is available per detected tool.
- First switch can activate a shared profile name across installed tools.
- Shell guidance explains current-shell exports without mutating shell files.

Test cases:
- Imports detected Claude, Codex, and Gemini accounts.
- Shows missing-tool state when a CLI is not installed.
- Uses saved profile labels in onboarding switch options.
- Keeps onboarding usable when no live accounts are detected.

### 3. Overview

Acceptance criteria:
- Each tool card shows install state, active profile, auth method, backend, state mode, live-match state, and last command result.
- One-tool switching works from the card.
- Shared-profile or profile-set switching works from the top-level control.
- Saved labels are shown consistently across headings, options, and action buttons.

Test cases:
- Switches one tool directly and refreshes active state.
- Activates a shared profile or profile set from the overview switcher.
- Renders label overrides for profile cards and shared-profile options.
- Shows mismatch warnings and actionable recovery affordances.

### 4. Profiles

Acceptance criteria:
- Profiles can be added, imported, relabeled, renamed, removed, and activated.
- Active profile metadata is visible per tool.
- State mode is editable only for supported tools.
- Profile setup derives supported import modes and credential backends from the selected runtime's advertised capabilities, while preserving the legacy desktop defaults if that metadata is absent.
- Credential backend selection is exposed during profile creation for tools that support both file-backed and system-keyring storage.
- Onboarding, overview, and diagnostics do not offer direct live-import actions when the selected runtime does not advertise `from_live` support for that tool; they route into the nearest supported profile-setup flow instead.
- Profile details are reachable from overview, diagnostics, and backups.

Test cases:
- Adds profiles from environment, live import, API key, and OAuth-capable flows.
- Restricts import modes and credential backends to the runtime-advertised set for the selected tool.
- Falls back to the legacy desktop profile-setup options when older compatible runtimes omit auth/backend capability metadata.
- Routes onboarding and mismatch-recovery live-import entry points into supported profile setup when `from_live` is unavailable.
- Passes explicit file-backed and system-keyring backend requests during profile creation.
- Renames and relabels profiles without losing active-state visibility.
- Prevents invalid shared-state actions for Gemini.
- Surfaces duplicate-name and missing-profile errors cleanly.

### 5. Contexts and Workspaces

Acceptance criteria:
- Users can define profile sets and map them to tools.
- Workspace bindings can target a context or profile set.
- Mismatch state is surfaced before activation.
- Workspace activation produces a visible result and optional desktop notification.
- The currently matched explicit workspace binding is identified in the bindings list.

Test cases:
- Creates and edits a profile set.
- Applies a workspace target and refreshes active state.
- Shows expected-context mismatch with direct-fix action.
- Marks the explicit binding row that currently resolves the workspace target.
- Excludes unsupported workspace bindings from the wrong surfaces.

### 6. Diagnostics and Repair

Acceptance criteria:
- Diagnostics combine doctor, verify, and repair preview state.
- Direct-fix cards exist for missing tools, live mismatch, workspace mismatch, and repairable environment issues.
- Keyring diagnostics can route users into a file-backed profile-setup recovery path when native keyring storage is unavailable.
- UI labels match saved profile labels where applicable.
- Safe repairs can be previewed and applied with post-refresh validation.

Test cases:
- Opens install guidance for missing tools.
- Re-applies an active profile from mismatch state.
- Opens profile setup with file-backed storage preselected from keyring diagnostics.
- Runs targeted repairs for keyring, permissions, and OAuth failures.
- Shows no-action states when diagnostics are healthy.

### 7. Backups

Acceptance criteria:
- Backups list newest first.
- Each row shows backup id, target tool/profile, and affected state.
- Users can copy backup ids, restore, and restore-then-activate.
- Users can jump from a backup row to the matching profile details.

Test cases:
- Lists backups in descending timestamp order.
- Shows human-readable labels for backup targets.
- Warns before restore and re-activates restored state.
- Opens matching profile details from a backup action.

### 8. Tray / Menu Bar

Acceptance criteria:
- Tray shows active set summary.
- Tray supports shared profile, per-tool switching, and open-app actions.
- Labels honor saved overrides and active markers.
- Tray context entries use the same saved profile-set labels as the main window surfaces.
- Tray prefers native CLI context entries over duplicate profile-set actions when both refer to the same saved context.
- Tray refreshes after successful mutations.

Test cases:
- Builds shared profile section without duplicates.
- Marks active set and active tool profiles correctly.
- Uses label overrides in tray sections.
- Uses saved profile-set labels and active markers in tray context entries.
- Omits duplicate profile-set tray entries when a matching native CLI context already exists.
- Invokes matching mutations from tray actions.

### 9. Settings and Shell Guidance

Acceptance criteria:
- AISW home, runtime choice, custom runtime path, and update channel are editable.
- Shell guidance exposes detected shell, install commands, reload commands, and verification commands.
- Desktop updater channels accept HTTPS endpoints only, both when staged into release builds and when resolved at runtime.
- Guidance stays informational unless an explicit setup action is added later.

Test cases:
- Round-trips persisted settings.
- Shows shell variants with supported commands.
- Prefers channel-specific update endpoints when configured.
- Rejects non-HTTPS updater endpoints before packaging and at runtime.
- Rejects invalid updater configuration safely.

### 10. Packaging, Signing, and Release

Acceptance criteria:
- Sidecar preparation is deterministic for local and CI builds.
- Release builds package the correct sidecar per target.
- macOS signing/notarization path is documented and repeatable.
- Release verification is captured in a runbook.

Test cases:
- Local sidecar build path produces a launchable app bundle.
- CI release artifacts include app bundle and bundled sidecar.
- Update feed configuration resolves per channel.
- Release checklist passes before distribution.

## Cross-Cutting Quality Gates

### Security

- No secrets in frontend state snapshots, logs, or test fixtures.
- API keys are never passed in unsafe ways for public release flows.
- Redaction covers known token formats and command output.

### Reliability

- One mutation at a time.
- Successful mutations always invalidate and refetch state.
- Failure states map to actionable remediation, not raw command output.

### Consistency

- Saved profile labels win over raw ids in user-facing UI.
- Raw ids are still used internally for backend commands.
- Overview, diagnostics, backups, contexts, and tray show the same active-set naming model.

## Verification Matrix

Run this for every completed slice:

```sh
npm test
npm run build
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## Remaining External Dependencies On `aisw`

- Stable `version --json` and capability detection
- Safe API key stdin support
- Structured mutation JSON for every write path
- Progress JSON for OAuth-driven profile capture
- Stable repair and verify output contracts

## Delivery Practice

- Keep commits small and behavior-scoped.
- Verify each slice before commit.
- Do not track local-only product-spec files.
- Prefer adding tests in the same slice as the behavior change.
