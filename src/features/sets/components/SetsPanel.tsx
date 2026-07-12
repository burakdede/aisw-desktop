import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DialogSurface } from "../../../components/DialogSurface";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { SplitView } from "../../../components/SplitView";
import { getProjectBindings, getWorkspaceStatus } from "../../../lib/client";
import {
  contextDisplayLabel,
  missingProfileSetSelections,
  profileSetDisplayLabel,
  profileSetHasSelections,
  profileSetHasUsableSelections,
  profileSetIsActive,
  toolProfileDisplayLabel,
} from "../../../lib/profile-display";
import type { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { titleCase } from "../../../lib/utils";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { resolveGlobalStateMode } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { resolveWorkspaceActivationTarget, workspaceBindingOptions } from "../../workspaces/workspace-activation";
import { parseWorkspaceBindings, parseWorkspaceStatus } from "../../workspaces/workspace-parsers";
import type { WorkspaceUnbindInput } from "../../../lib/client";

const TOOLS = ["claude", "codex", "gemini"] as const;

type EditableProfileSet = {
  sourceName: string | null;
  name: string;
  label: string;
  profiles: Record<string, string>;
};

type BindScope = "default" | "path" | "git_remote";
type SetMode = "sets" | "rules";

export function SetsPanel({
  snapshot,
  settings,
  onOpenContexts,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  onOpenContexts: () => void;
}) {
  const readEnabled = useMutationAwareQueryEnabled();
  const projectBindings = useQuery({
    queryKey: ["project-bindings"],
    queryFn: getProjectBindings,
    enabled: readEnabled,
  });
  const workspaceStatus = useQuery({
    queryKey: ["workspace-status"],
    queryFn: getWorkspaceStatus,
    enabled: readEnabled,
  });
  const {
    updateSettingsMutation,
    activateProfileSetMutation,
    useContextMutation,
    workspaceBindMutation,
    workspaceUnbindMutation,
    workspaceGuardMutation,
    activateWorkspaceTargetMutation,
    mutationLock,
    lastCommandResults,
  } = useDesktopActions();

  const [mode, setMode] = useState<SetMode>("sets");
  const [selectedSetName, setSelectedSetName] = useState<string | null>(
    settings.profile_sets?.[0]?.name ?? null,
  );
  const [setEditorOpen, setSetEditorOpen] = useState(false);
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [workspaceOverrideDismissed, setWorkspaceOverrideDismissed] = useState(false);
  const [scope, setScope] = useState<BindScope>("default");
  const [context, setContext] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [selectedBindingKey, setSelectedBindingKey] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState<EditableProfileSet>({
    sourceName: null,
    name: "",
    label: "",
    profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
  });
  const [lastSetAction, setLastSetAction] = useState("");

  const localSets = settings.profile_sets ?? [];
  const importedContexts = snapshot.contexts;
  const activeContext = parseWorkspaceStatus(snapshot.workspace_status ?? undefined).currentContext;
  const setCommandResult =
    lastCommandResults.global["profile-set"] ?? lastCommandResults.global.context ?? null;
  const workspaceCommandResult = lastCommandResults.global.workspace ?? null;

  const trimmedDraftName = setDraft.name.trim();
  const isEditingSet = setDraft.sourceName !== null;
  const draftHasSelections = Object.values(setDraft.profiles).some((profile) => profile.trim().length > 0);
  const duplicateSetName =
    trimmedDraftName.length > 0 &&
    localSets.some((entry) => entry.name === trimmedDraftName && entry.name !== setDraft.sourceName);

  const selectedSet =
    localSets.find((entry) => entry.name === selectedSetName) ?? localSets[0] ?? null;
  const selectedSetMissingMappings = selectedSet ? missingProfileSetSelections(snapshot, selectedSet) : [];
  const selectedSetSelectionCount = selectedSet
    ? Object.values(selectedSet.profiles).filter((profile) => typeof profile === "string" && profile.trim().length > 0).length
    : 0;
  const usableSetCount = localSets.filter((entry) => profileSetHasUsableSelections(snapshot, entry)).length;
  const activeSetCount = localSets.filter((entry) => profileSetIsActive(snapshot, entry)).length;
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

  const bindingOptions = useMemo(
    () => workspaceBindingOptions(settings, snapshot),
    [settings, snapshot],
  );
  const bindingsSummary = parseWorkspaceBindings(projectBindings.data);
  const workspaceCard = parseWorkspaceStatus(workspaceStatus.data);
  const hasWorkspaceMismatch =
    workspaceCard.status === "mismatch" &&
    workspaceCard.expectedContext !== "none" &&
    workspaceCard.expectedContext !== workspaceCard.currentContext;
  const expectedContextDisplay = contextDisplayLabel(settings, workspaceCard.expectedContext);
  const currentContextDisplay = contextDisplayLabel(settings, workspaceCard.currentContext);
  const expectedWorkspaceTarget = resolveWorkspaceActivationTarget(
    workspaceCard.expectedContext,
    settings,
    snapshot,
  );
  const matchedBindingKey =
    workspaceCard.scope !== "none"
      ? `${workspaceCard.scope}:${workspaceCard.target}:${workspaceCard.expectedContext}`
      : null;
  const ruleEntries = bindingsSummary.bindings.map((binding) => ({
    ...binding,
    key: `${binding.scope}:${binding.target}:${binding.context}`,
  }));
  const selectedRule =
    ruleEntries.find((entry) => entry.key === selectedBindingKey) ??
    ruleEntries.find((entry) => entry.key === matchedBindingKey) ??
    ruleEntries[0] ??
    null;
  const selectedRuleMatched = selectedRule?.key === matchedBindingKey;
  const selectedRuleContextLabel = selectedRule
    ? contextDisplayLabel(settings, selectedRule.context)
    : null;
  const currentRuleCount = ruleEntries.length;
  const currentMatchLabel = hasWorkspaceMismatch
    ? "Needs review"
    : workspaceCard.status === "match"
      ? "Ready"
      : "No active match";
  const requiresExplicitTarget = scope !== "default";
  const trimmedTargetValue = targetValue.trim();
  const canSaveBinding =
    Boolean(context) && (!requiresExplicitTarget || trimmedTargetValue.length > 0);
  const canRemoveBinding = scope === "default" || trimmedTargetValue.length > 0;

  useEffect(() => {
    if (selectedSetName && localSets.some((entry) => entry.name === selectedSetName)) {
      return;
    }
    setSelectedSetName(localSets[0]?.name ?? null);
  }, [localSets, selectedSetName]);

  useEffect(() => {
    if (!bindingOptions.some((entry) => entry.value === context)) {
      setContext(bindingOptions[0]?.value ?? "");
    }
  }, [bindingOptions, context]);

  useEffect(() => {
    if (selectedBindingKey && ruleEntries.some((entry) => entry.key === selectedBindingKey)) {
      return;
    }
    setSelectedBindingKey(
      ruleEntries.find((entry) => entry.key === matchedBindingKey)?.key ?? ruleEntries[0]?.key ?? null,
    );
  }, [matchedBindingKey, ruleEntries, selectedBindingKey]);

  useEffect(() => {
    setWorkspaceOverrideDismissed(false);
  }, [workspaceCard.currentContext, workspaceCard.expectedContext, workspaceCard.status]);

  function resetSetDraft() {
    setSetDraft({
      sourceName: null,
      name: "",
      label: "",
      profiles: Object.fromEntries(TOOLS.map((tool) => [tool, ""])),
    });
  }

  function openNewSetEditor() {
    resetSetDraft();
    setSetEditorOpen(true);
  }

  function openEditSetEditor(set: NonNullable<DesktopSettings["profile_sets"]>[number]) {
    setSelectedSetName(set.name);
    setSetDraft({
      sourceName: set.name,
      name: set.name,
      label: set.label ?? "",
      profiles: Object.fromEntries(TOOLS.map((tool) => [tool, set.profiles[tool] ?? ""])),
    });
    setSetEditorOpen(true);
  }

  function closeSetEditor() {
    setSetEditorOpen(false);
    resetSetDraft();
  }

  function saveSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedDraftName || !draftHasSelections || duplicateSetName) {
      return;
    }

    const nextSets = [
      ...localSets.filter((entry) => entry.name !== (setDraft.sourceName ?? trimmedDraftName)),
      {
        name: trimmedDraftName,
        label: setDraft.label.trim() || null,
        profiles: Object.fromEntries(
          Object.entries(setDraft.profiles).map(([tool, profile]) => [tool, profile || null]),
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
          const displayLabel = setDraft.label.trim() || trimmedDraftName;
          setSelectedSetName(trimmedDraftName);
          setLastSetAction(
            `${isEditingSet ? "Updated" : "Saved"} set ${displayLabel}.`,
          );
          closeSetEditor();
        },
      },
    );
  }

  function deleteSet(name: string) {
    const displayLabel = profileSetDisplayLabel(
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
        onSuccess: () => {
          if (setDraft.sourceName === name) {
            closeSetEditor();
          }
          if (selectedSetName === name) {
            setSelectedSetName(localSets.filter((entry) => entry.name !== name)[0]?.name ?? null);
          }
          setLastSetAction(`Deleted set ${displayLabel}.`);
        },
      },
    );
  }

  function activateSavedSet(set: NonNullable<DesktopSettings["profile_sets"]>[number]) {
    setSelectedSetName(set.name);
    activateProfileSetMutation.mutate(
      {
        name: set.name,
        label: profileSetDisplayLabel(set),
      },
      {
        onSuccess: () => {
          setLastSetAction(`Activated saved set ${profileSetDisplayLabel(set)}.`);
        },
      },
    );
  }

  function activateImportedContext(name: string) {
    useContextMutation.mutate(
      {
        context: name,
        stateMode: resolveGlobalStateMode(snapshot),
        label: contextDisplayLabel(settings, name),
      },
      {
        onSuccess: () => {
          setLastSetAction(`Activated set ${contextDisplayLabel(settings, name)}.`);
        },
      },
    );
  }

  function openRuleEditor() {
    setRuleEditorOpen(true);
  }

  function closeRuleEditor() {
    setRuleEditorOpen(false);
  }

  function activateExpectedWorkspaceMatch() {
    if (!expectedWorkspaceTarget) {
      onOpenContexts();
      return;
    }
    activateWorkspaceTargetMutation.mutate({
      ...expectedWorkspaceTarget,
      matchedTarget: workspaceCard.target,
    });
  }

  function submitRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !canSaveBinding) {
      return;
    }

    const selectedContext = bindingOptions.find((entry) => entry.value === context);
    const label = selectedContext?.label.startsWith("Saved set: ")
      ? selectedContext.label.slice("Saved set: ".length)
      : undefined;

    const target =
      scope === "default"
        ? { scope: "default" as const }
        : scope === "path"
          ? { scope: "path" as const, path: trimmedTargetValue }
          : { scope: "git_remote" as const, pattern: trimmedTargetValue };

    workspaceBindMutation.mutate({ target, context, label });
  }

  function removeRule(target: WorkspaceUnbindInput) {
    workspaceUnbindMutation.mutate(target);
  }

  const setRows = localSets.map((set) => {
    const selected = selectedSet?.name === set.name;
    const active = profileSetIsActive(snapshot, set);
    const ready = profileSetHasUsableSelections(snapshot, set);
    const missing = missingProfileSetSelections(snapshot, set);
    const summary = TOOLS.map((tool) => {
      const profile = set.profiles[tool];
      const label = profile
        ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
        : "none";
      return `${tool}: ${label}`;
    }).join(" · ");

    return (
      <article
        key={set.name}
        className={`list-row sets-list-row ${selected ? "sets-list-row-selected" : ""} ${active ? "sets-list-row-active" : ""}`}
      >
        <button
          type="button"
          className="sets-list-row-button"
          aria-pressed={selected}
          aria-label={`Inspect set ${profileSetDisplayLabel(set)}`}
          onClick={() => setSelectedSetName(set.name)}
        >
          <div className="sets-list-row-header">
            <strong>{profileSetDisplayLabel(set)}</strong>
            <span
              className={`pill ${
                active ? "pill-ok" : ready ? "pill-soft" : "pill-warn"
              }`}
            >
              {active ? "Current" : ready ? "Ready" : "Needs attention"}
            </span>
          </div>
          <p>{summary}</p>
          {!profileSetHasSelections(set) ? (
            <p className="inline-note">
              Add at least one mapped profile before using this set in Overview, the menu bar, or project rules.
            </p>
          ) : missing.length ? (
            <p className="inline-note">
              Refresh or repair the missing mapped profiles before using this set. Missing:{" "}
              {missing.map(([tool, profile]) => `${tool}: ${profile}`).join(" · ")}
            </p>
          ) : null}
        </button>
        <div className="button-row sets-list-row-actions">
          <button
            className="primary-button"
            type="button"
            disabled={mutationLock.isBusy || active || !ready}
            onClick={() => activateSavedSet(set)}
          >
            {active ? "Current set" : "Switch to set"}
          </button>
          <button className="ghost-button" type="button" onClick={() => openEditSetEditor(set)}>
            Edit
          </button>
          <button
            className="ghost-button danger-button"
            type="button"
            disabled={mutationLock.isBusy}
            onClick={() => deleteSet(set.name)}
          >
            Delete
          </button>
        </div>
      </article>
    );
  });

  return (
    <div className="sets-screen screen-content">
      <div className="sets-toolbar-row">
        <SegmentedControl
          ariaLabel="Sets mode"
          className="sets-mode-segmented"
          options={[
            { value: "sets", label: "Set Library" },
            { value: "rules", label: "Project Rules" },
          ]}
          value={mode}
          onChange={(value) => setMode(value as SetMode)}
        />
        <div className="button-row">
          {mode === "sets" ? (
            <button className="primary-button" type="button" onClick={openNewSetEditor}>
              New Set
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={openRuleEditor}>
              Open Rule Editor
            </button>
          )}
        </div>
      </div>

      {mode === "sets" ? (
        localSets.length ? (
          <SplitView
            className="sets-library-layout"
            primaryClassName="sets-library-pane"
            secondaryClassName="sets-inspector-pane"
            primary={
              <section className="sets-pane sets-library-list-pane" aria-label="Set Library">
                <header className="sets-pane-header">
                  <div>
                    <h3>Set Library</h3>
                    <p className="inline-note">
                      {localSets.length} saved set{localSets.length === 1 ? "" : "s"}.
                      {usableSetCount
                        ? ` ${usableSetCount} ready to switch.`
                        : " Save a mapped set before using project rules or Quick Switch."}
                    </p>
                  </div>
                </header>
                <div className="sets-library-list">{setRows}</div>
                {importedContexts.length ? (
                  <section className="sets-secondary-section">
            <div className="sets-secondary-header">
                      <div>
                        <p className="card-kicker">Available CLI sets</p>
                        <h4>Detected on this Mac</h4>
                      </div>
                    </div>
                    <div className="stack-list">
                      {importedContexts.map((entry) => (
                        <article key={entry.name} className="list-row sets-cli-row">
                          <div className="sets-cli-row-copy">
                            <div className="sets-list-row-header">
                              <strong>
                                {contextDisplayLabel(settings, entry.name)}
                                {activeContext === entry.name ? " ✓" : ""}
                              </strong>
                              <span className={`pill ${activeContext === entry.name ? "pill-ok" : "pill-soft"}`}>
                                {activeContext === entry.name ? "Current" : "Imported"}
                              </span>
                            </div>
                            <p>
                              {Object.entries(entry.profiles)
                                .map(([tool, profile]) => {
                                  const label = profile
                                    ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
                                    : "none";
                                  return `Detected ${tool}: ${label}`;
                                })
                                .join(" · ")}
                            </p>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={mutationLock.isBusy || activeContext === entry.name}
                            onClick={() => activateImportedContext(entry.name)}
                          >
                            {activeContext === entry.name ? "Current set" : "Use this set"}
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
                {setCommandResult ? (
                  <p className={`inline-note ${setCommandResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
                    Last set result: {normalizeRuntimeLanguage(setCommandResult.message)}
                    {setCommandResult.remediation
                      ? ` Remediation: ${normalizeRuntimeLanguage(setCommandResult.remediation)}`
                      : ""}
                  </p>
                ) : null}
                {lastSetAction ? <p className="inline-note">{lastSetAction}</p> : null}
              </section>
            }
            secondary={
              <aside className="sets-pane sets-inspector">
                {selectedSet ? (
                  <>
                    <header className="sets-pane-header">
                      <div>
                        <h3>{profileSetDisplayLabel(selectedSet)}</h3>
                        <p className="inline-note">Set ID: {selectedSet.name}</p>
                      </div>
                      <span
                        className={`pill ${
                          profileSetIsActive(snapshot, selectedSet)
                            ? "pill-ok"
                            : profileSetHasUsableSelections(snapshot, selectedSet)
                              ? "pill-soft"
                              : "pill-warn"
                        }`}
                      >
                        {profileSetIsActive(snapshot, selectedSet)
                          ? "Current"
                          : profileSetHasUsableSelections(snapshot, selectedSet)
                            ? "Ready"
                            : "Needs attention"}
                      </span>
                    </header>
                    <div className="button-row sets-inspector-actions">
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          mutationLock.isBusy ||
                          profileSetIsActive(snapshot, selectedSet) ||
                          !profileSetHasUsableSelections(snapshot, selectedSet)
                        }
                        onClick={() => activateSavedSet(selectedSet)}
                      >
                        {profileSetIsActive(snapshot, selectedSet) ? "Active now" : "Activate set"}
                      </button>
                      <button className="ghost-button" type="button" onClick={() => openEditSetEditor(selectedSet)}>
                        Edit details
                      </button>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() => deleteSet(selectedSet.name)}
                      >
                        Delete set
                      </button>
                    </div>
                    <KeyValueGrid
                      rows={TOOLS.map((tool) => ({
                        label: tool === "claude" ? "Claude Code" : tool === "codex" ? "Codex CLI" : "Gemini CLI",
                        value: selectedSet.profiles[tool]
                          ? toolProfileDisplayLabel(settings, snapshot, tool, selectedSet.profiles[tool] as string)
                          : "Not included",
                      }))}
                    />
                    <p className="inline-note">
                      {selectedSetSelectionCount} profile{selectedSetSelectionCount === 1 ? "" : "s"} mapped.
                    </p>
                    {!profileSetHasSelections(selectedSet) ? (
                      <p className="inline-note">This saved set is empty and cannot be activated yet.</p>
                    ) : selectedSetMissingMappings.length ? (
                      <p className="inline-note">
                        Missing mapped profiles:{" "}
                        {selectedSetMissingMappings.map(([tool, profile]) => `${tool}: ${profile}`).join(" · ")}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="profiles-empty-state sets-empty-state-inline">
                    <h3>No saved set selected</h3>
                    <p className="inline-note">
                      Select a saved set to inspect mapped profiles and switch it.
                    </p>
                  </div>
                )}
              </aside>
            }
          />
        ) : (
          <section className="sets-empty-pane" aria-label="Set Library">
            <div className="sets-empty-illustration" aria-hidden="true">
              <span>▤</span>
            </div>
            <h3>Set Library</h3>
            <p className="card-kicker">No sets yet</p>
            <p className="inline-note">
              Combine work, personal, or client profiles so you can switch multiple coding agents in one action.
            </p>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={openNewSetEditor}>
                Create your first set
              </button>
            </div>
            <p className="inline-note">You can also switch individual profiles from Quick Switch.</p>
            {importedContexts.length ? (
              <section className="sets-secondary-section sets-empty-secondary">
                <div className="sets-secondary-header">
                  <div>
                    <p className="card-kicker">Available CLI sets</p>
                    <h4>Detected on this Mac</h4>
                  </div>
                </div>
                <div className="stack-list">
                  {importedContexts.map((entry) => (
                    <article key={entry.name} className="list-row sets-cli-row">
                      <div className="sets-cli-row-copy">
                        <div className="sets-list-row-header">
                          <strong>{contextDisplayLabel(settings, entry.name)}</strong>
                          <span className={`pill ${activeContext === entry.name ? "pill-ok" : "pill-soft"}`}>
                            {activeContext === entry.name ? "Current" : "Imported"}
                          </span>
                        </div>
                        <p>
                          {Object.entries(entry.profiles)
                            .map(([tool, profile]) => `Detected ${tool}: ${profile ?? "none"}`)
                            .join(" · ")}
                        </p>
                      </div>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={mutationLock.isBusy || activeContext === entry.name}
                        onClick={() => activateImportedContext(entry.name)}
                      >
                        {activeContext === entry.name ? "Current set" : "Use this set"}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            {setCommandResult ? (
              <p className={`inline-note ${setCommandResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
                Last set result: {normalizeRuntimeLanguage(setCommandResult.message)}
                {setCommandResult.remediation
                  ? ` Remediation: ${normalizeRuntimeLanguage(setCommandResult.remediation)}`
                  : ""}
              </p>
            ) : null}
            {lastSetAction ? <p className="inline-note">{lastSetAction}</p> : null}
          </section>
        )
      ) : (
        <div className="sets-rules-screen">
          {hasWorkspaceMismatch && !workspaceOverrideDismissed ? (
            <section className="diagnostic-card diagnostic-warn sets-rules-banner">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Attention</p>
                  <h3>Project mismatch</h3>
                </div>
                <span className="pill pill-warn">Needs review</span>
              </div>
              <p className="inline-note">Expected set: {expectedContextDisplay}</p>
              <p className="inline-note">Current set: {currentContextDisplay}</p>
              <p className="inline-note">
                Matched by this {formatRuleScopeLabel(workspaceCard.scope).toLowerCase()} rule:{" "}
                {formatRuleTarget(workspaceCard.scope, workspaceCard.target)}
              </p>
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={activateExpectedWorkspaceMatch}
                >
                  {expectedWorkspaceTarget ? "Use expected set now" : "Open Sets"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setWorkspaceOverrideDismissed(true)}
                >
                  Keep current set
                </button>
              </div>
            </section>
          ) : null}

          <section className="sets-rules-summary">
            <div className="sets-rules-summary-cell">
              <span className="overview-current-set-cell-label">Current set</span>
              <strong>{currentContextDisplay}</strong>
              {!hasWorkspaceMismatch ? <div>{`Current set: ${currentContextDisplay}`}</div> : null}
            </div>
            <div className="sets-rules-summary-cell">
              <span className="overview-current-set-cell-label">Expected set</span>
              <strong>{expectedContextDisplay}</strong>
              {!hasWorkspaceMismatch ? <div>{`Expected set: ${expectedContextDisplay}`}</div> : null}
            </div>
            <div className="sets-rules-summary-cell">
              <span className="overview-current-set-cell-label">Guard mode</span>
              <strong>{formatGuardModeLabel(bindingsSummary.guardMode)}</strong>
              <div>{`Guard mode: ${formatGuardModeLabel(bindingsSummary.guardMode)}`}</div>
            </div>
            <div className="sets-rules-summary-cell">
              <span className="overview-current-set-cell-label">Default set</span>
              <strong>{contextDisplayLabel(settings, bindingsSummary.defaultContext)}</strong>
              <div>{`Default set: ${contextDisplayLabel(settings, bindingsSummary.defaultContext)}`}</div>
            </div>
          </section>

          <SplitView
            className="sets-rules-layout"
            primaryClassName="sets-rules-list-pane"
            secondaryClassName="sets-rules-inspector-pane"
            primary={
              <section className="sets-pane sets-rules-list-panel" aria-label="Project Rules">
                <header className="sets-pane-header">
                  <div>
                    <h3>Project Rules</h3>
                    <p className="inline-note">
                      Review one rule at a time and keep only active path, remote, and default expectations.
                    </p>
                  </div>
                </header>
                {currentRuleCount ? (
                  <div className="sets-rule-table">
                    <div className="sets-rule-table-header" aria-hidden="true">
                      <span>Match</span>
                      <span>Value</span>
                      <span>Set</span>
                      <span>Status</span>
                    </div>
                    <div className="sets-rule-table-body">
                      {ruleEntries.map((binding) => (
                        <button
                          key={binding.key}
                          type="button"
                          className={`sets-rule-table-row ${
                            selectedRule?.key === binding.key ? "sets-rule-table-row-selected" : ""
                          } ${matchedBindingKey === binding.key ? "sets-rule-table-row-active" : ""}`}
                          aria-pressed={selectedRule?.key === binding.key}
                          aria-label={`Inspect rule for ${contextDisplayLabel(settings, binding.context)}`}
                          onClick={() => setSelectedBindingKey(binding.key)}
                        >
                          <span>{formatRuleScopeLabel(binding.scope)}</span>
                          <span>{formatRuleTarget(binding.scope, binding.target)}</span>
                          <span>{contextDisplayLabel(settings, binding.context)}</span>
                          <span>{matchedBindingKey === binding.key ? "Active" : "Saved"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="sets-empty-state-inline">
                    <h4>No saved rules</h4>
                    <p className="inline-note">
                      No explicit project rules are configured yet. Open the rule editor to attach a set to a default scope, folder, or git remote pattern.
                    </p>
                  </div>
                )}
                {workspaceCommandResult ? (
                  <p className={`inline-note ${workspaceCommandResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
                    Last project-rule result: {normalizeRuntimeLanguage(workspaceCommandResult.message)}
                    {workspaceCommandResult.remediation
                      ? ` Remediation: ${normalizeRuntimeLanguage(workspaceCommandResult.remediation)}`
                      : ""}
                  </p>
                ) : null}
              </section>
            }
            secondary={
              <aside className="sets-pane sets-rules-inspector">
                {selectedRule ? (
                  <>
                    <header className="sets-pane-header">
                      <div>
                        <h3>{selectedRuleContextLabel}</h3>
                        <p className="inline-note">
                          {selectedRuleMatched ? "This rule currently matches" : formatRuleScopeLabel(selectedRule.scope)}
                        </p>
                      </div>
                      <span className={`pill ${selectedRuleMatched ? "pill-ok" : "pill-soft"}`}>
                        {selectedRuleMatched ? "Matched" : formatRuleScopeLabel(selectedRule.scope)}
                      </span>
                    </header>
                    <KeyValueGrid
                      rows={[
                        { label: "Rule type", value: formatRuleScopeLabel(selectedRule.scope) },
                        { label: "Set", value: selectedRuleContextLabel ?? "Unknown" },
                        { label: "Target", value: formatRuleTarget(selectedRule.scope, selectedRule.target) },
                        { label: "Priority", value: selectedRule.scope === "default" ? "Fallback" : "Explicit" },
                      ]}
                    />
                    <p className="inline-note">
                      {selectedRule.scope === "default"
                        ? "Default set: this fallback applies when no path or git remote rule matches."
                        : `${selectedRule.scope === "path" ? "Path prefix" : "Git remote pattern"}: ${selectedRule.target}`}
                    </p>
                    {selectedRuleMatched ? <p className="inline-note">Matched rule ✓</p> : null}
                    <div className="button-row">
                      <button className="ghost-button" type="button" onClick={openRuleEditor}>
                        Edit selected rule
                      </button>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          removeRule(unbindTargetForBinding(selectedRule.scope, selectedRule.target))
                        }
                      >
                        Remove this rule
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="sets-empty-state-inline">
                    <h3>No rule selected</h3>
                    <p className="inline-note">
                      Select a rule to inspect it here or open the editor to create a new one.
                    </p>
                  </div>
                )}
              </aside>
            }
          />
        </div>
      )}

      {setEditorOpen ? (
        <DialogSurface
          ariaLabel={isEditingSet ? "Edit Set" : "New Set"}
          className="quick-switch-palette profile-sheet set-sheet"
          initialFocusSelector="input:not([disabled]), select:not([disabled]), button:not([disabled])"
          onClose={closeSetEditor}
        >
          <form className="stack-list" onSubmit={saveSet}>
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">{isEditingSet ? "Edit set" : "New set"}</p>
                <h3>{isEditingSet ? "Update this saved set" : "Create a saved set"}</h3>
                <p className="inline-note">
                  Pick the saved profiles that should move together when you switch work, personal, or project-specific identities.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeSetEditor}>
                Close
              </button>
            </div>
            <div className="stacked-form diagnostics-body">
              <label>
                Set name
                <input
                  value={setDraft.name}
                  onChange={(event) => setSetDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Label
                <input
                  value={setDraft.label}
                  onChange={(event) => setSetDraft((current) => ({ ...current, label: event.target.value }))}
                />
              </label>
              {TOOLS.map((tool) => (
                <label key={tool}>
                  {titleCase(tool)}
                  <select
                    value={setDraft.profiles[tool] ?? ""}
                    onChange={(event) =>
                      setSetDraft((current) => ({
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
              {duplicateSetName ? (
                <p className="inline-note">
                  A set named {trimmedDraftName} already exists. Rename the existing set or choose a different name.
                </p>
              ) : null}
              {!draftHasSelections ? (
                <p className="inline-note">Select at least one tool profile before saving this set.</p>
              ) : null}
            </div>
            <footer className="quick-switch-footer">
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={closeSetEditor}>
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={mutationLock.isBusy || !trimmedDraftName || !draftHasSelections || duplicateSetName}
                >
                  {isEditingSet ? "Update Set" : "Create Set"}
                </button>
              </div>
            </footer>
          </form>
        </DialogSurface>
      ) : null}

      {ruleEditorOpen ? (
        <DialogSurface
          ariaLabel="Rule Editor"
          className="quick-switch-palette profile-sheet set-sheet"
          initialFocusSelector="select:not([disabled]), input:not([disabled]), button:not([disabled])"
          onClose={closeRuleEditor}
        >
          <form className="stack-list" onSubmit={submitRule}>
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Project rule</p>
                <h3>Save or remove a rule</h3>
                <p className="inline-note">
                  Pick where the rule applies, then choose the set the app should expect in that project.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeRuleEditor}>
                Close
              </button>
            </div>
            <div className="stacked-form diagnostics-body">
              <label>
                Rule scope
                <select value={scope} onChange={(event) => setScope(event.target.value as BindScope)}>
                  <option value="default">Default set</option>
                  <option value="path">Path prefix</option>
                  <option value="git_remote">Git remote pattern</option>
                </select>
              </label>
              {scope !== "default" ? (
                <label>
                  {scope === "path" ? "Path" : "Git remote pattern"}
                  <input value={targetValue} onChange={(event) => setTargetValue(event.target.value)} />
                </label>
              ) : null}
              <label>
                Set
                <select value={context} onChange={(event) => setContext(event.target.value)}>
                  <option value="">Select set</option>
                  {bindingOptions.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              {!bindingOptions.length ? (
                <p className="inline-note">
                  No sets are available yet. Create one before saving a project rule.
                </p>
              ) : null}
              {requiresExplicitTarget && trimmedTargetValue.length === 0 ? (
                <p className="inline-note">
                  Enter a {scope === "path" ? "path prefix" : "git remote pattern"} before saving or removing this rule.
                </p>
              ) : null}
            </div>
            <footer className="quick-switch-footer">
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={closeRuleEditor}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={mutationLock.isBusy || !canSaveBinding}>
                  Save rule
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={mutationLock.isBusy || !canRemoveBinding}
                  onClick={() =>
                    removeRule(
                      scope === "default"
                        ? { scope: "default" }
                        : scope === "path"
                          ? { scope: "path", path: trimmedTargetValue }
                          : { scope: "git_remote", pattern: trimmedTargetValue },
                    )
                  }
                >
                  Remove rule
                </button>
              </div>
            </footer>
          </form>
        </DialogSurface>
      ) : null}
    </div>
  );
}

function unbindTargetForBinding(scope: string, target: string): WorkspaceUnbindInput {
  if (scope === "path") {
    return { scope: "path", path: target };
  }
  if (scope === "git_remote") {
    return { scope: "git_remote", pattern: target };
  }
  return { scope: "default" };
}

function formatRuleScopeLabel(scope: string) {
  switch (scope) {
    case "path":
      return "Folder";
    case "git_remote":
      return "Git remote";
    case "default":
      return "Default";
    case "none":
      return "No match";
    default:
      return scope.replace(/_/g, " ");
  }
}

function formatRuleTarget(scope: string, target: string) {
  if (scope === "default" || target === "default") {
    return "Default set";
  }
  if (!target || target === "none") {
    return "No target";
  }
  return target;
}

function formatGuardModeLabel(mode: string) {
  switch (mode) {
    case "warn":
      return "Warnings only";
    case "strict":
      return "Block mismatches";
    default:
      return mode.replace(/_/g, " ");
  }
}
