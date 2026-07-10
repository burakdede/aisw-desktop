import { FormEvent, useMemo, useState } from "react";
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
    <SectionCard title="Sets" kicker="Saved switching combinations">
      <div className="panel-grid panel-grid-2">
        <form className="stacked-form" onSubmit={saveProfileSet}>
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
          <button
            className="primary-button"
            type="submit"
            disabled={
              mutationLock.isBusy || !trimmedDraftName || !draftHasSelections || hasDuplicateSetName
            }
          >
            {isEditingExistingSet ? "Update set" : "Save set"}
          </button>
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

        <div className="stack-list">
          {localSets.map((set) => (
            <article key={set.name} className="list-row">
              <div>
                <strong>{profileSetDisplayLabel(set)}{profileSetIsActive(snapshot, set) ? " ✓" : ""}</strong>
                <p>
                  {TOOLS.map((tool) => {
                    const profile = set.profiles[tool];
                    const label = profile
                      ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
                      : "none";
                    return `${tool}: ${label}`;
                  }).join(" · ")}
                </p>
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
            </article>
          ))}
          {!localSets.length ? (
            <p className="inline-note">
              No local sets are stored yet. Save a work, personal, or client bundle here when you
              need a reusable switching combination.
            </p>
          ) : null}

          <div className="stack-list">
            <h3>Imported contexts</h3>
            {snapshot.contexts.map((context) => (
              <article key={context.name} className="list-row">
                <div>
                  <strong>
                    {contextDisplayLabel(settings, context.name)}
                    {activeContext === context.name ? " ✓" : ""}
                  </strong>
                  {contextDisplayLabel(settings, context.name) !== context.name ? (
                    <p className="inline-note">CLI context id: {context.name}</p>
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
                  {activeContext === context.name ? "Current context" : "Switch to imported context"}
                </button>
              </article>
            ))}
            {!snapshot.contexts.length ? (
              <p className="inline-note">
                No imported contexts are currently available. Local sets remain available even
                when lower-level context support is sparse.
              </p>
            ) : null}
          </div>
          {contextResult ? (
            <p className={`inline-note ${contextResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
              Last context result: {contextResult.message}
              {contextResult.remediation ? ` Remediation: ${contextResult.remediation}` : ""}
            </p>
          ) : null}
          {lastAction ? <p className="inline-note">{lastAction}</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}
