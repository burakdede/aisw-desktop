import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { useCompactLayout } from "../../../components/useCompactLayout";
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
import { SUPPORTED_TOOLS } from "../../../lib/tool-registry";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { resolveGlobalStateMode } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { resolveWorkspaceActivationTarget, workspaceBindingOptions } from "../../workspaces/workspace-activation";
import { parseWorkspaceBindings, parseWorkspaceStatus } from "../../workspaces/workspace-parsers";
import type { WorkspaceUnbindInput } from "../../../lib/client";

const TOOLS = SUPPORTED_TOOLS;
const SETS_COMPACT_BREAKPOINT = 900;

type EditableProfileSet = {
  sourceName: string | null;
  name: string;
  label: string;
  profiles: Record<string, string>;
};

type BindScope = "default" | "path" | "git_remote";
type SetMode = "sets" | "rules";
type EditableRule = {
  source: WorkspaceUnbindInput | null;
  scope: BindScope;
  context: string;
  targetValue: string;
};

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
  const [setMenuOpen, setSetMenuOpen] = useState(false);
  const [rulesMenuOpen, setRulesMenuOpen] = useState(false);
  const setMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const rulesMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const compactLayout = useCompactLayout(rootRef, SETS_COMPACT_BREAKPOINT);
  const [compactSetInspectorOpen, setCompactSetInspectorOpen] = useState(false);
  const [compactRuleInspectorOpen, setCompactRuleInspectorOpen] = useState(false);
  const [workspaceOverrideDismissed, setWorkspaceOverrideDismissed] = useState(false);
  const [scope, setScope] = useState<BindScope>("default");
  const [context, setContext] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [ruleDraft, setRuleDraft] = useState<EditableRule>({
    source: null,
    scope: "default",
    context: "",
    targetValue: "",
  });
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
  const requiresExplicitTarget = ruleDraft.scope !== "default";
  const trimmedTargetValue = ruleDraft.targetValue.trim();
  const canSaveBinding =
    Boolean(ruleDraft.context) && (!requiresExplicitTarget || trimmedTargetValue.length > 0);
  const canRemoveBinding = ruleDraft.scope === "default" || trimmedTargetValue.length > 0;
  const isEditingRule = ruleDraft.source !== null;

  useEffect(() => {
    if (selectedSetName && localSets.some((entry) => entry.name === selectedSetName)) {
      return;
    }
    setSelectedSetName(localSets[0]?.name ?? null);
  }, [localSets, selectedSetName]);

  useEffect(() => {
    if (!bindingOptions.some((entry) => entry.value === ruleDraft.context)) {
      setRuleDraft((current) => ({
        ...current,
        context: bindingOptions[0]?.value ?? "",
      }));
    }
  }, [bindingOptions, ruleDraft.context]);

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

  useEffect(() => {
    setSetMenuOpen(false);
  }, [selectedSetName]);

  useEffect(() => {
    setRulesMenuOpen(false);
  }, [mode, selectedBindingKey]);

  useEffect(() => {
    if (!compactLayout) {
      setCompactSetInspectorOpen(false);
      setCompactRuleInspectorOpen(false);
    }
  }, [compactLayout]);

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
    setSetMenuOpen(false);
    setSelectedSetName(set.name);
    setSetDraft({
      sourceName: set.name,
      name: set.name,
      label: set.label ?? "",
      profiles: Object.fromEntries(TOOLS.map((tool) => [tool, set.profiles[tool] ?? ""])),
    });
    setSetEditorOpen(true);
  }

  function duplicateSet(existingSet: NonNullable<DesktopSettings["profile_sets"]>[number]) {
    setSetMenuOpen(false);
    setSelectedSetName(existingSet.name);
    const baseName = `${existingSet.name}-copy`;
    let nextName = baseName;
    let suffix = 2;
    while (localSets.some((entry) => entry.name === nextName)) {
      nextName = `${baseName}-${suffix}`;
      suffix += 1;
    }
    setSetDraft({
      sourceName: null,
      name: nextName,
      label: existingSet.label ? `${existingSet.label} Copy` : `${profileSetDisplayLabel(existingSet)} Copy`,
      profiles: Object.fromEntries(TOOLS.map((tool) => [tool, existingSet.profiles[tool] ?? ""])),
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
    setSetMenuOpen(false);
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

  function resetRuleDraft() {
    setRuleDraft({
      source: null,
      scope: "default",
      context: bindingOptions[0]?.value ?? "",
      targetValue: "",
    });
  }

  function openRuleEditor() {
    resetRuleDraft();
    setRuleEditorOpen(true);
  }

  function openEditRuleEditor(binding: (typeof ruleEntries)[number]) {
    setRuleDraft({
      source: unbindTargetForBinding(binding.scope, binding.target),
      scope: binding.scope === "path" || binding.scope === "git_remote" ? binding.scope : "default",
      context: binding.context,
      targetValue: binding.scope === "default" ? "" : binding.target,
    });
    setRuleEditorOpen(true);
  }

  function closeRuleEditor() {
    setRuleEditorOpen(false);
    resetRuleDraft();
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
    if (!ruleDraft.context || !canSaveBinding) {
      return;
    }

    const selectedContext = bindingOptions.find((entry) => entry.value === ruleDraft.context);
    const label = selectedContext?.label.startsWith("Saved set: ")
      ? selectedContext.label.slice("Saved set: ".length)
      : undefined;

    const target =
      ruleDraft.scope === "default"
        ? { scope: "default" as const }
        : ruleDraft.scope === "path"
          ? { scope: "path" as const, path: trimmedTargetValue }
          : { scope: "git_remote" as const, pattern: trimmedTargetValue };

    const saveRule = async () => {
      if (
        ruleDraft.source &&
        JSON.stringify(ruleDraft.source) !== JSON.stringify(unbindTargetForBinding(target.scope, trimmedTargetValue))
      ) {
        await workspaceUnbindMutation.mutateAsync(ruleDraft.source);
      }
      await workspaceBindMutation.mutateAsync({ target, context: ruleDraft.context, label });
      closeRuleEditor();
    };

    void saveRule();
  }

  function removeRule(target: WorkspaceUnbindInput) {
    workspaceUnbindMutation.mutate(target);
  }

  const ruleUsageCountByContext = new Map<string, number>();
  for (const entry of ruleEntries) {
    ruleUsageCountByContext.set(entry.context, (ruleUsageCountByContext.get(entry.context) ?? 0) + 1);
  }

  const setRows = localSets.map((set) => {
    const selected = selectedSet?.name === set.name;
    const active = profileSetIsActive(snapshot, set);
    const ready = profileSetHasUsableSelections(snapshot, set);
    const missing = missingProfileSetSelections(snapshot, set);
    const summary = TOOLS.map((tool) => {
      const profile = set.profiles[tool];
      const toolLabel = toolDisplayLabel(tool);
      const label = profile
        ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
        : "—";
      return `${toolLabel}: ${label}`;
    }).join(" · ");
    const statusLabel = active
      ? "Current"
      : ready
        ? "Available"
        : "Needs Attention";
    const usageCount = ruleUsageCountByContext.get(set.name) ?? 0;

    return (
      <button
        key={set.name}
        type="button"
        className={`list-row sets-library-row ${selected ? "sets-library-row-selected" : ""} ${active ? "sets-library-row-active" : ""}`}
        aria-pressed={selected}
        aria-label={`Inspect set ${profileSetDisplayLabel(set)}`}
        onClick={() => {
          setSelectedSetName(set.name);
          if (compactLayout) {
            setCompactSetInspectorOpen(true);
          }
        }}
      >
        <div className="sets-library-row-main">
          <div className="sets-library-row-title">
            <strong>{profileSetDisplayLabel(set)}</strong>
            <span className={`sets-library-row-state sets-library-row-state-${active ? "ready" : ready ? "available" : "warn"}`}>
              <span aria-hidden="true">{active || ready ? "●" : "▲"}</span>
              <span>{statusLabel}</span>
            </span>
          </div>
          <p className="sets-library-row-summary">{summary}</p>
          {missing.length ? (
            <p className="inline-note sets-library-row-note">
              Missing: {missing.map(([tool, profile]) => `${tool}: ${profile}`).join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="sets-library-row-meta">
          {usageCount ? <span>{usageCount} rule{usageCount === 1 ? "" : "s"}</span> : null}
          {active ? <span>Current</span> : null}
        </div>
      </button>
    );
  });

  const showSetLibrary = !compactLayout || !compactSetInspectorOpen;
  const showSetInspector = !compactLayout || compactSetInspectorOpen;
  const showRuleTable = !compactLayout || !compactRuleInspectorOpen;
  const showRuleInspector = !compactLayout || compactRuleInspectorOpen;

  return (
    <div ref={rootRef} className="sets-screen screen-content">
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
        {mode === "sets" ? (
          <div className="button-row">
            <button className="primary-button" type="button" onClick={openNewSetEditor}>
              New Set…
            </button>
          </div>
        ) : null}
      </div>

      {mode === "sets" ? (
        localSets.length ? (
          <SplitView
            className="sets-library-layout"
            primaryClassName="sets-library-pane"
            secondaryClassName="sets-inspector-pane"
            primary={showSetLibrary ? (
              <section className="sets-pane sets-library-list-pane" aria-label="Set Library">
                <div className="sets-library-list">{setRows}</div>
                {importedContexts.length ? (
                  <details className="sets-imported-disclosure">
                    <summary>
                      Imported CLI contexts
                      <span className="sets-imported-disclosure-count">
                        {importedContexts.length}
                      </span>
                    </summary>
                    <p className="inline-note">
                      Use an imported CLI context directly without turning it into a saved set.
                    </p>
                    <div className="stack-list">
                      {importedContexts.map((entry) => (
                        <article key={entry.name} className="list-row sets-cli-row">
                          <div className="sets-cli-row-copy">
                            <div className="sets-library-row-title">
                              <strong>
                                {contextDisplayLabel(settings, entry.name)}
                              </strong>
                              <span className={`sets-library-row-state sets-library-row-state-${activeContext === entry.name ? "ready" : "available"}`}>
                                <span aria-hidden="true">{activeContext === entry.name ? "●" : "○"}</span>
                                <span>{activeContext === entry.name ? "Current" : "Imported"}</span>
                              </span>
                            </div>
                            <p className="sets-library-row-summary">
                              {"CLI context · "}
                              {Object.entries(entry.profiles)
                                .map(([tool, profile]) => {
                                  const label = profile
                                    ? toolProfileDisplayLabel(settings, snapshot, tool, profile)
                                    : "—";
                                  return `${toolDisplayLabel(tool)}: ${label}`;
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
                            {activeContext === entry.name
                              ? "Current"
                              : `Use CLI Context ${contextDisplayLabel(settings, entry.name)}`}
                          </button>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : null}
                <div className="sets-footer-note">
                  {setCommandResult ? (
                    <p className={`inline-note ${setCommandResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
                      Last set result: {normalizeRuntimeLanguage(setCommandResult.message)}
                      {setCommandResult.remediation
                        ? ` Remediation: ${normalizeRuntimeLanguage(setCommandResult.remediation)}`
                        : ""}
                    </p>
                  ) : null}
                  {lastSetAction ? <p className="inline-note">{lastSetAction}</p> : null}
                </div>
              </section>
            ) : null}
            secondary={showSetInspector ? (
              <aside className="sets-pane sets-inspector">
                {selectedSet ? (
                  <>
                    <header className="sets-inspector-header">
                      <div>
                        {compactLayout ? (
                          <button
                            className="ghost-button sets-inspector-back"
                            type="button"
                            onClick={() => setCompactSetInspectorOpen(false)}
                          >
                            Back
                          </button>
                        ) : null}
                        <h3>{profileSetDisplayLabel(selectedSet)}</h3>
                        <p className="inline-note sets-inspector-subtitle">
                          {selectedSetSelectionCount} profile{selectedSetSelectionCount === 1 ? "" : "s"} mapped
                        </p>
                      </div>
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
                        {profileSetIsActive(snapshot, selectedSet)
                          ? "Current"
                          : `Switch to ${profileSetDisplayLabel(selectedSet)}`}
                      </button>
                      <button className="ghost-button" type="button" onClick={() => openEditSetEditor(selectedSet)}>
                        Edit…
                      </button>
                      <div className="profile-row-actions" data-profile-row-actions>
                        <button
                          ref={setMenuAnchorRef}
                          className="ghost-button profile-row-actions-trigger"
                          type="button"
                          aria-label={`More actions for ${profileSetDisplayLabel(selectedSet)}`}
                          aria-expanded={setMenuOpen}
                          onClick={() => setSetMenuOpen((open) => !open)}
                        >
                          •••
                        </button>
                        {setMenuOpen ? (
                          <AnchoredMenu
                            anchorRef={setMenuAnchorRef}
                            className="profile-row-actions-menu"
                            align="start"
                            boundaryAttribute="data-profile-row-actions"
                            containmentSelector=".sets-inspector"
                            role="menu"
                            aria-label="Set actions"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => openEditSetEditor(selectedSet)}
                            >
                              Rename…
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => duplicateSet(selectedSet)}
                            >
                              Duplicate…
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setSetMenuOpen(false);
                                setMode("rules");
                              }}
                            >
                              Manage Project Rules…
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="profile-row-actions-danger"
                              disabled={mutationLock.isBusy}
                              onClick={() => deleteSet(selectedSet.name)}
                            >
                              Remove…
                            </button>
                          </AnchoredMenu>
                        ) : null}
                      </div>
                    </div>
                    <section className="sets-detail-list" aria-label="Set mappings">
                      {TOOLS.map((tool) => (
                        <div key={tool} className="sets-detail-row">
                          <span className="sets-detail-key">
                            <ToolBrand tool={tool} className="tool-brand-inline" logoSize={16} />
                          </span>
                          <strong className="sets-detail-value">
                            {selectedSet.profiles[tool]
                              ? toolProfileDisplayLabel(settings, snapshot, tool, selectedSet.profiles[tool] as string)
                              : "Not included"}
                          </strong>
                        </div>
                      ))}
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Project rules</span>
                        <strong className="sets-detail-value">
                          {ruleUsageCountByContext.get(selectedSet.name) ?? 0} active
                        </strong>
                      </div>
                    </section>
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
            ) : null}
          />
        ) : (
          <section className="sets-empty-pane" aria-label="Set Library">
            <div className="sets-empty-illustration" aria-hidden="true">
              <span>▤</span>
            </div>
            <h3>No sets yet</h3>
            <p className="inline-note">Combine work, personal, or client profiles so you can switch multiple coding agents in one action.</p>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={openNewSetEditor}>
                Create Set…
              </button>
            </div>
            <p className="inline-note">You can also switch individual profiles from Quick Switch.</p>
          </section>
        )
      ) : (
        <div className="sets-rules-screen">
          {hasWorkspaceMismatch && !workspaceOverrideDismissed ? (
            <section className="sets-rules-banner">
              <div className="sets-rules-banner-copy">
                <div>
                  <h3>Project mismatch</h3>
                  <p className="inline-note">Expected set: {expectedContextDisplay}</p>
                  <p className="inline-note">Current set: {currentContextDisplay}</p>
                  <p className="inline-note">
                    Matched by this {formatRuleScopeLabel(workspaceCard.scope).toLowerCase()} rule:{" "}
                    {formatRuleTarget(workspaceCard.scope, workspaceCard.target)}
                  </p>
                </div>
              </div>
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={activateExpectedWorkspaceMatch}
                >
                  {expectedWorkspaceTarget ? "Use Expected Set" : "Open Sets"}
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

          <SplitView
            className="sets-rules-layout"
            primaryClassName="sets-rules-list-pane"
            secondaryClassName="sets-rules-inspector-pane"
            primary={showRuleTable ? (
              <section className="sets-pane sets-rules-list-panel" aria-label="Project Rules">
                <header className="sets-pane-header sets-rules-pane-header">
                  <div>
                    <h3>Project Rules</h3>
                    <p className="inline-note">
                      Match folders, remotes, or a default fallback to a saved set.
                    </p>
                  </div>
                  <div className="button-row">
                    <button className="primary-button" type="button" onClick={openRuleEditor}>
                      Add Rule…
                    </button>
                    <div className="profile-row-actions" data-profile-row-actions>
                      <button
                        ref={rulesMenuAnchorRef}
                        className="ghost-button profile-row-actions-trigger profile-row-actions-trigger-visible"
                        type="button"
                        aria-label="Project rules actions"
                        aria-expanded={rulesMenuOpen}
                        onClick={() => setRulesMenuOpen((open) => !open)}
                      >
                        •••
                      </button>
                      {rulesMenuOpen ? (
                        <AnchoredMenu
                          anchorRef={rulesMenuAnchorRef}
                          className="profile-row-actions-menu"
                          boundaryAttribute="data-profile-row-actions"
                          containmentSelector=".sets-rules-list-panel"
                          role="menu"
                          aria-label="Project rules actions"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setRulesMenuOpen(false);
                              onOpenContexts();
                            }}
                          >
                            Open Sets
                          </button>
                        </AnchoredMenu>
                      ) : null}
                    </div>
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
                          onClick={() => {
                            setSelectedBindingKey(binding.key);
                            if (compactLayout) {
                              setCompactRuleInspectorOpen(true);
                            }
                          }}
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
                    <h4>No project rules yet</h4>
                    <p className="inline-note">
                      Add a rule to match a default scope, folder, or git remote pattern to a saved set.
                    </p>
                  </div>
                )}
                <div className="sets-footer-note">
                  {workspaceCommandResult ? (
                    <p className={`inline-note ${workspaceCommandResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
                      Last project-rule result: {normalizeRuntimeLanguage(workspaceCommandResult.message)}
                      {workspaceCommandResult.remediation
                        ? ` Remediation: ${normalizeRuntimeLanguage(workspaceCommandResult.remediation)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
            secondary={showRuleInspector ? (
              <aside className="sets-pane sets-rules-inspector">
                {selectedRule ? (
                  <>
                    <header className="sets-inspector-header">
                      <div>
                        {compactLayout ? (
                          <button
                            className="ghost-button sets-inspector-back"
                            type="button"
                            onClick={() => setCompactRuleInspectorOpen(false)}
                          >
                            Back
                          </button>
                        ) : null}
                        <h3>{selectedRuleContextLabel}</h3>
                        <p className="inline-note sets-inspector-subtitle">
                          {selectedRuleMatched ? "This rule currently matches" : "Saved project rule"}
                        </p>
                      </div>
                    </header>
                    <section className="sets-detail-list" aria-label="Rule details">
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Rule type</span>
                        <strong className="sets-detail-value">{formatRuleScopeLabel(selectedRule.scope)}</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Match value</span>
                        <strong className="sets-detail-value">{formatRuleTarget(selectedRule.scope, selectedRule.target)}</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Set</span>
                        <strong className="sets-detail-value">{selectedRuleContextLabel ?? "Set Unavailable"}</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Priority</span>
                        <strong className="sets-detail-value">{selectedRule.scope === "default" ? "Fallback" : "Explicit"}</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Enabled</span>
                        <strong className="sets-detail-value">Yes</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Last matched</span>
                        <strong className="sets-detail-value">{selectedRuleMatched ? "Current project" : "Not matched"}</strong>
                      </div>
                    </section>
                    <div className="button-row sets-inspector-actions">
                      <button className="ghost-button" type="button" onClick={() => openEditRuleEditor(selectedRule)}>
                        Edit…
                      </button>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          removeRule(unbindTargetForBinding(selectedRule.scope, selectedRule.target))
                        }
                      >
                        Remove…
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="sets-empty-state-inline">
                    <h3>No rule selected</h3>
                    <p className="inline-note">
                      Select a rule to inspect it here.
                    </p>
                  </div>
                )}
              </aside>
            ) : null}
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
                <h3>{isEditingSet ? "Edit Set" : "New Set"}</h3>
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
                Display label
                <input
                  value={setDraft.label}
                  onChange={(event) => setSetDraft((current) => ({ ...current, label: event.target.value }))}
                />
              </label>
              {TOOLS.map((tool) => (
                <label key={tool}>
                  <ToolBrand tool={tool} className="tool-brand-inline" logoSize={16} />
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
                    <option value="">Not included</option>
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
                  {isEditingSet ? "Save Set" : "Create Set"}
                </button>
              </div>
            </footer>
          </form>
        </DialogSurface>
      ) : null}

      {ruleEditorOpen ? (
        <DialogSurface
          ariaLabel={isEditingRule ? "Edit Rule" : "Add Rule"}
          className="quick-switch-palette profile-sheet set-sheet"
          initialFocusSelector="select:not([disabled]), input:not([disabled]), button:not([disabled])"
          onClose={closeRuleEditor}
        >
          <form className="stack-list" onSubmit={submitRule}>
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Project rule</p>
                <h3>{isEditingRule ? "Edit Project Rule" : "Add Project Rule"}</h3>
              </div>
              <button className="ghost-button" type="button" onClick={closeRuleEditor}>
                Close
              </button>
            </div>
            <div className="stacked-form diagnostics-body">
              <label>
                Rule scope
                <select
                  value={ruleDraft.scope}
                  onChange={(event) =>
                    setRuleDraft((current) => ({
                      ...current,
                      scope: event.target.value as BindScope,
                    }))
                  }
                >
                  <option value="default">Default set</option>
                  <option value="path">Path prefix</option>
                  <option value="git_remote">Git remote pattern</option>
                </select>
              </label>
              {ruleDraft.scope !== "default" ? (
                <label>
                  {ruleDraft.scope === "path" ? "Path" : "Git remote pattern"}
                  <input
                    value={ruleDraft.targetValue}
                    onChange={(event) =>
                      setRuleDraft((current) => ({
                        ...current,
                        targetValue: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              <label>
                Set
                <select
                  value={ruleDraft.context}
                  onChange={(event) =>
                    setRuleDraft((current) => ({
                      ...current,
                      context: event.target.value,
                    }))
                  }
                >
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
                  Enter a {ruleDraft.scope === "path" ? "path prefix" : "git remote pattern"} before saving or removing this rule.
                </p>
              ) : null}
            </div>
            <footer className="quick-switch-footer">
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={closeRuleEditor}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={mutationLock.isBusy || !canSaveBinding}>
                  {isEditingRule ? "Save Rule" : "Add Rule"}
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

function toolDisplayLabel(tool: string) {
  switch (tool) {
    case "claude":
      return "Claude";
    case "codex":
      return "Codex";
    case "gemini":
      return "Gemini";
    default:
      return tool;
  }
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
