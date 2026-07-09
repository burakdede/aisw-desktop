import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getProjectBindings,
  getWorkspaceStatus,
} from "../../../lib/client";
import { AppSnapshot } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
import { useDesktopActions } from "../../shared/useDesktopActions";

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
  } = useDesktopActions();
  const [scope, setScope] = useState<BindScope>("default");
  const [context, setContext] = useState(snapshot.contexts[0]?.name ?? "");
  const [targetValue, setTargetValue] = useState("");

  const availableContexts = useMemo(
    () => snapshot.contexts.map((entry) => entry.name),
    [snapshot.contexts],
  );

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
            <button className="primary-button" type="submit">
              Save binding
            </button>
            <button
              className="ghost-button"
              type="button"
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
              onClick={() => workspaceGuardMutation.mutate("warn")}
            >
              Guard warn
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => workspaceGuardMutation.mutate("strict")}
            >
              Guard strict
            </button>
          </div>
        </form>
        <div className="stack-list">
          <article className="diagnostic-card">
            <h3>Resolved workspace status</h3>
            <pre>{JSON.stringify(workspaceStatus.data, null, 2)}</pre>
          </article>
          <article className="diagnostic-card">
            <h3>Project bindings snapshot</h3>
            <pre>{JSON.stringify(bindings.data, null, 2)}</pre>
          </article>
        </div>
      </div>
    </SectionCard>
  );
}
