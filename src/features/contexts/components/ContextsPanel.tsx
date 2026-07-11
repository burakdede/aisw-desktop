import { FormEvent, useMemo, useState } from "react";
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
  const [lastAction, setLastAction] = useState("");
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
          setLastAction(
            `${isEditingExistingSet ? "Updated" : "Saved"} profile set ${draft.label.trim() || name}.`,
          );
          setDraft({
            sourceName: null,
            name: "",
            label: "",
            profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
          });
        },
      },
    );
  }

  async function activateProfileSet(set: DesktopSettings["profile_sets"][number]) {
    await activateProfileSetMutation.mutateAsync({
      name: set.name,
      label: profileSetDisplayLabel(set),
    });
    setLastAction(`Activated profile set ${profileSetDisplayLabel(set)}.`);
  }

  function deleteProfileSet(name: string) {
    const label = profileSetDisplayLabel(
      localSets.find((entry) => entry.name === name) ?? { name, label: null, profiles: {} },
    );
    if (draft.sourceName === name || trimmedDraftName === name) {
      setDraft({
        sourceName: null,
        name: "",
        label: "",
        profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
      });
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
        onSuccess: () => setLastAction(`Deleted profile set ${label}.`),
      },
    );
  }

  return (
    <SectionCard
      title="Sets"
      kicker="Saved switching combinations"
      actions={
        <button
          className="primary-button"
          type="button"
          onClick={() =>
            setDraft({
              sourceName: null,
              name: "",
              label: "",
              profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
            })
          }
        >
          New set
        </button>
      }
    >
      <SplitView
        className="sets-layout"
        primaryClassName="set-inventory-pane"
        secondaryClassName="set-editor-pane"
        primary={
          <div className="stack-list desktop-pane-column">
          <article className="diagnostic-card desktop-pane-intro">
            <h3>Set library</h3>
            <p className="inline-note">
              Build reusable combinations once, then switch them from Overview, Quick Switch, the menu bar, and project rules.
            </p>
          </article>
          <div className="sets-summary-grid">
            <article className="diagnostic-card">
              <p className="card-kicker">Current</p>
              <h3>{activeSetCount ? "One set is active" : "No saved set is active"}</h3>
              <p className="inline-note">
                {activeSetCount
                  ? "The app is currently aligned to one of your saved switching combinations."
                  : "Switch a ready set to keep Claude Code, Codex CLI, and Gemini aligned."}
              </p>
            </article>
            <article className="diagnostic-card">
              <p className="card-kicker">Ready</p>
              <h3>{readySetCount} ready sets</h3>
              <p className="inline-note">
                Ready sets have valid mapped profiles and can be used from Overview, Quick Switch, and the menu bar.
              </p>
            </article>
            <article className="diagnostic-card">
              <p className="card-kicker">Imported</p>
              <h3>{snapshot.contexts.length} shared groups</h3>
              <p className="inline-note">
                Shared groups stay visible here when the runtime exposes reusable combinations outside your desktop-local set library.
              </p>
            </article>
          </div>

          <div className="stack-list">
            <div className="set-section-header desktop-pane-section-header">
              <div>
                <p className="card-kicker">Saved sets</p>
                <h3>Reusable switching combinations</h3>
              </div>
              <p className="inline-note">
                Save work, personal, and client bundles once, then switch them from one place.
              </p>
            </div>
            {localSets.map((set) => (
              <article
                key={set.name}
                className={`list-row set-row ${profileSetIsActive(snapshot, set) ? "set-row-active" : ""}`}
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
                  <p className="inline-note">
                    {TOOLS.map((tool) => {
                      const profile = set.profiles[tool];
                      const label = profile
                        ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
                        : "none";
                      return `${tool}: ${label}`;
                    }).join(" · ")}
                  </p>
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
                <div className="button-row button-row-column">
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
                    onClick={() =>
                      setDraft({
                        sourceName: set.name,
                        name: set.name,
                        label: set.label ?? "",
                        profiles: Object.fromEntries(
                          TOOLS.map((tool) => [tool, set.profiles[tool] ?? ""]),
                        ),
                      })
                    }
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
            {!localSets.length ? (
              <article className="diagnostic-card">
                <h3>No saved sets yet</h3>
                <p className="inline-note">
                  No local sets are stored yet. Save a work, personal, or client bundle here when you
                  need a reusable switching combination.
                </p>
              </article>
            ) : null}
          </div>

          <div className="stack-list">
            <div className="set-section-header desktop-pane-section-header">
              <div>
                <p className="card-kicker">Shared groups</p>
                <h3>Available from the runtime</h3>
              </div>
              <p className="inline-note">
                These come directly from the selected runtime and remain separate from your desktop-local saved sets.
              </p>
            </div>
            {snapshot.contexts.map((context) => (
              <article key={context.name} className="list-row set-row set-row-imported">
                <div className="set-row-main">
                  <div className="set-row-header">
                    <strong>
                      {contextDisplayLabel(settings, context.name)}
                      {activeContext === context.name ? " ✓" : ""}
                    </strong>
                    <span className={`pill ${activeContext === context.name ? "pill-ok" : "pill-soft"}`}>
                      {activeContext === context.name ? "Current" : "Shared"}
                    </span>
                  </div>
                  {contextDisplayLabel(settings, context.name) !== context.name ? (
                    <p className="inline-note">Shared group id: {context.name}</p>
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
                  {activeContext === context.name ? "Current shared group" : "Use shared group"}
                </button>
              </article>
            ))}
            {!snapshot.contexts.length ? (
              <p className="inline-note">
                No shared groups are currently available. Saved sets remain available even when
                runtime-level shared switching support is limited.
              </p>
            ) : null}
          </div>

          {contextResult ? (
            <p className={`inline-note ${contextResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
              Last shared-group result: {contextResult.message}
              {contextResult.remediation ? ` Remediation: ${contextResult.remediation}` : ""}
            </p>
          ) : null}
          {lastAction ? <p className="inline-note">{lastAction}</p> : null}
          </div>
        }
        secondary={
          <article className="diagnostic-card set-editor-card desktop-pane-column">
          <div className="stack-list">
            <div>
              <p className="card-kicker">{isEditingExistingSet ? "Edit set" : "New set"}</p>
              <h3>{isEditingExistingSet ? draft.label.trim() || draft.name : "Create a reusable set"}</h3>
            </div>
            <p className="inline-note">
              Save the profiles you want to switch together so Overview, project rules, and quick switching
              can work from one clear identity.
            </p>
          </div>

          <form className="stacked-form diagnostics-body" onSubmit={saveProfileSet}>
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
                onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
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
            <div className="button-row">
              <button
                className="primary-button"
                type="submit"
                disabled={
                  mutationLock.isBusy || !trimmedDraftName || !draftHasSelections || hasDuplicateSetName
                }
              >
                {isEditingExistingSet ? "Update set" : "Save set"}
              </button>
              {isEditingExistingSet ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setDraft({
                      sourceName: null,
                      name: "",
                      label: "",
                      profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
                    })
                  }
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
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
          </form>
          </article>
        }
      />
    </SectionCard>
  );
}
