import { FormEvent, useEffect, useMemo, useState } from "react";
import { DialogSurface } from "../../../components/DialogSurface";
import { SplitView } from "../../../components/SplitView";
import { SectionCard } from "../../../components/SectionCard";
import {
  contextDisplayLabel,
  profileSetHasSelections,
  profileSetHasUsableSelections,
  missingProfileSetSelections,
  profileSetDisplayLabel,
  profileSetIsActive,
  toolProfileDisplayLabel,
} from "../../../lib/profile-display";
import { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { resolveGlobalStateMode } from "../../shared/state-modes";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { parseWorkspaceStatus } from "../../workspaces/workspace-parsers";

const TOOLS = ["claude", "codex", "gemini"] as const;

type EditableProfileSet = {
  sourceName: string | null;
  name: string;
  label: string;
  profiles: Record<string, string>;
};

export function ContextsPanel({
  snapshot,
  settings,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
}) {
  const {
    updateSettingsMutation,
    activateProfileSetMutation,
    useContextMutation,
    mutationLock,
    lastCommandResults,
  } = useDesktopActions();
  const [draft, setDraft] = useState<EditableProfileSet>({
    sourceName: null,
    name: "",
    label: "",
    profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
  });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const [selectedSetName, setSelectedSetName] = useState<string | null>(
    (settings.profile_sets ?? [])[0]?.name ?? null,
  );
  const activeContext = parseWorkspaceStatus(snapshot.workspace_status ?? undefined).currentContext;

  const localSets = settings.profile_sets ?? [];
  const trimmedDraftName = draft.name.trim();
  const draftHasSelections = Object.values(draft.profiles).some((profile) => profile.trim().length > 0);
  const isEditingExistingSet = draft.sourceName !== null;
  const readySetCount = localSets.filter((set) => profileSetHasUsableSelections(snapshot, set)).length;
  const activeSetCount = localSets.filter((set) => profileSetIsActive(snapshot, set)).length;
  const hasDuplicateSetName =
    trimmedDraftName.length > 0 &&
    localSets.some(
      (entry) => entry.name === trimmedDraftName && entry.name !== draft.sourceName,
    );
  const contextResult = lastCommandResults.global.context;
  const selectedSet =
    localSets.find((set) => set.name === selectedSetName) ?? localSets[0] ?? null;
  const detailSet = selectedSet;
  const detailSetSelectionCount = detailSet
    ? Object.values(detailSet.profiles).filter((profile) => Boolean(profile)).length
    : 0;
  const profileOptions = useMemo(
    () =>
      Object.fromEntries(
        TOOLS.map((tool) => [
          tool,
          (snapshot.profiles[tool]?.profiles ?? []).map((profile) => ({
            value: profile.name,
            label: toolProfileDisplayLabel(settings, snapshot, tool, profile.name),
          })),
        ]),
      ) as Record<(typeof TOOLS)[number], Array<{ value: string; label: string }>>,
    [settings, snapshot],
  );

  function resetDraft() {
    setDraft({
      sourceName: null,
      name: "",
      label: "",
      profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
    });
  }

  function openNewSetEditor() {
    resetDraft();
    setIsEditorOpen(true);
  }

  function startEditingSet(set: DesktopSettings["profile_sets"][number]) {
    setSelectedSetName(set.name);
    setDraft({
      sourceName: set.name,
      name: set.name,
      label: set.label ?? "",
      profiles: Object.fromEntries(TOOLS.map((tool) => [tool, set.profiles[tool] ?? ""])),
    });
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    resetDraft();
  }

  function saveProfileSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = trimmedDraftName;
    if (!name || !draftHasSelections || hasDuplicateSetName) return;

    const nextSets = [
      ...localSets.filter((entry) => entry.name !== (draft.sourceName ?? name)),
      {
        name,
        label: draft.label.trim() || null,
        profiles: Object.fromEntries(
          Object.entries(draft.profiles).map(([tool, profile]) => [tool, profile || null]),
        ),
      },
    ].sort((left, right) => left.name.localeCompare(right.name));

    updateSettingsMutation.mutate(
      {
        runtime_kind: settings.runtime_kind,
        runtime_path: settings.runtime_path ?? null,
        aisw_home: settings.aisw_home ?? null,
        update_channel: settings.update_channel,
        profile_labels: settings.profile_labels ?? {},
        profile_sets: nextSets,
      },
      {
        onSuccess: () => {
          setSelectedSetName(name);
          setLastAction(
            `${isEditingExistingSet ? "Updated" : "Saved"} set ${draft.label.trim() || name}.`,
          );
          closeEditor();
        },
      },
    );
  }

  async function activateProfileSet(set: DesktopSettings["profile_sets"][number]) {
    setSelectedSetName(set.name);
    await activateProfileSetMutation.mutateAsync({
      name: set.name,
      label: profileSetDisplayLabel(set),
    });
    setLastAction(`Activated saved set ${profileSetDisplayLabel(set)}.`);
  }

  function deleteProfileSet(name: string) {
    const label = profileSetDisplayLabel(
      localSets.find((entry) => entry.name === name) ?? { name, label: null, profiles: {} },
    );
    if (draft.sourceName === name || trimmedDraftName === name) {
      resetDraft();
    }
    if (selectedSetName === name) {
      const remaining = localSets.filter((entry) => entry.name !== name);
      setSelectedSetName(remaining[0]?.name ?? null);
    }
    updateSettingsMutation.mutate(
      {
        runtime_kind: settings.runtime_kind,
        runtime_path: settings.runtime_path ?? null,
        aisw_home: settings.aisw_home ?? null,
        update_channel: settings.update_channel,
        profile_labels: settings.profile_labels ?? {},
        profile_sets: localSets.filter((entry) => entry.name !== name),
      },
      {
        onSuccess: () => setLastAction(`Deleted set ${label}.`),
      },
    );
  }

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }
    if (draft.sourceName && !localSets.some((set) => set.name === draft.sourceName)) {
      closeEditor();
    }
  }, [draft.sourceName, isEditorOpen, localSets]);

  return (
    <SectionCard
      title="Set Library"
      kicker="Saved switching sets"
      actions={
        <button
          className="primary-button"
          type="button"
          onClick={openNewSetEditor}
        >
          New Set
        </button>
      }
    >
      <SplitView
        className="sets-layout"
        primaryClassName="set-inventory-pane"
        secondaryClassName="set-editor-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card set-library-card">
              <div className="set-section-header desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Saved sets</p>
                  <h3>{localSets.length ? "Reusable switching sets" : "No saved sets yet"}</h3>
                </div>
                <span className={`pill ${activeSetCount ? "pill-ok" : "pill-soft"}`}>
                  {activeSetCount ? `${activeSetCount} active` : "Library"}
                </span>
              </div>
              <p className="inline-note">
                Save work, personal, and client combinations once, then switch them from Overview, Quick Switch, or project rules.
              </p>
              <div className="set-library-meta">
                <div>
                  <span className="overview-current-set-cell-label">Saved</span>
                  <strong>{localSets.length}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Ready</span>
                  <strong>{readySetCount}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Detected</span>
                  <strong>{snapshot.contexts.length}</strong>
                </div>
              </div>
              <div className="stack-list desktop-list-stack set-library-list">
                {localSets.map((set) => (
                  <article
                    key={set.name}
                    className={`list-row set-row ${
                      profileSetIsActive(snapshot, set) ? "set-row-active" : ""
                    } ${selectedSetName === set.name ? "set-row-selected" : ""}`}
                  >
                    <button
                      className="set-row-select"
                      type="button"
                      onClick={() => setSelectedSetName(set.name)}
                    >
                      <div className="set-row-main">
                        <div className="set-row-header">
                          <strong>{profileSetDisplayLabel(set)}</strong>
                          <span
                            className={`pill ${
                              profileSetIsActive(snapshot, set)
                                ? "pill-ok"
                                : profileSetHasUsableSelections(snapshot, set)
                                  ? "pill-soft"
                                  : "pill-warn"
                            }`}
                          >
                            {profileSetIsActive(snapshot, set)
                              ? "Current"
                              : profileSetHasUsableSelections(snapshot, set)
                                ? "Ready"
                                : "Needs attention"}
                          </span>
                        </div>
                        <div className="set-profile-grid">
                          {TOOLS.map((tool) => {
                            const profile = set.profiles[tool];
                            const label = profile
                              ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
                              : "Not configured";
                            return (
                              <p key={tool} className="inline-note">
                                <strong>{titleCase(tool)}:</strong> {label}
                              </p>
                            );
                          })}
                        </div>
                        {!profileSetHasSelections(set) ? (
                          <p className="inline-note">
                            Add at least one mapped profile before using this set in Overview, the menu bar, or project rules.
                          </p>
                        ) : !profileSetHasUsableSelections(snapshot, set) ? (
                          <p className="inline-note">
                            Refresh or repair the missing mapped profiles before using this set. Missing:{" "}
                            {missingProfileSetSelections(snapshot, set)
                              .map(([tool, profile]) => `${tool}: ${profile}`)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </button>
                    <div className="button-row set-row-actions">
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          mutationLock.isBusy ||
                          profileSetIsActive(snapshot, set) ||
                          !profileSetHasUsableSelections(snapshot, set)
                        }
                        onClick={() => void activateProfileSet(set)}
                      >
                        {profileSetIsActive(snapshot, set) ? "Current set" : "Switch to set"}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => startEditingSet(set)}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() => deleteProfileSet(set.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!localSets.length ? (
                <article className="diagnostic-card set-empty-card">
                  <h3>No saved sets yet</h3>
                  <p className="inline-note">
                    No local sets are stored yet. Save a work, personal, or client bundle here when you
                    need a reusable switching combination.
                  </p>
                </article>
              ) : null}
            </article>

            <article className="diagnostic-card set-library-card">
              <div className="set-section-header desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Detected sets</p>
                  <h3>{snapshot.contexts.length ? "Detected on this Mac" : "No detected sets available"}</h3>
                </div>
                <span className="pill pill-soft">
                  {snapshot.contexts.length ? `${snapshot.contexts.length} available` : "Detected"}
                </span>
              </div>
              <p className="inline-note">
                These detected sets come from existing tool state on this Mac and stay separate from your saved local sets.
              </p>
              <div className="stack-list set-imported-list">
                {snapshot.contexts.map((context) => (
                  <article key={context.name} className="list-row set-row set-row-imported">
                    <div className="set-row-main">
                      <div className="set-row-header">
                        <strong>
                          {contextDisplayLabel(settings, context.name)}
                          {activeContext === context.name ? " ✓" : ""}
                        </strong>
                        <span className={`pill ${activeContext === context.name ? "pill-ok" : "pill-soft"}`}>
                          {activeContext === context.name ? "Current" : "Imported"}
                        </span>
                      </div>
                      {contextDisplayLabel(settings, context.name) !== context.name ? (
                        <p className="inline-note">Set ID: {context.name}</p>
                      ) : null}
                      <p>
                        {Object.entries(context.profiles)
                          .map(([tool, profile]) => {
                            const label = profile
                              ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
                              : "none";
                            return `${tool}: ${label}`;
                          })
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={mutationLock.isBusy || activeContext === context.name}
                      onClick={() =>
                        useContextMutation.mutate({
                          context: context.name,
                          stateMode: resolveGlobalStateMode(snapshot),
                          label: contextDisplayLabel(settings, context.name),
                        })
                      }
                    >
                      {activeContext === context.name ? "Current set" : "Use this set"}
                    </button>
                  </article>
                ))}
              </div>
              {!snapshot.contexts.length ? (
                <p className="inline-note">
                  No detected sets are currently available. Saved sets remain available even when
                  desktop-engine shared switching support is limited.
                </p>
              ) : null}
            </article>

            {contextResult ? (
              <p className={`inline-note ${contextResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
                Last set result: {normalizeRuntimeLanguage(contextResult.message)}
                {contextResult.remediation
                  ? ` Remediation: ${normalizeRuntimeLanguage(contextResult.remediation)}`
                  : ""}
              </p>
            ) : null}
            {lastAction ? <p className="inline-note">{lastAction}</p> : null}
          </div>
        }
        secondary={
          <article className="diagnostic-card set-editor-card desktop-pane-column">
          {detailSet ? (
            <div className="set-detail-summary">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Selected set</p>
                  <h3>{profileSetDisplayLabel(detailSet)}</h3>
                </div>
                <span
                  className={`pill ${
                    profileSetIsActive(snapshot, detailSet)
                      ? "pill-ok"
                      : profileSetHasUsableSelections(snapshot, detailSet)
                        ? "pill-soft"
                        : "pill-warn"
                  }`}
                >
                  {profileSetIsActive(snapshot, detailSet)
                    ? "Current"
                    : profileSetHasUsableSelections(snapshot, detailSet)
                      ? "Ready"
                      : "Needs attention"}
                </span>
              </div>
              <div className="set-detail-strip">
                <div className="set-detail-cell">
                  <span className="overview-current-set-cell-label">Name</span>
                  <strong>{detailSet.name}</strong>
                </div>
                <div className="set-detail-cell">
                  <span className="overview-current-set-cell-label">Label</span>
                  <strong>{detailSet.label?.trim() || "Using set name"}</strong>
                </div>
                <div className="set-detail-cell">
                  <span className="overview-current-set-cell-label">Coverage</span>
                  <strong>
                    {detailSetSelectionCount} tool
                    {detailSetSelectionCount === 1 ? "" : "s"}
                  </strong>
                </div>
              </div>
              <p className="inline-note">
                Review the mapped profiles here before switching or editing this saved set.
              </p>
              <div className="set-detail-grid">
                {TOOLS.map((tool) => {
                  const profile = detailSet.profiles[tool];
                  return (
                    <div key={tool} className="set-detail-cell">
                      <span className="overview-current-set-cell-label">{titleCase(tool)}</span>
                      <strong>
                        {profile
                          ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
                          : "Not configured"}
                      </strong>
                    </div>
                  );
                })}
              </div>
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={
                    mutationLock.isBusy ||
                    profileSetIsActive(snapshot, detailSet) ||
                    !profileSetHasUsableSelections(snapshot, detailSet)
                  }
                  onClick={() => void activateProfileSet(detailSet)}
                >
                  {profileSetIsActive(snapshot, detailSet)
                    ? "Already Active"
                    : "Switch This Set"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => startEditingSet(detailSet)}
                >
                  Edit This Set
                </button>
                <button className="ghost-button" type="button" onClick={openNewSetEditor}>
                  Create Another Set
                </button>
              </div>
            </div>
          ) : (
            <div className="set-detail-summary">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Selected set</p>
                  <h3>No saved set selected</h3>
                </div>
              </div>
              <p className="inline-note">
                Select a saved set from the library to review its mapped profiles or switch it.
              </p>
            </div>
          )}
            <div className="stack-list">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Quick actions</p>
                  <h3>Open the set editor only when you need it</h3>
                </div>
                <span className="pill pill-soft">Focused</span>
              </div>
              <p className="inline-note">
                Keep this inspector short. Create or edit sets in a sheet so the library stays easy to scan.
              </p>
              <div className="button-row">
                <button className="primary-button" type="button" onClick={openNewSetEditor}>
                Open Set Editor
              </button>
              {detailSet ? (
                <button className="ghost-button" type="button" onClick={() => startEditingSet(detailSet)}>
                  Edit Selected Set
                </button>
              ) : null}
            </div>
          </div>
          </article>
        }
      />
      {isEditorOpen ? (
        <DialogSurface
          ariaLabel={isEditingExistingSet ? "Edit Set" : "New Set"}
          className="quick-switch-palette profile-sheet set-sheet"
          initialFocusSelector='input:not([disabled]), select:not([disabled]), button:not([disabled])'
          onClose={closeEditor}
        >
          <form className="stack-list" onSubmit={saveProfileSet}>
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">{isEditingExistingSet ? "Edit set" : "New set"}</p>
                <h3>{isEditingExistingSet ? "Update this saved set" : "Create a saved set"}</h3>
                <p className="inline-note">
                  Pick the saved profiles that should move together when you switch work, personal, or project-specific identities.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeEditor}>
                Close
              </button>
            </div>
            <div className="stacked-form diagnostics-body">
              <label>
                Set name
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label>
                Label
                <input
                  value={draft.label}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, label: event.target.value }))
                  }
                />
              </label>
              {TOOLS.map((tool) => (
                <label key={tool}>
                  {titleCase(tool)}
                  <select
                    value={draft.profiles[tool] ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        profiles: {
                          ...current.profiles,
                          [tool]: event.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">None</option>
                    {profileOptions[tool].map((profile) => (
                      <option key={profile.value} value={profile.value}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {hasDuplicateSetName ? (
                <p className="inline-note">
                  A set named {trimmedDraftName} already exists. Rename the existing set or choose a different name.
                </p>
              ) : null}
              {!draftHasSelections ? (
                <p className="inline-note">
                  Select at least one tool profile before saving this set.
                </p>
              ) : null}
            </div>
            <footer className="quick-switch-footer">
              <div className="quick-switch-selection">
                <p className="card-kicker">Selection</p>
                <strong>{draft.label.trim() || trimmedDraftName || "Untitled set"}</strong>
                <p>
                  {draftHasSelections
                    ? `${Object.values(draft.profiles).filter((profile) => profile.trim().length > 0).length} tool profile selection${Object.values(draft.profiles).filter((profile) => profile.trim().length > 0).length === 1 ? "" : "s"} ready`
                    : "Choose at least one saved profile before creating this set."}
                </p>
              </div>
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={closeEditor}>
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    mutationLock.isBusy || !trimmedDraftName || !draftHasSelections || hasDuplicateSetName
                  }
                >
                  {isEditingExistingSet ? "Update Set" : "Create Set"}
                </button>
              </div>
            </footer>
          </form>
        </DialogSurface>
      ) : null}
    </SectionCard>
  );
}
