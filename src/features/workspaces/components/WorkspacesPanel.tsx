import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProjectBindings, getWorkspaceStatus } from "../../../lib/client";
import { AppSnapshot } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
import { useDesktopActions } from "../../shared/useDesktopActions";
import {
  parseWorkspaceBindings,
  parseWorkspaceStatus,
} from "../workspace-parsers";

type BindScope = "default" | "path" | "git_remote";

export function WorkspacesPanel({ snapshot }: { snapshot: AppSnapshot }) {
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
    mutationLock,
  } = useDesktopActions();
  const [scope, setScope] = useState<BindScope>("default");
  const [context, setContext] = useState(snapshot.contexts[0]?.name ?? "");
  const [targetValue, setTargetValue] = useState("");

  const availableContexts = useMemo(
    () => snapshot.contexts.map((entry) => entry.name),
    [snapshot.contexts],
  );
  const statusCard = parseWorkspaceStatus(workspaceStatus.data);
  const bindingsSummary = parseWorkspaceBindings(bindings.data);

  function submitBind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;

    const target =
      scope === "default"
        ? { scope: "default" as const }
        : scope === "path"
          ? { scope: "path" as const, path: targetValue }
          : { scope: "git_remote" as const, pattern: targetValue };

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
              {availableContexts.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={mutationLock.isBusy}>
              Save binding
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={mutationLock.isBusy}
              onClick={() =>
                workspaceUnbindMutation.mutate(
                  scope === "default"
                    ? { scope: "default" }
                    : scope === "path"
                      ? { scope: "path", path: targetValue }
                      : { scope: "git_remote", pattern: targetValue },
                )
              }
            >
              Remove binding
            </button>
          </div>
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
          <article className="diagnostic-card">
            <h3>Resolved workspace</h3>
            <p className="diagnostic-status">{statusCard.status}</p>
            <p className="inline-note">Current context: {statusCard.currentContext}</p>
            <p className="inline-note">Expected context: {statusCard.expectedContext}</p>
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
                  <strong>{binding.context}</strong>
                  <p>
                    {binding.scope} · {binding.target}
                  </p>
                </div>
              </article>
            ))}
            {!bindingsSummary.bindings.length ? (
              <p className="inline-note">
                No explicit workspace bindings are configured yet. Save one from the form to attach
                a context to a default scope, path prefix, or git remote pattern.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
