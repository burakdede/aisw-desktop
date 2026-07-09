import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppSnapshot, ToolStatus } from "../../../lib/schemas";
import { useDesktop } from "../../shared/useDesktop";
import { SectionCard } from "../../../components/SectionCard";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { titleCase } from "../../../lib/utils";

export function OverviewPanel({ snapshot }: { snapshot: AppSnapshot }) {
  const queryClient = useQueryClient();
  const { useProfileMutation } = useDesktopActions();
  const [lastAction, setLastAction] = useState<string>("");

  const refresh = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    },
  });

  return (
    <SectionCard
      title="Control Center"
      kicker="Overview"
      actions={
        <button className="ghost-button" onClick={() => refresh.mutate()}>
          Refresh state
        </button>
      }
    >
      <div className="tool-grid">
        {snapshot.statuses.map((status) => (
          <ToolCard
            key={status.tool}
            status={status}
            onUse={(tool, profile) =>
              useProfileMutation.mutate(
                { tool, profile, stateMode: status.state_mode ?? "isolated" },
                {
                  onSuccess: () => setLastAction(`Switched ${tool} to ${profile}.`),
                },
              )
            }
          />
        ))}
      </div>
      {lastAction ? <p className="inline-note">{lastAction}</p> : null}
    </SectionCard>
  );
}

function ToolCard({
  status,
  onUse,
}: {
  status: ToolStatus;
  onUse: (tool: string, profile: string) => void;
}) {
  const activeState = status.active_profile_applied;
  return (
    <article className="tool-card">
      <header>
        <div>
          <p className="card-kicker">{titleCase(status.tool)}</p>
          <h3>{status.active_profile ?? "No active profile"}</h3>
        </div>
        <span className={`pill ${status.binary_found ? "pill-ok" : "pill-warn"}`}>
          {status.binary_found ? "Installed" : "Missing"}
        </span>
      </header>
      <div className="tool-card-meta">
        <span>Auth: {status.auth_method ?? "unknown"}</span>
        <span>Backend: {status.credential_backend ?? "unknown"}</span>
        <span>State mode: {status.state_mode ?? "n/a"}</span>
        <span>
          Live match:{" "}
          {activeState === null || activeState === undefined
            ? "unknown"
            : activeState
              ? "yes"
              : "mismatch"}
        </span>
      </div>
      {status.active_profile ? (
        <button
          className="primary-button"
          onClick={() => onUse(status.tool, status.active_profile!)}
        >
          Re-apply {status.active_profile}
        </button>
      ) : null}
    </article>
  );
}
