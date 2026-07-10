import { FormEvent, useMemo, useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import {
  profileSetHasSelections,
  profileSetDisplayLabel,
  profileSetIsActive,
  toolProfileDisplayLabel,
} from "../../../lib/profile-display";
import { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { resolveGlobalStateMode } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";

const TOOLS = ["claude", "codex", "gemini"] as const;

type EditableProfileSet = {
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
    name: "",
    label: "",
    profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
  });
  const [lastAction, setLastAction] = useState("");

  const localSets = settings.profile_sets ?? [];
  const trimmedDraftName = draft.name.trim();
  const draftHasSelections = Object.values(draft.profiles).some((profile) => profile.trim().length > 0);
  const isEditingExistingSet =
    trimmedDraftName.length > 0 && localSets.some((entry) => entry.name === trimmedDraftName);
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
    if (!name || !draftHasSelections) return;

    const nextSets = [
      ...localSets.filter((entry) => entry.name !== name),
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
    <SectionCard title="Contexts" kicker="Profile sets and work modes">
      <div className="panel-grid panel-grid-2">
        <form className="stacked-form" onSubmit={saveProfileSet}>
          <label>
            Profile set name
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
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
            disabled={mutationLock.isBusy || !trimmedDraftName || !draftHasSelections}
          >
            {isEditingExistingSet ? "Update profile set" : "Save profile set"}
          </button>
          {!draftHasSelections ? (
            <p className="inline-note">
              Select at least one tool profile before saving this profile set.
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
                    !profileSetHasSelections(set)
                  }
                  onClick={() => void activateProfileSet(set)}
                >
                  {profileSetIsActive(snapshot, set) ? "Active set" : "Activate set"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setDraft({
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
                  Add at least one mapped profile before using this set in overview, tray, or workspace bindings.
                </p>
              ) : null}
            </article>
          ))}
          {!localSets.length ? (
            <p className="inline-note">
              No local profile sets are stored yet. Save a work, personal, or client bundle here
              when you need a desktop-level grouping beyond the current `aisw` context list.
            </p>
          ) : null}

          <div className="stack-list">
            <h3>CLI contexts</h3>
            {snapshot.contexts.map((context) => (
              <article key={context.name} className="list-row">
                <div>
                  <strong>{context.name}</strong>
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
                  disabled={mutationLock.isBusy}
                  onClick={() =>
                    useContextMutation.mutate({
                      context: context.name,
                      stateMode: resolveGlobalStateMode(snapshot),
                    })
                  }
                >
                  Activate CLI context
                </button>
              </article>
            ))}
            {!snapshot.contexts.length ? (
              <p className="inline-note">
                No CLI contexts are currently stored in `aisw`. Local profile sets remain available
                even when the lower-level context API is sparse.
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
