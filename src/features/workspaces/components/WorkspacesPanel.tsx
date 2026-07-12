import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProjectBindings, getWorkspaceStatus } from "../../../lib/client";
import { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
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
  const [workspaceOverrideDismissed, setWorkspaceOverrideDismissed] = useState(false);
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

  useEffect(() => {
    setWorkspaceOverrideDismissed(false);
  }, [statusCard.currentContext, statusCard.expectedContext, statusCard.status]);

  useEffect(() => {
    if (!bindingOptions.some((entry) => entry.value === context)) {
      setContext(bindingOptions[0]?.value ?? "");
    }
  }, [bindingOptions, context]);

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

  return (
    <SectionCard title="Project rules" kicker="Expected sets by folder or remote">
      <SplitView
        primary={
          <div className="stack-list desktop-pane-column">
          <article className="diagnostic-card">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Project rules</p>
                <h3>{bindingsSummary.bindings.length ? `${bindingsSummary.bindings.length} saved rule${bindingsSummary.bindings.length === 1 ? "" : "s"}` : "No saved rules"}</h3>
              </div>
              <span className="pill pill-soft">
                {bindingsSummary.bindings.length
                  ? `${bindingsSummary.bindings.length} saved`
                  : "No saved rules"}
              </span>
            </div>
            <p className="inline-note">
              Attach a saved set to the current folder, a path prefix, or a git remote pattern so project switching stays predictable.
            </p>
            <div className="workspaces-intro-meta">
              <div>
                <span className="overview-current-set-cell-label">Current match</span>
                <strong>{hasWorkspaceMismatch ? "Needs review" : "Ready"}</strong>
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
          <form className="stacked-form diagnostic-card workspaces-editor-card" onSubmit={submitBind}>
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Editor</p>
                <h3>Save or remove a project rule</h3>
              </div>
              <p className="inline-note">
                Pick where the rule applies, then choose the set the app should expect in that project.
              </p>
            </div>
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
            <div className="button-row">
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
            {!bindingOptions.length ? (
              <p className="inline-note">
                No sets are available yet. Create one before saving a project rule.
              </p>
            ) : null}
            {requiresExplicitTarget && trimmedTargetValue.length === 0 ? (
              <p className="inline-note">
                Enter a {scope === "path" ? "path prefix" : "git remote pattern"} before saving or removing this binding.
              </p>
            ) : null}
            <div className="desktop-pane-section workspace-guard-section">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Guard mode</p>
                  <h3>How strictly should mismatches be enforced?</h3>
                </div>
                <p className="inline-note">
                  Use warnings for flexible workflows or strict mode when a mismatched account should block work immediately.
                </p>
              </div>
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
            </div>
          </form>
          </div>
        }
        secondary={
          <div className="stack-list desktop-pane-column">
          {hasWorkspaceMismatch && !workspaceOverrideDismissed ? (
            <article className="diagnostic-card diagnostic-warn">
              <h3>Project mismatch</h3>
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

          <div className="desktop-pane-section">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Resolution</p>
                <h3>Current project match</h3>
              </div>
              <p className="inline-note">
                Review what this folder matched before changing or removing any explicit rule.
              </p>
            </div>
            <article className="diagnostic-card">
              <h3>Resolved rule</h3>
              <p className="diagnostic-status">{statusCard.status}</p>
              <p className="inline-note">Current set: {currentContextDisplay}</p>
              <p className="inline-note">Expected set: {expectedContextDisplay}</p>
              <p className="inline-note">Rule type: {statusCard.scope}</p>
              <p className="inline-note">Matched target: {statusCard.target}</p>
            </article>

            <article className="diagnostic-card">
              <h3>Protection</h3>
              <p className="inline-note">Guard mode: {bindingsSummary.guardMode}</p>
              <p className="inline-note">
                Default set: {contextDisplayLabel(settings, bindingsSummary.defaultContext)}
              </p>
            </article>
          </div>

          <div className="stack-list">
            <div className="desktop-pane-section-header">
              <div>
                <p className="card-kicker">Bindings</p>
                <h3>Saved matching rules</h3>
              </div>
              <p className="inline-note">
                Remove stale path and remote rules here when a project moves or gets renamed.
              </p>
            </div>
            {bindingsSummary.bindings.map((binding) => {
              const isMatchedBinding =
                matchedBindingKey === `${binding.scope}:${binding.target}:${binding.context}`;

              return (
                <article
                  key={`${binding.scope}-${binding.target}-${binding.context}`}
                  className="list-row"
                >
                  <div>
                    <strong>{contextDisplayLabel(settings, binding.context)}</strong>
                    <p>
                      {binding.scope} · {binding.target}
                    </p>
                    {isMatchedBinding ? <p className="inline-note">Matched rule ✓</p> : null}
                  </div>
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() =>
                      workspaceUnbindMutation.mutate(
                        unbindTargetForBinding(binding.scope, binding.target),
                      )
                    }
                  >
                    Remove this binding
                  </button>
                </article>
              );
            })}
            {!bindingsSummary.bindings.length ? (
              <p className="inline-note">
                No explicit project rules are configured yet. Save one from the form to attach a
                set to a default scope, path prefix, or git remote pattern.
              </p>
            ) : null}
          </div>
          {workspaceResult ? (
            <p className={`inline-note ${workspaceResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
              Last project-rule result: {workspaceResult.message}
              {workspaceResult.remediation ? ` Remediation: ${workspaceResult.remediation}` : ""}
            </p>
          ) : null}
          </div>
        }
      />
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
