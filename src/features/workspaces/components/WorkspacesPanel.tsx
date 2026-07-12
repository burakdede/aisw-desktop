import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProjectBindings, getWorkspaceStatus } from "../../../lib/client";
import { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
import { DialogSurface } from "../../../components/DialogSurface";
import { SplitView } from "../../../components/SplitView";
import { contextDisplayLabel } from "../../../lib/profile-display";
import { useDesktopActions } from "../../shared/useDesktopActions";
import {
  parseWorkspaceBindings,
  parseWorkspaceStatus,
} from "../workspace-parsers";
import {
  resolveWorkspaceActivationTarget,
  workspaceBindingOptions,
} from "../workspace-activation";
import type { WorkspaceUnbindInput } from "../../../lib/client";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";

type BindScope = "default" | "path" | "git_remote";

export function WorkspacesPanel({
  snapshot,
  settings,
  onOpenContexts,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  onOpenContexts: () => void;
}) {
  const readEnabled = useMutationAwareQueryEnabled();
  const bindings = useQuery({
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
    workspaceBindMutation,
    workspaceUnbindMutation,
    workspaceGuardMutation,
    activateWorkspaceTargetMutation,
    mutationLock,
    lastCommandResults,
  } = useDesktopActions();
  const [scope, setScope] = useState<BindScope>("default");
  const bindingOptions = useMemo(
    () => workspaceBindingOptions(settings, snapshot),
    [settings, snapshot],
  );
  const [context, setContext] = useState(bindingOptions[0]?.value ?? "");
  const [targetValue, setTargetValue] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [workspaceOverrideDismissed, setWorkspaceOverrideDismissed] = useState(false);
  const [selectedBindingKey, setSelectedBindingKey] = useState<string | null>(null);
  const trimmedTargetValue = targetValue.trim();
  const requiresExplicitTarget = scope !== "default";
  const canSaveBinding =
    Boolean(context) && (!requiresExplicitTarget || trimmedTargetValue.length > 0);
  const canRemoveBinding = scope === "default" || trimmedTargetValue.length > 0;

  const statusCard = parseWorkspaceStatus(workspaceStatus.data);
  const bindingsSummary = parseWorkspaceBindings(bindings.data);
  const hasWorkspaceMismatch =
    statusCard.status === "mismatch" &&
    statusCard.expectedContext !== "none" &&
    statusCard.expectedContext !== statusCard.currentContext;
  const workspaceResult = lastCommandResults.global.workspace;
  const expectedContextDisplay = contextDisplayLabel(settings, statusCard.expectedContext);
  const currentContextDisplay = contextDisplayLabel(settings, statusCard.currentContext);
  const expectedWorkspaceTarget = resolveWorkspaceActivationTarget(
    statusCard.expectedContext,
    settings,
    snapshot,
  );
  const matchedBindingKey =
    statusCard.scope !== "none"
      ? `${statusCard.scope}:${statusCard.target}:${statusCard.expectedContext}`
      : null;
  const savedRuleCount = bindingsSummary.bindings.length;
  const ruleEntries = bindingsSummary.bindings.map((binding) => ({
    ...binding,
    key: `${binding.scope}:${binding.target}:${binding.context}`,
  }));
  const currentMatchLabel = hasWorkspaceMismatch
    ? "Needs review"
    : statusCard.status === "match"
      ? "Ready"
      : "No active match";
  const statusToneClass = hasWorkspaceMismatch ? "pill-warn" : "pill-ok";

  useEffect(() => {
    setWorkspaceOverrideDismissed(false);
  }, [statusCard.currentContext, statusCard.expectedContext, statusCard.status]);

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
      ruleEntries.find((entry) => entry.key === matchedBindingKey)?.key ??
        ruleEntries[0]?.key ??
        null,
    );
  }, [matchedBindingKey, ruleEntries, selectedBindingKey]);

  const selectedRule =
    ruleEntries.find((entry) => entry.key === selectedBindingKey) ??
    ruleEntries.find((entry) => entry.key === matchedBindingKey) ??
    ruleEntries[0] ??
    null;
  const selectedRuleContextLabel = selectedRule
    ? contextDisplayLabel(settings, selectedRule.context)
    : null;
  const selectedRuleMatched = selectedRule?.key === matchedBindingKey;

  function activateExpectedWorkspaceTarget() {
    if (!expectedWorkspaceTarget) {
      onOpenContexts();
      return;
    }
    activateWorkspaceTargetMutation.mutate({
      ...expectedWorkspaceTarget,
      matchedTarget: statusCard.target,
    });
  }

  function submitBind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;
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

  function closeEditor() {
    setIsEditorOpen(false);
  }

  return (
    <SectionCard title="Project rules" kicker="Expected sets by folder or remote">
      <article className="diagnostic-card workspaces-intro-card">
        <div className="workspaces-intro-copy">
          <div>
            <p className="card-kicker">Project rules</p>
            <h3>
              {savedRuleCount
                ? `${savedRuleCount} saved rule${savedRuleCount === 1 ? "" : "s"}`
                : "No saved rules"}
            </h3>
            <p className="inline-note">
              Attach a saved set to the current folder, a path prefix, or a git remote pattern so project switching stays predictable.
            </p>
          </div>
          <span className={`pill ${statusToneClass}`}>{currentMatchLabel}</span>
        </div>
        <div className="workspaces-intro-grid">
          <div>
            <span className="overview-current-set-cell-label">Current match</span>
            <strong>{currentMatchLabel}</strong>
          </div>
          <div>
            <span className="overview-current-set-cell-label">Guard mode</span>
            <strong>{bindingsSummary.guardMode}</strong>
          </div>
          <div>
            <span className="overview-current-set-cell-label">Expected set</span>
            <strong>{expectedContextDisplay}</strong>
          </div>
        </div>
      </article>
      <SplitView
        className="workspaces-layout"
        primaryClassName="workspaces-editor-pane"
        secondaryClassName="workspaces-status-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card workspaces-editor-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Rule editor</p>
                  <h3>Create or update rules in a focused sheet</h3>
                </div>
                <span className="pill pill-soft">
                  {bindingOptions.length
                    ? `${bindingOptions.length} set option${bindingOptions.length === 1 ? "" : "s"}`
                    : "No sets available"}
                </span>
              </div>
              <p className="inline-note">
                Keep the current project match and saved rules visible here, then open the editor only when you need to add or change a rule.
              </p>
              <div className="workspaces-summary-grid">
                <div>
                  <span className="overview-current-set-cell-label">Default target</span>
                  <strong>{scope === "default" ? "Default set" : scope === "path" ? "Path prefix" : "Git remote pattern"}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Selected set</span>
                  <strong>{context ? contextDisplayLabel(settings, context) : "Choose a set"}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Guard mode</span>
                  <strong>{bindingsSummary.guardMode}</strong>
                </div>
              </div>
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={() => setIsEditorOpen(true)}
                >
                  Open Rule Editor
                </button>
              </div>
            </article>
            <article className="diagnostic-card workspace-guard-section">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Guard mode</p>
                  <h3>How strictly should mismatches be enforced?</h3>
                </div>
                <span className="pill pill-soft">{bindingsSummary.guardMode}</span>
              </div>
              <p className="inline-note">
                Use warnings for flexible workflows or strict mode when a mismatched account should block work immediately.
              </p>
              <div className="button-row">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={() => workspaceGuardMutation.mutate("warn")}
                >
                  Warn on mismatch
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={() => workspaceGuardMutation.mutate("strict")}
                >
                  Block on mismatch
                </button>
              </div>
            </article>
          </div>
        }
        secondary={
          <div className="stack-list desktop-pane-column">
          {hasWorkspaceMismatch && !workspaceOverrideDismissed ? (
            <article className="diagnostic-card diagnostic-warn workspaces-mismatch-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Attention</p>
                  <h3>Project mismatch</h3>
                </div>
                <span className="pill pill-warn">Needs review</span>
              </div>
              <p className="inline-note">
                This project matches <strong>{expectedContextDisplay}</strong>, but the current
                active set is <strong>{currentContextDisplay}</strong>.
              </p>
              <p className="inline-note">
                Matched by this {statusCard.scope} rule: {statusCard.target}
              </p>
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={activateExpectedWorkspaceTarget}
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
            </article>
          ) : null}

          <article className="diagnostic-card workspaces-status-card">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Resolution</p>
                <h3>Current project match</h3>
              </div>
              <span className={`pill ${statusToneClass}`}>{statusCard.status}</span>
            </div>
            <div className="workspaces-status-main">
              <div className="stack-list">
                <div className="workspaces-status-grid">
                  <div>
                    <span className="overview-current-set-cell-label">Current set</span>
                    <strong>{currentContextDisplay}</strong>
                    <p className="inline-note">Current set: {currentContextDisplay}</p>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Expected set</span>
                    <strong>{expectedContextDisplay}</strong>
                    <p className="inline-note">Expected set: {expectedContextDisplay}</p>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Rule type</span>
                    <strong>{statusCard.scope}</strong>
                    <p className="inline-note">Rule type: {statusCard.scope}</p>
                  </div>
                </div>
                <div className="workspaces-status-grid">
                  <div>
                    <span className="overview-current-set-cell-label">Matched target</span>
                    <strong>{statusCard.target}</strong>
                    <p className="inline-note">Matched target: {statusCard.target}</p>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Guard mode</span>
                    <strong>{bindingsSummary.guardMode}</strong>
                    <p className="inline-note">Guard mode: {bindingsSummary.guardMode}</p>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Default set</span>
                    <strong>{contextDisplayLabel(settings, bindingsSummary.defaultContext)}</strong>
                    <p className="inline-note">
                      Default set: {contextDisplayLabel(settings, bindingsSummary.defaultContext)}
                    </p>
                  </div>
                </div>
              </div>
              <aside className="workspaces-status-rail">
                <span className="overview-current-set-cell-label">Rules</span>
                <p className="inline-note">
                  Review what this folder matched before changing or removing any explicit rule.
                </p>
                <div className="workspaces-rule-count">
                  <strong>{savedRuleCount}</strong>
                  <span>saved</span>
                </div>
              </aside>
            </div>
          </article>

          <article className="diagnostic-card workspaces-rules-card">
            <div className="desktop-pane-section-header workspaces-rules-header">
              <div>
                <p className="card-kicker">Rules</p>
                <h3>Saved matching rules</h3>
                <p className="inline-note">
                  Review one rule at a time, then remove stale path and remote rules when a project moves or gets renamed.
                </p>
              </div>
              <span className="pill pill-soft">
                {savedRuleCount ? `${savedRuleCount} saved` : "No saved rules"}
              </span>
            </div>
            {ruleEntries.length ? (
              <SplitView
                className="workspaces-rules-layout"
                primaryClassName="workspaces-rules-list-pane"
                secondaryClassName="workspaces-rules-detail-pane"
                primary={
                  <div className="stack-list workspaces-rules-list">
                    {ruleEntries.map((binding) => {
                      const isMatchedBinding = matchedBindingKey === binding.key;
                      const isSelectedBinding = selectedRule?.key === binding.key;

                      return (
                        <button
                          key={binding.key}
                          type="button"
                          className={`list-row workspaces-rule-row ${
                            isSelectedBinding ? "workspaces-rule-row-selected" : ""
                          } ${isMatchedBinding ? "workspaces-rule-row-active" : ""}`}
                          aria-label={`Inspect rule for ${contextDisplayLabel(settings, binding.context)}`}
                          aria-pressed={isSelectedBinding}
                          onClick={() => setSelectedBindingKey(binding.key)}
                        >
                          <div className="workspaces-rule-row-main">
                            <div className="workspaces-rule-row-header">
                              <strong>{contextDisplayLabel(settings, binding.context)}</strong>
                              <span className={`pill ${isMatchedBinding ? "pill-ok" : "pill-soft"}`}>
                                {isMatchedBinding ? "Matched" : binding.scope}
                              </span>
                            </div>
                            <p>{binding.scope === "default" ? "default rule" : binding.target}</p>
                          </div>
                          <span className="desktop-source-chevron" aria-hidden="true">
                            ›
                          </span>
                        </button>
                      );
                    })}
                  </div>
                }
                secondary={
                  selectedRule ? (
                    <article className="workspaces-rule-detail-card">
                      <div className="desktop-pane-section-header">
                        <div>
                          <p className="card-kicker">Selected rule</p>
                          <h3>{selectedRuleContextLabel}</h3>
                        </div>
                        <span className={`pill ${selectedRuleMatched ? "pill-ok" : "pill-soft"}`}>
                          {selectedRuleMatched ? "Matched" : selectedRule.scope}
                        </span>
                      </div>
                      <div className="workspaces-rule-detail-grid">
                        <div>
                          <span className="overview-current-set-cell-label">Rule type</span>
                          <strong>{selectedRule.scope}</strong>
                          <p className="inline-note">Rule type: {selectedRule.scope}</p>
                        </div>
                        <div>
                          <span className="overview-current-set-cell-label">Set</span>
                          <strong>{selectedRuleContextLabel}</strong>
                          <p className="inline-note">Rule set: {selectedRuleContextLabel}</p>
                        </div>
                        <div>
                          <span className="overview-current-set-cell-label">Target</span>
                          <strong>{selectedRule.scope === "default" ? "Default set" : selectedRule.target}</strong>
                          <p className="inline-note">
                            {selectedRule.scope === "default"
                              ? "default · applies when no path or remote rule matches"
                              : `${selectedRule.scope} · ${selectedRule.target}`}
                          </p>
                        </div>
                      </div>
                      {selectedRuleMatched ? <p className="inline-note">Matched rule ✓</p> : null}
                      <div className="button-row">
                        <button
                          className="ghost-button danger-button"
                          type="button"
                          disabled={mutationLock.isBusy}
                          onClick={() =>
                            workspaceUnbindMutation.mutate(
                              unbindTargetForBinding(selectedRule.scope, selectedRule.target),
                            )
                          }
                        >
                          Remove this rule
                        </button>
                      </div>
                    </article>
                  ) : null
                }
              />
            ) : (
              <p className="inline-note">
                No explicit project rules are configured yet. Save one from the form to attach a
                set to a default scope, path prefix, or git remote pattern.
              </p>
            )}
          </article>
          {workspaceResult ? (
            <p className={`inline-note ${workspaceResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
              Last project-rule result: {workspaceResult.message}
              {workspaceResult.remediation ? ` Remediation: ${workspaceResult.remediation}` : ""}
            </p>
          ) : null}
          </div>
        }
      />
      {isEditorOpen ? (
        <DialogSurface
          ariaLabel="Rule Editor"
          className="quick-switch-palette profile-sheet set-sheet"
          initialFocusSelector='select:not([disabled]), input:not([disabled]), button:not([disabled])'
          onClose={closeEditor}
        >
          <form className="stack-list" onSubmit={submitBind}>
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Project rule</p>
                <h3>Save or remove a rule</h3>
                <p className="inline-note">
                  Pick where the rule applies, then choose the set the app should expect in that project.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeEditor}>
                Close
              </button>
            </div>
            <div className="stacked-form diagnostics-body">
              <div className="workspaces-editor-grid">
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
              </div>
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
                <button className="ghost-button" type="button" onClick={closeEditor}>
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
                    workspaceUnbindMutation.mutate(
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
    </SectionCard>
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
