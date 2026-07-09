import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppBootstrap, AppSnapshot, ToolStatus } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
import {
  commandForCurrentPlatform,
  installCommandForTool,
  installGuideUrlForTool,
  openExternalGuide,
  toolBinaryName,
} from "../../../lib/tool-guidance";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { titleCase } from "../../../lib/utils";
import { parseWorkspaceStatus } from "../../workspaces/workspace-parsers";

export function OverviewPanel({
  snapshot,
  toolCapabilities,
  onOpenProfiles,
}: {
  snapshot: AppSnapshot;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  onOpenProfiles: (tool: string, expandedProfile?: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const {
    addProfileMutation,
    useProfileMutation,
    useAllProfilesMutation,
    useContextMutation,
    mutationLock,
    lastCommandResults,
  } = useDesktopActions();
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
  const workspaceStatus = parseWorkspaceStatus(snapshot.workspace_status ?? undefined);
  const showWorkspaceSummary = workspaceStatus.expectedContext !== "none";
  const hasWorkspaceMismatch =
    workspaceStatus.status === "mismatch" &&
    workspaceStatus.expectedContext !== workspaceStatus.currentContext;

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
            disabled={mutationLock.isBusy}
            onClick={() =>
              bulkProfile &&
              useAllProfilesMutation.mutate({ profile: bulkProfile, stateMode: "isolated" })
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
      {showWorkspaceSummary ? (
        <article className={`diagnostic-card ${hasWorkspaceMismatch ? "diagnostic-warn" : "diagnostic-pass"}`}>
          <h3>{hasWorkspaceMismatch ? "Workspace wants a different context" : "Workspace match"}</h3>
          <p className="inline-note">
            Expected profile set: <strong>{workspaceStatus.expectedContext}</strong>
          </p>
          <p className="inline-note">
            Current context: <strong>{workspaceStatus.currentContext}</strong>
          </p>
          <p className="inline-note">
            Matched via {workspaceStatus.scope}: {workspaceStatus.target}
          </p>
          {hasWorkspaceMismatch ? (
            <div className="button-row">
              <button
                className="primary-button"
                type="button"
                disabled={mutationLock.isBusy}
                onClick={() =>
                  useContextMutation.mutate({
                    context: workspaceStatus.expectedContext,
                    stateMode: "isolated",
                  })
                }
              >
                Use expected context now
              </button>
            </div>
          ) : null}
        </article>
      ) : null}
      <div className="tool-grid">
        {snapshot.statuses.map((status) => (
          <ToolCard
            key={status.tool}
            status={status}
            profiles={snapshot.profiles[status.tool]?.profiles ?? []}
            lastResult={lastCommandResults.tool[status.tool]}
            mutationLocked={mutationLock.isBusy}
            onRefresh={() => refresh.mutate()}
            stateModes={supportedStateModes(status.tool, toolCapabilities)}
            onImport={(tool, profile, stateMode) =>
              addProfileMutation.mutate({
                tool,
                profile,
                label: titleCase(profile),
                stateMode,
                importMode: { kind: "from_live" },
              })
            }
            onUse={(tool, profile, stateMode) =>
              useProfileMutation.mutate({ tool, profile, stateMode })
            }
            onAddProfile={(tool) => onOpenProfiles(tool)}
            onOpenDetails={(tool, profile) => onOpenProfiles(tool, profile)}
          />
        ))}
      </div>
      {lastCommandResults.global["switch-all"] ? (
        <p
          className={`inline-note ${
            lastCommandResults.global["switch-all"]?.status === "error" ? "diagnostic-status-fail" : ""
          }`}
        >
          Last bulk result: {lastCommandResults.global["switch-all"]?.message}
          {lastCommandResults.global["switch-all"]?.remediation
            ? ` Remediation: ${lastCommandResults.global["switch-all"]?.remediation}`
            : ""}
        </p>
      ) : null}
    </SectionCard>
  );
}

function ToolCard({
  status,
  profiles,
  lastResult,
  mutationLocked,
  onRefresh,
  stateModes,
  onImport,
  onUse,
  onAddProfile,
  onOpenDetails,
}: {
  status: ToolStatus;
  profiles: AppSnapshot["profiles"][string]["profiles"];
  lastResult?: {
    label: string;
    status: "success" | "error";
    message: string;
    remediation?: string;
  };
  mutationLocked: boolean;
  onRefresh: () => void;
  stateModes: string[];
  onImport: (tool: string, profile: string, stateMode: string | null) => void;
  onUse: (tool: string, profile: string, stateMode: string | null) => void;
  onAddProfile: (tool: string) => void;
  onOpenDetails: (tool: string, profile: string | null | undefined) => void;
}) {
  const activeState = status.active_profile_applied;
  const [importName, setImportName] = useState("");
  const [stateMode, setStateMode] = useState(status.state_mode ?? stateModes[0] ?? "");
  const [selectedProfile, setSelectedProfile] = useState(
    status.active_profile ?? profiles[0]?.name ?? "",
  );

  useEffect(() => {
    if (!stateModes.length) {
      return;
    }
    if (!stateModes.includes(stateMode)) {
      setStateMode(stateModes[0]);
    }
  }, [stateMode, stateModes]);

  useEffect(() => {
    const availableProfiles = profiles.map((profile) => profile.name);
    const nextProfile = status.active_profile ?? availableProfiles[0] ?? "";
    if (!selectedProfile || !availableProfiles.includes(selectedProfile)) {
      setSelectedProfile(nextProfile);
    }
  }, [profiles, selectedProfile, status.active_profile]);

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
      {status.token_warning ? (
        <p className="inline-note">
          Token warning: {formatTokenWarning(status)}
        </p>
      ) : null}
      {status.warnings.length ? (
        <div className="stack-list">
          {status.warnings.map((warning, index) => (
            <p
              key={`${warning.code ?? warning.message ?? "warning"}-${index}`}
              className="inline-note"
            >
              Warning: {formatDiagnosticWarning(warning)}
            </p>
          ))}
        </div>
      ) : null}
      {lastResult ? (
        <p className={`inline-note ${lastResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
          Last result: {lastResult.message}
          {lastResult.remediation ? ` Remediation: ${lastResult.remediation}` : ""}
        </p>
      ) : null}
      {stateModes.length ? (
        <label className="stacked-form">
          <span>State mode</span>
          <select value={stateMode} onChange={(event) => setStateMode(event.target.value)}>
            {stateModes.map((mode) => (
              <option key={mode} value={mode}>
                {titleCase(mode)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!status.binary_found ? (
        <MissingBinaryGuidance tool={status.tool} onRefresh={onRefresh} />
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
              disabled={mutationLocked || !importName.trim()}
              onClick={() => {
                const profile = importName.trim();
                if (!profile) return;
                onImport(status.tool, profile, stateModes.length ? stateMode : null);
                setImportName("");
              }}
            >
              Import current as new
            </button>
          </div>
        </div>
      ) : null}
      {profiles.length ? (
        <div className="stack-list">
          <label className="stacked-form">
            <span>Switch profile</span>
            <select
              aria-label={`Switch ${status.tool} profile`}
              value={selectedProfile}
              onChange={(event) => setSelectedProfile(event.target.value)}
            >
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            disabled={mutationLocked || !selectedProfile}
            onClick={() => onUse(status.tool, selectedProfile, stateModes.length ? stateMode : null)}
          >
            {selectedProfile && selectedProfile === status.active_profile
              ? `Re-apply ${selectedProfile}`
              : selectedProfile
                ? `Switch to ${selectedProfile}`
                : "Switch profile"}
          </button>
        </div>
      ) : null}
      <div className="button-row">
        {status.binary_found ? (
          <button
            className="ghost-button"
            type="button"
            disabled={mutationLocked}
            onClick={() => onAddProfile(status.tool)}
          >
            Add profile
          </button>
        ) : null}
        {status.active_profile ? (
          <button
            className="ghost-button"
            type="button"
            onClick={() => onOpenDetails(status.tool, status.active_profile)}
          >
            Open details
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MissingBinaryGuidance({ tool, onRefresh }: { tool: string; onRefresh: () => void }) {
  const binary = toolBinaryName(tool);
  const verifyCommand = commandForCurrentPlatform(binary, "verify");
  const pathCommand = commandForCurrentPlatform(binary, "path");
  const installCommand = installCommandForTool(tool);
  const guideUrl = installGuideUrlForTool(tool);

  return (
    <div className="stack-list">
      <p className="inline-note">
        {titleCase(tool)} is not available on PATH, so AISW Desktop cannot switch or verify that
        tool yet.
      </p>
      <p className="inline-note">
        Install: <code>{installCommand}</code>
      </p>
      <p className="inline-note">
        Verify binary: <code>{verifyCommand}</code>
      </p>
      <p className="inline-note">
        Check PATH: <code>{pathCommand}</code>
      </p>
      <p className="inline-note">
        Refresh state after the CLI is installed or after you update your shell PATH.
      </p>
      <div className="button-row">
        <button
          className="ghost-button"
          type="button"
          onClick={() => openExternalGuide(guideUrl)}
        >
          Open installation guide
        </button>
        <button className="ghost-button" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </div>
  );
}

function formatTokenWarning(status: ToolStatus) {
  const warning = status.token_warning;
  if (!warning) {
    return "Token state needs attention.";
  }

  const detail = warning.summary ?? warning.message ?? warning.code ?? "Token state needs attention.";
  const suffix = warning.expires_at
    ? ` Expires at ${warning.expires_at}.`
    : typeof warning.expires_in_days === "number"
      ? ` Expires in ${warning.expires_in_days} days.`
      : "";
  return `${detail}${suffix}`;
}

function formatDiagnosticWarning(
  warning: ToolStatus["warnings"][number],
) {
  const detail = warning.message ?? warning.code ?? "Warning reported by aisw.";
  return warning.remediation ? `${detail} Remediation: ${warning.remediation}` : detail;
}

function supportedStateModes(
  tool: string,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
) {
  const configured = toolCapabilities[tool]?.state_modes ?? [];
  if (configured.length) {
    return configured;
  }
  return tool === "gemini" ? [] : ["isolated", "shared"];
}
