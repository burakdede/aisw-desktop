import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppSnapshot, ToolStatus } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { titleCase } from "../../../lib/utils";

export function OverviewPanel({ snapshot }: { snapshot: AppSnapshot }) {
  const queryClient = useQueryClient();
  const { addProfileMutation, useProfileMutation, useAllProfilesMutation } = useDesktopActions();
  const [lastAction, setLastAction] = useState<string>("");
  const [bulkProfile, setBulkProfile] = useState("");
  const sharedProfileNames = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(snapshot.profiles).forEach((entry) => {
      entry.profiles.forEach((profile) => {
        counts.set(profile.name, (counts.get(profile.name) ?? 0) + 1);
      });
    });
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name);
  }, [snapshot.profiles]);

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
        <div className="button-row">
          <select value={bulkProfile} onChange={(event) => setBulkProfile(event.target.value)}>
            <option value="">Switch all tools to…</option>
            {sharedProfileNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            onClick={() =>
              bulkProfile &&
              useAllProfilesMutation.mutate(
                { profile: bulkProfile, stateMode: "isolated" },
                {
                  onSuccess: () => setLastAction(`Switched all tools to ${bulkProfile}.`),
                },
              )
            }
          >
            Switch all
          </button>
          <button className="ghost-button" onClick={() => refresh.mutate()}>
            Refresh state
          </button>
        </div>
      }
    >
      <div className="tool-grid">
        {snapshot.statuses.map((status) => (
          <ToolCard
            key={status.tool}
            status={status}
            onImport={(tool, profile) =>
              addProfileMutation.mutate(
                {
                  tool,
                  profile,
                  label: titleCase(profile),
                  stateMode: tool === "gemini" ? null : "isolated",
                  importMode: { kind: "from_live" },
                },
                {
                  onSuccess: () => setLastAction(`Imported current ${tool} login as ${profile}.`),
                },
              )
            }
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
  onImport,
  onUse,
}: {
  status: ToolStatus;
  onImport: (tool: string, profile: string) => void;
  onUse: (tool: string, profile: string) => void;
}) {
  const activeState = status.active_profile_applied;
  const [importName, setImportName] = useState("");

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
      {!status.binary_found ? (
        <p className="inline-note">
          Install {titleCase(status.tool)} and refresh diagnostics to restore switching support.
        </p>
      ) : null}
      {activeState === false ? (
        <div className="stack-list">
          <p className="inline-note">
            Live credentials changed outside AISW. Re-apply the active profile or import the current
            login as a new profile.
          </p>
          <div className="inline-form">
            <input
              aria-label={`import ${status.tool} current login`}
              placeholder="new profile name"
              value={importName}
              onChange={(event) => setImportName(event.target.value)}
            />
            <button
              className="ghost-button"
              type="button"
              disabled={!importName.trim()}
              onClick={() => {
                const profile = importName.trim();
                if (!profile) return;
                onImport(status.tool, profile);
                setImportName("");
              }}
            >
              Import current as new
            </button>
          </div>
        </div>
      ) : null}
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
