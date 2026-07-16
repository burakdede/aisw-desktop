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
  profileSetDisplayLabel,
  profileSetHasUsableSelections,
  profileSetIsActive,
  toolProfileDisplayLabel,
} from "../../../lib/profile-display";
import {
  duplicateSetNameWarning,
  emptyRuleSetWarning,
  emptySetSelectionWarning,
  explicitRuleTargetWarning,
  importedContextActionLabel,
  importedContextStatus,
  ruleScopeLabel,
  ruleTargetLabel,
  savedRuleStatusLabel,
  selectedRuleMatchLabel,
  selectedRulePriorityLabel,
  selectedRuleSubtitle,
  setCommandResultLabel,
  workspaceSetActionLabel,
} from "../../../lib/sets-display";
import { WIDE_PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import type { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { SUPPORTED_TOOLS, toolShortName } from "../../../lib/tool-registry";
import { countLabel } from "../../../lib/utils";
import {
  DEFAULT_WORKSPACE_BINDING_SCOPE,
  type WorkspaceBindingScope,
} from "../../../lib/workspace-binding-contract";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { COMMAND_RESULT_GLOBAL_IDS } from "../../shared/command-result-scope";
import { resolveGlobalStateMode } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { resolveWorkspaceActivationTarget, workspaceBindingOptions } from "../../workspaces/workspace-activation";
import { parseWorkspaceBindings, parseWorkspaceStatus } from "../../workspaces/workspace-parsers";
import type { WorkspaceUnbindInput } from "../../../lib/client";
import {
  buildImportedContextRows,
  buildSavedSetRows,
  buildSavedSetCollection,
  buildSetSettingsUpdate,
  buildSelectedSetInspectorState,
  buildWorkspaceBindingTarget,
  countRuleUsageByContext,
  createEditableProfileSetDraft,
  createEditableRuleDraft,
  createEmptyEditableProfileSet,
  createEmptyRuleDraft,
  deletedSetActionLabel,
  duplicateEditableProfileSetDraft,
  hasDuplicateSetName,
  importedContextActivationResultLabel,
  ruleRowAriaLabel,
  RULE_SCOPE_OPTIONS,
  savedSetActionLabel,
  savedSetActivationLabel,
  setRowAriaLabel,
  ruleEditorDialogLabel,
  ruleEditorSubmitLabel,
  ruleEditorTitle,
  ruleTargetInputLabel,
  DEFAULT_SETS_PANEL_MODE,
  setActionsTriggerLabel,
  setEditorDialogLabel,
  setEditorKicker,
  setEditorSubmitLabel,
  setEditorTitle,
  SETS_MODE_OPTIONS,
  SETS_PANEL_COPY,
  type EditableProfileSet,
  type EditableRule,
  type SetPanelMode,
  unbindTargetForBinding,
  workspaceBindingTargetChanged,
} from "../sets-panel-display";

const TOOLS = SUPPORTED_TOOLS;

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

  const [mode, setMode] = useState<SetPanelMode>(DEFAULT_SETS_PANEL_MODE);
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
  const compactLayout = useCompactLayout(rootRef, WIDE_PANEL_COMPACT_BREAKPOINT);
  const [compactSetInspectorOpen, setCompactSetInspectorOpen] = useState(false);
  const [compactRuleInspectorOpen, setCompactRuleInspectorOpen] = useState(false);
  const [workspaceOverrideDismissed, setWorkspaceOverrideDismissed] = useState(false);
  const [scope, setScope] = useState<WorkspaceBindingScope>(
    DEFAULT_WORKSPACE_BINDING_SCOPE,
  );
  const [context, setContext] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [ruleDraft, setRuleDraft] = useState<EditableRule>({
    ...createEmptyRuleDraft(),
  });
  const [selectedBindingKey, setSelectedBindingKey] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState<EditableProfileSet>({
    ...createEmptyEditableProfileSet(TOOLS),
  });
  const [lastSetAction, setLastSetAction] = useState("");

  const localSets = settings.profile_sets ?? [];
  const importedContexts = snapshot.contexts;
  const activeContext = parseWorkspaceStatus(snapshot.workspace_status ?? undefined).currentContext;
  const setCommandResult =
    lastCommandResults.global[COMMAND_RESULT_GLOBAL_IDS.profileSet]
    ?? lastCommandResults.global[COMMAND_RESULT_GLOBAL_IDS.context]
    ?? null;
  const workspaceCommandResult =
    lastCommandResults.global[COMMAND_RESULT_GLOBAL_IDS.workspace] ?? null;
  const setResultLabel = setCommandResultLabel(setCommandResult, "set");
  const projectRuleResultLabel = setCommandResultLabel(workspaceCommandResult, "project-rule");

  const trimmedDraftName = setDraft.name.trim();
  const isEditingSet = setDraft.sourceName !== null;
  const draftHasSelections = Object.values(setDraft.profiles).some((profile) => profile.trim().length > 0);
  const duplicateSetName = hasDuplicateSetName(
    localSets,
    trimmedDraftName,
    setDraft.sourceName,
  );

  const selectedSet =
    localSets.find((entry) => entry.name === selectedSetName) ?? localSets[0] ?? null;
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
  const requiresExplicitTarget = ruleDraft.scope !== "default";
  const trimmedTargetValue = ruleDraft.targetValue.trim();
  const canSaveBinding =
    Boolean(ruleDraft.context) && (!requiresExplicitTarget || trimmedTargetValue.length > 0);
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
    setSetDraft(createEmptyEditableProfileSet(TOOLS));
  }

  function openNewSetEditor() {
    resetSetDraft();
    setSetEditorOpen(true);
  }

  function openEditSetEditor(set: NonNullable<DesktopSettings["profile_sets"]>[number]) {
    setSetMenuOpen(false);
    setSelectedSetName(set.name);
    setSetDraft(createEditableProfileSetDraft(set, TOOLS));
    setSetEditorOpen(true);
  }

  function duplicateSet(existingSet: NonNullable<DesktopSettings["profile_sets"]>[number]) {
    setSetMenuOpen(false);
    setSelectedSetName(existingSet.name);
    setSetDraft(duplicateEditableProfileSetDraft(existingSet, localSets, TOOLS));
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

    const nextSets = buildSavedSetCollection(localSets, setDraft, trimmedDraftName);

    updateSettingsMutation.mutate(
      buildSetSettingsUpdate(settings, nextSets),
      {
        onSuccess: () => {
          setSelectedSetName(trimmedDraftName);
          setLastSetAction(savedSetActionLabel(trimmedDraftName, setDraft.label, isEditingSet));
          closeSetEditor();
        },
      },
    );
  }

  function deleteSet(name: string) {
    setSetMenuOpen(false);
    const nextSets = localSets.filter((entry) => entry.name !== name);
    updateSettingsMutation.mutate(
      buildSetSettingsUpdate(settings, nextSets),
      {
        onSuccess: () => {
          if (setDraft.sourceName === name) {
            closeSetEditor();
          }
          if (selectedSetName === name) {
            setSelectedSetName(nextSets[0]?.name ?? null);
          }
          setLastSetAction(deletedSetActionLabel(localSets, name));
        },
      },
    );
  }

  function activateSavedSet(set: NonNullable<DesktopSettings["profile_sets"]>[number]) {
    const displayLabel = profileSetDisplayLabel(set);
    setSelectedSetName(set.name);
    activateProfileSetMutation.mutate(
      {
        name: set.name,
        label: displayLabel,
      },
      {
        onSuccess: () => {
          setLastSetAction(savedSetActivationLabel(displayLabel));
        },
      },
    );
  }

  function activateImportedContext(name: string, displayLabel: string) {
    useContextMutation.mutate(
      {
        context: name,
        stateMode: resolveGlobalStateMode(snapshot),
        label: displayLabel,
      },
      {
        onSuccess: () => {
          setLastSetAction(importedContextActivationResultLabel(displayLabel));
        },
      },
    );
  }

  function resetRuleDraft() {
    setRuleDraft(createEmptyRuleDraft(bindingOptions[0]?.value ?? ""));
  }

  function openRuleEditor() {
    resetRuleDraft();
    setRuleEditorOpen(true);
  }

  function openEditRuleEditor(binding: (typeof ruleEntries)[number]) {
    setRuleDraft(createEditableRuleDraft(binding));
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

    const target = buildWorkspaceBindingTarget(ruleDraft.scope, trimmedTargetValue);

    const saveRule = async () => {
      if (ruleDraft.source && workspaceBindingTargetChanged(ruleDraft.source, target)) {
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

  const ruleUsageCountByContext = countRuleUsageByContext(ruleEntries);
  const setRowModels = buildSavedSetRows({
    localSets,
    ruleUsageCountByContext,
    selectedSetName: selectedSet?.name ?? null,
    settings,
    snapshot,
    tools: TOOLS,
  });
  const selectedSetInspector = selectedSet
    ? buildSelectedSetInspectorState({
        selectedSet,
        ruleUsageCountByContext,
        settings,
        snapshot,
        tools: TOOLS,
      })
    : null;
  const importedContextRows = buildImportedContextRows({
    activeContext,
    importedContexts,
    settings,
    snapshot,
    tools: TOOLS,
  });

  const setRows = setRowModels.map((row) => (
      <button
        key={row.name}
        type="button"
        className={`list-row sets-library-row ${row.selected ? "sets-library-row-selected" : ""} ${row.active ? "sets-library-row-active" : ""}`}
        aria-pressed={row.selected}
        aria-label={setRowAriaLabel(row.displayLabel)}
        onClick={() => {
          setSelectedSetName(row.name);
          if (compactLayout) {
            setCompactSetInspectorOpen(true);
          }
        }}
      >
        <div className="sets-library-row-main">
          <div className="sets-library-row-title">
            <strong>{row.displayLabel}</strong>
            <span className={`sets-library-row-state sets-library-row-state-${row.status.tone}`}>
              <span aria-hidden="true">{row.status.symbol}</span>
              <span>{row.status.label}</span>
            </span>
          </div>
          <p className="sets-library-row-summary">{row.summary}</p>
          {row.missingSummary ? (
            <p className="inline-note sets-library-row-note">
              Missing: {row.missingSummary}
            </p>
          ) : null}
        </div>
        <div className="sets-library-row-meta">
          {row.usageCount ? <span>{countLabel(row.usageCount, "rule")}</span> : null}
          {row.active ? <span>{SETS_PANEL_COPY.currentLabel}</span> : null}
        </div>
      </button>
    ));

  const showSetLibrary = !compactLayout || !compactSetInspectorOpen;
  const showSetInspector = !compactLayout || compactSetInspectorOpen;
  const showRuleTable = !compactLayout || !compactRuleInspectorOpen;
  const showRuleInspector = !compactLayout || compactRuleInspectorOpen;

  return (
    <div ref={rootRef} className="sets-screen screen-content">
      <div className="sets-toolbar-row">
        <SegmentedControl
          ariaLabel={SETS_PANEL_COPY.modeAriaLabel}
          className="sets-mode-segmented"
          options={SETS_MODE_OPTIONS}
          value={mode}
          onChange={(value) => setMode(value as SetPanelMode)}
        />
        {mode === "sets" ? (
          <div className="button-row">
            <button className="primary-button" type="button" onClick={openNewSetEditor}>
              {SETS_PANEL_COPY.newSetButtonLabel}
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
              <section
                className="sets-pane sets-library-list-pane"
                aria-label={SETS_PANEL_COPY.setLibraryAriaLabel}
              >
                <div className="sets-library-list">{setRows}</div>
                {importedContextRows.length ? (
                  <details className="sets-imported-disclosure">
                    <summary>
                      {SETS_PANEL_COPY.importedContextsTitle}
                      <span className="sets-imported-disclosure-count">
                        {importedContextRows.length}
                      </span>
                    </summary>
                    <p className="inline-note">
                      {SETS_PANEL_COPY.importedContextsDetail}
                    </p>
                    <div className="stack-list">
                      {importedContextRows.map((row) => {
                        return (
                          <article key={row.name} className="list-row sets-cli-row">
                          <div className="sets-cli-row-copy">
                            <div className="sets-library-row-title">
                              <strong>
                                {row.displayLabel}
                              </strong>
                              <span className={`sets-library-row-state sets-library-row-state-${row.status.tone}`}>
                                <span aria-hidden="true">{row.status.symbol}</span>
                                <span>{row.status.label}</span>
                              </span>
                            </div>
                            <p className="sets-library-row-summary">
                              {SETS_PANEL_COPY.importedContextSummaryPrefix}
                              {row.summary}
                            </p>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={mutationLock.isBusy || row.active}
                            onClick={() => activateImportedContext(row.name, row.displayLabel)}
                          >
                            {row.actionLabel}
                          </button>
                          </article>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
                <div className="sets-footer-note">
                  {setResultLabel ? (
                    <p className={`inline-note ${setCommandResult?.status === "error" ? "diagnostic-status-fail" : ""}`}>
                      {setResultLabel}
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
                        <h3>{selectedSetInspector?.displayLabel}</h3>
                        <p className="inline-note sets-inspector-subtitle">
                          {selectedSetInspector?.selectionCountLabel}
                        </p>
                      </div>
                    </header>
                    <div className="button-row sets-inspector-actions">
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          mutationLock.isBusy ||
                          !selectedSetInspector?.canActivate
                        }
                        onClick={() => activateSavedSet(selectedSet)}
                      >
                        {selectedSetInspector?.activateLabel}
                      </button>
                      <button className="ghost-button" type="button" onClick={() => openEditSetEditor(selectedSet)}>
                        {SETS_PANEL_COPY.editSetLabel}
                      </button>
                      <div className="profile-row-actions" data-profile-row-actions>
                        <button
                          ref={setMenuAnchorRef}
                          className="ghost-button profile-row-actions-trigger"
                          type="button"
                          aria-label={setActionsTriggerLabel(profileSetDisplayLabel(selectedSet))}
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
                            aria-label={SETS_PANEL_COPY.setActionsMenuAriaLabel}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => openEditSetEditor(selectedSet)}
                            >
                              {SETS_PANEL_COPY.renameSetLabel}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => duplicateSet(selectedSet)}
                            >
                              {SETS_PANEL_COPY.duplicateSetLabel}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setSetMenuOpen(false);
                                setMode("rules");
                              }}
                            >
                              {SETS_PANEL_COPY.manageProjectRulesLabel}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="profile-row-actions-danger"
                              disabled={mutationLock.isBusy}
                              onClick={() => deleteSet(selectedSet.name)}
                            >
                              {SETS_PANEL_COPY.removeSetLabel}
                            </button>
                          </AnchoredMenu>
                        ) : null}
                      </div>
                    </div>
                    <section className="sets-detail-list" aria-label="Set mappings">
                      {selectedSetInspector?.mappedProfiles.map((profile) => (
                        <div key={profile.tool} className="sets-detail-row">
                          <span className="sets-detail-key">
                            <ToolBrand tool={profile.tool} className="tool-brand-inline" logoSize={16} />
                          </span>
                          <strong className="sets-detail-value">
                            {profile.value}
                          </strong>
                        </div>
                      ))}
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Project rules</span>
                        <strong className="sets-detail-value">
                          {selectedSetInspector?.projectRuleCount ?? 0} active
                        </strong>
                      </div>
                    </section>
                    {selectedSetInspector?.warning ? (
                      <p className="inline-note">{selectedSetInspector.warning}</p>
                    ) : null}
                  </>
                ) : (
                  <div className="profiles-empty-state sets-empty-state-inline">
                    <h3>{SETS_PANEL_COPY.noSavedSetSelectedTitle}</h3>
                    <p className="inline-note">
                      {SETS_PANEL_COPY.noSavedSetSelectedDetail}
                    </p>
                  </div>
                )}
              </aside>
            ) : null}
          />
        ) : (
          <section className="sets-empty-pane" aria-label={SETS_PANEL_COPY.setLibraryAriaLabel}>
            <div className="sets-empty-illustration" aria-hidden="true">
              <span>▤</span>
            </div>
            <h3>{SETS_PANEL_COPY.noSetsTitle}</h3>
            <p className="inline-note">{SETS_PANEL_COPY.noSetsPrimaryDetail}</p>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={openNewSetEditor}>
                {SETS_PANEL_COPY.createSetButtonLabel}
              </button>
            </div>
            <p className="inline-note">{SETS_PANEL_COPY.noSetsSecondaryDetail}</p>
          </section>
        )
      ) : (
        <div className="sets-rules-screen">
          {hasWorkspaceMismatch && !workspaceOverrideDismissed ? (
            <section className="sets-rules-banner">
              <div className="sets-rules-banner-copy">
                <div>
                  <h3>{SETS_PANEL_COPY.projectMismatchTitle}</h3>
                  <p className="inline-note">{SETS_PANEL_COPY.expectedSetPrefix}{expectedContextDisplay}</p>
                  <p className="inline-note">{SETS_PANEL_COPY.currentSetPrefix}{currentContextDisplay}</p>
                  <p className="inline-note">
                    Matched by this {ruleScopeLabel(workspaceCard.scope).toLowerCase()} rule:{" "}
                    {ruleTargetLabel(workspaceCard.scope, workspaceCard.target)}
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
                  {workspaceSetActionLabel(Boolean(expectedWorkspaceTarget))}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setWorkspaceOverrideDismissed(true)}
                >
                  {SETS_PANEL_COPY.keepCurrentSetLabel}
                </button>
              </div>
            </section>
          ) : null}

          <SplitView
            className="sets-rules-layout"
            primaryClassName="sets-rules-list-pane"
            secondaryClassName="sets-rules-inspector-pane"
            primary={showRuleTable ? (
              <section
                className="sets-pane sets-rules-list-panel"
                aria-label={SETS_PANEL_COPY.projectRulesAriaLabel}
              >
                <header className="sets-pane-header sets-rules-pane-header">
                  <div>
                    <h3>{SETS_PANEL_COPY.projectRulesTitle}</h3>
                    <p className="inline-note">
                      {SETS_PANEL_COPY.projectRulesDetail}
                    </p>
                  </div>
                  <div className="button-row">
                    <button className="primary-button" type="button" onClick={openRuleEditor}>
                      {SETS_PANEL_COPY.addRuleButtonLabel}
                    </button>
                    <div className="profile-row-actions" data-profile-row-actions>
                      <button
                        ref={rulesMenuAnchorRef}
                        className="ghost-button profile-row-actions-trigger profile-row-actions-trigger-visible"
                        type="button"
                        aria-label={SETS_PANEL_COPY.projectRulesActionsAriaLabel}
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
                          aria-label={SETS_PANEL_COPY.projectRulesActionsAriaLabel}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setRulesMenuOpen(false);
                              onOpenContexts();
                            }}
                          >
                            {SETS_PANEL_COPY.openSetsLabel}
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
                          aria-label={ruleRowAriaLabel(
                            contextDisplayLabel(settings, binding.context),
                          )}
                          onClick={() => {
                            setSelectedBindingKey(binding.key);
                            if (compactLayout) {
                              setCompactRuleInspectorOpen(true);
                            }
                          }}
                        >
                          <span>{ruleScopeLabel(binding.scope)}</span>
                          <span>{ruleTargetLabel(binding.scope, binding.target)}</span>
                          <span>{contextDisplayLabel(settings, binding.context)}</span>
                          <span>{savedRuleStatusLabel(matchedBindingKey === binding.key)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="sets-empty-state-inline">
                    <h4>{SETS_PANEL_COPY.noProjectRulesTitle}</h4>
                    <p className="inline-note">
                      {SETS_PANEL_COPY.noProjectRulesDetail}
                    </p>
                  </div>
                )}
                <div className="sets-footer-note">
                  {projectRuleResultLabel ? (
                    <p className={`inline-note ${workspaceCommandResult?.status === "error" ? "diagnostic-status-fail" : ""}`}>
                      {projectRuleResultLabel}
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
                          {selectedRuleSubtitle(Boolean(selectedRuleMatched))}
                        </p>
                      </div>
                    </header>
                    <section className="sets-detail-list" aria-label="Rule details">
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Rule type</span>
                        <strong className="sets-detail-value">{ruleScopeLabel(selectedRule.scope)}</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Match value</span>
                        <strong className="sets-detail-value">{ruleTargetLabel(selectedRule.scope, selectedRule.target)}</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Set</span>
                        <strong className="sets-detail-value">
                          {selectedRuleContextLabel ?? SETS_PANEL_COPY.setUnavailableLabel}
                        </strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Priority</span>
                        <strong className="sets-detail-value">{selectedRulePriorityLabel(selectedRule.scope)}</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Enabled</span>
                        <strong className="sets-detail-value">{SETS_PANEL_COPY.enabledLabel}</strong>
                      </div>
                      <div className="sets-detail-row">
                        <span className="sets-detail-key">Last matched</span>
                        <strong className="sets-detail-value">{selectedRuleMatchLabel(Boolean(selectedRuleMatched))}</strong>
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
                    <h3>{SETS_PANEL_COPY.noRuleSelectedTitle}</h3>
                    <p className="inline-note">
                      {SETS_PANEL_COPY.noRuleSelectedDetail}
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
          ariaLabel={setEditorDialogLabel(isEditingSet)}
          className="quick-switch-palette profile-sheet set-sheet"
          initialFocusSelector="input:not([disabled]), select:not([disabled]), button:not([disabled])"
          onClose={closeSetEditor}
        >
          <form className="stack-list" onSubmit={saveSet}>
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">{setEditorKicker(isEditingSet)}</p>
                <h3>{setEditorTitle(isEditingSet)}</h3>
              </div>
              <button className="ghost-button" type="button" onClick={closeSetEditor}>
                {SETS_PANEL_COPY.closeLabel}
              </button>
            </div>
            <div className="stacked-form diagnostics-body">
              <label>
                {SETS_PANEL_COPY.setNameLabel}
                <input
                  value={setDraft.name}
                  onChange={(event) => setSetDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                {SETS_PANEL_COPY.displayLabelFieldLabel}
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
                    <option value="">{SETS_PANEL_COPY.notIncludedLabel}</option>
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
                  {duplicateSetNameWarning(trimmedDraftName)}
                </p>
              ) : null}
              {!draftHasSelections ? (
                <p className="inline-note">{emptySetSelectionWarning()}</p>
              ) : null}
            </div>
            <footer className="quick-switch-footer">
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={closeSetEditor}>
                  {SETS_PANEL_COPY.cancelLabel}
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={mutationLock.isBusy || !trimmedDraftName || !draftHasSelections || duplicateSetName}
                >
                  {setEditorSubmitLabel(isEditingSet)}
                </button>
              </div>
            </footer>
          </form>
        </DialogSurface>
      ) : null}

      {ruleEditorOpen ? (
        <DialogSurface
          ariaLabel={ruleEditorDialogLabel(isEditingRule)}
          className="quick-switch-palette profile-sheet set-sheet"
          initialFocusSelector="select:not([disabled]), input:not([disabled]), button:not([disabled])"
          onClose={closeRuleEditor}
        >
          <form className="stack-list" onSubmit={submitRule}>
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">{SETS_PANEL_COPY.projectRuleKicker}</p>
                <h3>{ruleEditorTitle(isEditingRule)}</h3>
              </div>
              <button className="ghost-button" type="button" onClick={closeRuleEditor}>
                {SETS_PANEL_COPY.closeLabel}
              </button>
            </div>
            <div className="stacked-form diagnostics-body">
              <label>
                {SETS_PANEL_COPY.ruleScopeLabel}
                <select
                  value={ruleDraft.scope}
                  onChange={(event) =>
                    setRuleDraft((current) => ({
                      ...current,
                      scope: event.target.value as WorkspaceBindingScope,
                    }))
                  }
                >
                  {RULE_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {ruleDraft.scope !== "default" ? (
                <label>
                  {ruleTargetInputLabel(ruleDraft.scope)}
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
                {SETS_PANEL_COPY.setFieldLabel}
                <select
                  value={ruleDraft.context}
                  onChange={(event) =>
                    setRuleDraft((current) => ({
                      ...current,
                      context: event.target.value,
                    }))
                  }
                >
                  <option value="">{SETS_PANEL_COPY.selectSetLabel}</option>
                  {bindingOptions.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              {!bindingOptions.length ? (
                <p className="inline-note">{emptyRuleSetWarning()}</p>
              ) : null}
              {requiresExplicitTarget && trimmedTargetValue.length === 0 ? (
                <p className="inline-note">{explicitRuleTargetWarning(ruleDraft.scope)}</p>
              ) : null}
            </div>
            <footer className="quick-switch-footer">
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={closeRuleEditor}>
                  {SETS_PANEL_COPY.cancelLabel}
                </button>
                <button className="primary-button" type="submit" disabled={mutationLock.isBusy || !canSaveBinding}>
                  {ruleEditorSubmitLabel(isEditingRule)}
                </button>
              </div>
            </footer>
          </form>
        </DialogSurface>
      ) : null}
    </div>
  );
}
