import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProjectBindings, getWorkspaceStatus } from "../../../lib/client";
import { AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
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

type BindScope = "default" | "path" | "git_remote";

export function WorkspacesPanel({
  snapshot,
  settings,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
}) {
  const bindings = useQuery({
    queryKey: ["project-bindings"],
    queryFn: getProjectBindings,
  });
  const workspaceStatus = useQuery({
    queryKey: ["workspace-status"],
    queryFn: getWorkspaceStatus,
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

  useEffect(() => {
    setWorkspaceOverrideDismissed(false);
  }, [statusCard.currentContext, statusCard.expectedContext, statusCard.status]);

  useEffect(() => {
    if (!bindingOptions.some((entry) => entry.value === context)) {
      setContext(bindingOptions[0]?.value ?? "");
    }
  }, [bindingOptions, context]);

  function activateExpectedWorkspaceTarget() {
    const target = resolveWorkspaceActivationTarget(statusCard.expectedContext, settings, snapshot);
    activateWorkspaceTargetMutation.mutate({
      ...target,
      matchedTarget: statusCard.target,
    });
  }

  function submitBind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;

    const target =
      scope === "default"
        ? { scope: "default" as const }
        : scope === "path"
          ? { scope: "path" as const, path: trimmedTargetValue }
          : { scope: "git_remote" as const, pattern: trimmedTargetValue };

    workspaceBindMutation.mutate({ target, context });
  }

  return (
    <SectionCard title="Workspaces" kicker="Guardrails and bindings">
      <div className="panel-grid panel-grid-2">
        <form className="stacked-form" onSubmit={submitBind}>
          <label>
            Binding scope
            <select value={scope} onChange={(event) => setScope(event.target.value as BindScope)}>
              <option value="default">Default context</option>
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
            Context
            <select value={context} onChange={(event) => setContext(event.target.value)}>
              <option value="">Select context</option>
              {bindingOptions.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={mutationLock.isBusy || !canSaveBinding}>
              Save binding
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
              Remove binding
            </button>
          </div>
          {!bindingOptions.length ? (
            <p className="inline-note">
              No profile sets or CLI contexts are available yet. Create one before saving workspace bindings.
            </p>
          ) : null}
          {requiresExplicitTarget && trimmedTargetValue.length === 0 ? (
            <p className="inline-note">
              Enter a {scope === "path" ? "path prefix" : "git remote pattern"} before saving or removing this binding.
            </p>
          ) : null}
          <div className="button-row">
            <button
              className="ghost-button"
              type="button"
              disabled={mutationLock.isBusy}
              onClick={() => workspaceGuardMutation.mutate("warn")}
            >
              Guard warn
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={mutationLock.isBusy}
              onClick={() => workspaceGuardMutation.mutate("strict")}
            >
              Guard strict
            </button>
          </div>
        </form>

        <div className="stack-list">
          {hasWorkspaceMismatch && !workspaceOverrideDismissed ? (
            <article className="diagnostic-card diagnostic-warn">
              <h3>Workspace mismatch</h3>
              <p className="inline-note">
                This folder matches <strong>{expectedContextDisplay}</strong>, but the current
                active context is <strong>{currentContextDisplay}</strong>.
              </p>
              <p className="inline-note">
                Matched from {statusCard.scope} binding: {statusCard.target}
              </p>
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={activateExpectedWorkspaceTarget}
                >
                  Use expected context now
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setWorkspaceOverrideDismissed(true)}
                >
                  Keep current context
                </button>
              </div>
            </article>
          ) : null}

          <article className="diagnostic-card">
            <h3>Resolved workspace</h3>
            <p className="diagnostic-status">{statusCard.status}</p>
            <p className="inline-note">Current context: {currentContextDisplay}</p>
            <p className="inline-note">Expected context: {expectedContextDisplay}</p>
            <p className="inline-note">Matched scope: {statusCard.scope}</p>
            <p className="inline-note">Matched target: {statusCard.target}</p>
          </article>

          <article className="diagnostic-card">
            <h3>Workspace guard</h3>
            <p className="inline-note">Guard mode: {bindingsSummary.guardMode}</p>
            <p className="inline-note">Default context: {bindingsSummary.defaultContext}</p>
          </article>

          <div className="stack-list">
            <h3>Explicit bindings</h3>
            {bindingsSummary.bindings.map((binding) => (
              <article
                key={`${binding.scope}-${binding.target}-${binding.context}`}
                className="list-row"
              >
                <div>
                  <strong>{contextDisplayLabel(settings, binding.context)}</strong>
                  <p>
                    {binding.scope} · {binding.target}
                  </p>
                </div>
                <button
                  className="ghost-button danger-button"
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={() =>
                    workspaceUnbindMutation.mutate(unbindTargetForBinding(binding.scope, binding.target))
                  }
                >
                  Remove this binding
                </button>
              </article>
            ))}
            {!bindingsSummary.bindings.length ? (
              <p className="inline-note">
                No explicit workspace bindings are configured yet. Save one from the form to attach
                a context to a default scope, path prefix, or git remote pattern.
              </p>
            ) : null}
          </div>
          {workspaceResult ? (
            <p className={`inline-note ${workspaceResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
              Last workspace result: {workspaceResult.message}
              {workspaceResult.remediation ? ` Remediation: ${workspaceResult.remediation}` : ""}
            </p>
          ) : null}
        </div>
      </div>
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
