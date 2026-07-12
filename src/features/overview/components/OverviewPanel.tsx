import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
import { SectionCard } from "../../../components/SectionCard";
import {
  commandForCurrentPlatform,
  installCommandForTool,
  installGuideUrlForTool,
  openExternalGuide,
  toolBinaryName,
} from "../../../lib/tool-guidance";
import { supportedStateModes } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { StateModeField } from "../../shared/components/StateModeField";
import {
  activeSetLabel,
  contextDisplayLabel,
  toolProfileDisplayLabel,
} from "../../../lib/profile-display";
import { toolDisplayName } from "../../../lib/tool-display";
import { titleCase } from "../../../lib/utils";
import {
  preferredProfileImportMode,
  supportsProfileImportMode,
  type ProfileImportMode,
} from "../../shared/profile-capabilities";
import { parseWorkspaceStatus } from "../../workspaces/workspace-parsers";
import { resolveWorkspaceActivationTarget } from "../../workspaces/workspace-activation";

export function OverviewPanel({
  snapshot,
  settings,
  toolCapabilities,
  onOpenProfiles,
  onOpenContexts,
  onOpenQuickSwitch,
}: {
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  onOpenProfiles: (
    tool: string,
    expandedProfile?: string | null,
    options?: { mode?: ProfileImportMode },
  ) => void;
  onOpenContexts: () => void;
  onOpenQuickSwitch: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    addProfileMutation,
    activateWorkspaceTargetMutation,
    useProfileMutation,
    mutationLock,
    lastCommandResults,
  } = useDesktopActions();

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
  const expectedWorkspaceTarget = showWorkspaceSummary
    ? resolveWorkspaceActivationTarget(workspaceStatus.expectedContext, settings, snapshot)
    : null;
  const workspaceSummaryLabel = "Expected set";
  const expectedWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.expectedContext);
  const currentWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.currentContext);
  const workspaceResult = lastCommandResults.global.workspace;
  const contextResult = lastCommandResults.global.context;
  const currentSetLabel = activeSetLabel(settings, snapshot);
  const currentSetDisplay = currentSetLabel ?? "No active set";
  const [selectedTool, setSelectedTool] = useState(snapshot.statuses[0]?.tool ?? "");
  const selectedStatus =
    snapshot.statuses.find((status) => status.tool === selectedTool) ?? snapshot.statuses[0] ?? null;
  const activeToolsCount = snapshot.statuses.filter((status) => status.active_profile).length;
  const currentSetProfiles = snapshot.statuses.map((status) => ({
    tool: status.tool,
    label: status.active_profile
      ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
      : null,
  }));
  const matchedToolsCount = snapshot.statuses.filter((status) => status.active_profile_applied !== false).length;
  const warningToolsCount = snapshot.statuses.filter((status) => resolveCardState(status) === "warning").length;
  const summaryToneLabel = hasWorkspaceMismatch
    ? "Project needs review"
    : activeToolsCount
      ? "Ready to code"
      : "Needs setup";
  const summaryStatusRows = [
    {
      label: "Active tools",
      value: `${activeToolsCount}/${snapshot.statuses.length}`,
      detail: activeToolsCount ? "ready now" : "add first profile",
    },
    {
      label: "Live match",
      value: `${matchedToolsCount} aligned`,
      detail: warningToolsCount ? `${warningToolsCount} need review` : "no drift visible",
    },
    {
      label: "Project",
      value: hasWorkspaceMismatch ? "Needs review" : "Ready",
      detail: hasWorkspaceMismatch ? "expected set differs" : "no project drift",
    },
  ];

  useEffect(() => {
    if (!snapshot.statuses.length) {
      if (selectedTool) {
        setSelectedTool("");
      }
      return;
    }
    if (!snapshot.statuses.some((status) => status.tool === selectedTool)) {
      setSelectedTool(snapshot.statuses[0].tool);
    }
  }, [selectedTool, snapshot.statuses]);

  return (
    <SectionCard
      title="Control center"
      kicker="Overview"
      actions={
        <div className="button-row">
          <button
            className="primary-button"
            aria-label="Open Quick Switch"
            disabled={mutationLock.isBusy}
            onClick={onOpenQuickSwitch}
          >
            Quick Switch…
          </button>
          <button
            className="ghost-button"
            aria-label="Refresh state"
            disabled={mutationLock.isBusy || refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            Verify
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={mutationLock.isBusy}
            onClick={() => onOpenProfiles(snapshot.statuses[0]?.tool ?? "claude")}
          >
            + Add Profile
          </button>
        </div>
      }
    >
      <div className="overview-native-stack overview-layout">
        <div className="overview-summary-pane">
          {currentSetLabel || currentSetProfiles.length ? (
            <article className="overview-current-set diagnostic-card">
              <div className="overview-current-set-main">
                <div className="overview-current-set-copy">
                  <div className="overview-current-set-header">
                    <div>
                      <p className="card-kicker">Current set</p>
                      <h3>{currentSetDisplay}</h3>
                      <p className="inline-note">
                        {currentSetLabel
                          ? "Switching stays centered on one working identity across installed tools."
                          : "No shared active set is pinned yet. Per-tool switching is still available."}
                      </p>
                    </div>
                    <span className={`pill ${activeToolsCount ? "pill-ok" : "pill-soft"}`}>
                      {summaryToneLabel}
                    </span>
                  </div>
                  <div className="overview-current-set-strip" aria-label="Current set status">
                    {summaryStatusRows.map((row) => (
                      <div key={row.label} className="overview-current-set-strip-cell">
                        <span className="overview-current-set-cell-label">{row.label}</span>
                        <strong>{row.value}</strong>
                        <p className="inline-note">{row.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="overview-current-set-profile-bar" aria-label="Current set profiles">
                    {currentSetProfiles.map((entry) => (
                      <div key={entry.tool} className="overview-current-set-profile-chip">
                        <span className="overview-current-set-profile-tool">
                          {toolDisplayName(entry.tool)}
                        </span>
                        <strong>{entry.label ?? "Not configured"}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="overview-current-set-inline">
                    <p className="inline-note">
                      Current set: <strong>{currentSetLabel ?? "No active set"}</strong>
                    </p>
                    {showWorkspaceSummary ? (
                      <p className="inline-note">
                        Project expects <strong>{expectedWorkspaceDisplay}</strong>.
                      </p>
                    ) : null}
                  </div>
                </div>
                <aside className="overview-current-set-actions">
                  <div className="overview-action-rail">
                    <span className="overview-current-set-cell-label">Actions</span>
                    <div className="button-row button-row-column">
                      <button
                        className="primary-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={onOpenQuickSwitch}
                      >
                        Switch Set…
                      </button>
                      <button className="ghost-button" type="button" onClick={onOpenContexts}>
                        Open Sets
                      </button>
                    </div>
                    <p className="inline-note">
                      {warningToolsCount
                        ? `${warningToolsCount} tool${warningToolsCount === 1 ? "" : "s"} need review before you start coding.`
                        : "Live match is clear across the currently configured tools."}
                    </p>
                  </div>
                </aside>
              </div>
            </article>
          ) : null}

          <div className="overview-summary-grid">
            {showWorkspaceSummary ? (
              <article className={`diagnostic-card ${hasWorkspaceMismatch ? "diagnostic-warn" : "diagnostic-pass"} overview-project-card`}>
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Project</p>
                    <h3>{hasWorkspaceMismatch ? "Project wants a different set" : "Project match"}</h3>
                  </div>
                  <span className={`pill ${hasWorkspaceMismatch ? "pill-warn" : "pill-ok"}`}>
                    {hasWorkspaceMismatch ? "Needs review" : "Ready"}
                  </span>
                </div>
                <div className="overview-project-grid">
                  <div>
                    <span className="overview-current-set-cell-label">{workspaceSummaryLabel}</span>
                    <strong>{expectedWorkspaceDisplay}</strong>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Current set</span>
                    <strong>{currentWorkspaceDisplay}</strong>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Matched rule</span>
                    <strong>{workspaceStatus.scope}: {workspaceStatus.target}</strong>
                  </div>
                </div>
                {hasWorkspaceMismatch ? (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => {
                      const target = resolveWorkspaceActivationTarget(
                        workspaceStatus.expectedContext,
                        settings,
                        snapshot,
                      );
                      if (!target) {
                        onOpenContexts();
                        return;
                      }
                      activateWorkspaceTargetMutation.mutate({
                        ...target,
                        matchedTarget: workspaceStatus.target,
                      });
                    }}
                  >
                    {expectedWorkspaceTarget ? "Use expected set now" : "Open Sets"}
                  </button>
                ) : null}
              </article>
            ) : null}
            <article className="diagnostic-card overview-recent-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Recent actions</p>
                  <h3>Latest results</h3>
                </div>
                <p className="inline-note">
                  Keep bulk switches and set changes visible without leaving Overview.
                </p>
              </div>
              <div className="stack-list overview-recent-list">
                {lastCommandResults.global["switch-all"] || lastCommandResults.global["profile-set"] ? (
                  <p
                    className={`inline-note overview-recent-item ${
                      (lastCommandResults.global["profile-set"] ?? lastCommandResults.global["switch-all"])
                        ?.status === "error"
                        ? "diagnostic-status-fail"
                        : ""
                    }`}
                  >
                    Last bulk result:{" "}
                    {(lastCommandResults.global["profile-set"] ?? lastCommandResults.global["switch-all"])
                      ?.message}
                    {(lastCommandResults.global["profile-set"] ?? lastCommandResults.global["switch-all"])
                      ?.remediation
                      ? ` Remediation: ${
                          (lastCommandResults.global["profile-set"] ??
                            lastCommandResults.global["switch-all"])?.remediation
                        }`
                      : ""}
                  </p>
                ) : null}
                {workspaceResult ? (
                  <p className={`inline-note overview-recent-item ${workspaceResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
                    Last project result: {workspaceResult.message}
                    {workspaceResult.remediation ? ` Remediation: ${workspaceResult.remediation}` : ""}
                  </p>
                ) : null}
                {contextResult ? (
                  <p className={`inline-note overview-recent-item ${contextResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
                    Last set result: {normalizeRuntimeLanguage(contextResult.message)}
                    {contextResult.remediation
                      ? ` Remediation: ${normalizeRuntimeLanguage(contextResult.remediation)}`
                      : ""}
                  </p>
                ) : null}
                {!lastCommandResults.global["switch-all"] &&
                !lastCommandResults.global["profile-set"] &&
                !workspaceResult &&
                !contextResult ? (
                  <p className="inline-note">No recent bulk or project-rule changes are recorded in this session.</p>
                ) : null}
              </div>
            </article>
          </div>
        </div>

        <section className="overview-tools-pane overview-tools-section">
          <div className="overview-tools-header">
            <div>
              <p className="card-kicker">Tools</p>
              <h3>Tools</h3>
            </div>
            <p className="inline-note">
              Inspect one tool at a time, keep live match obvious, and switch without leaving Overview.
            </p>
          </div>
          {snapshot.statuses.length && selectedStatus ? (
            <div className="overview-tools-split">
              <div className="overview-tool-list-pane">
                <article className="diagnostic-card overview-tools-list-card">
                  <div className="overview-tool-list-columns" aria-hidden="true">
                    <span>Tool</span>
                    <span>Active</span>
                    <span>Live match</span>
                    <span>Status</span>
                  </div>
                  <div className="stack-list overview-tool-list-stack" role="list" aria-label="Tools">
                    {snapshot.statuses.map((status) => (
                      <button
                        key={status.tool}
                        className={`overview-tool-row overview-tool-row-${resolveCardState(status)} ${
                          selectedTool === status.tool ? "overview-tool-row-selected" : ""
                        }`}
                        type="button"
                        aria-label={`Inspect ${titleCase(status.tool)}`}
                        aria-pressed={selectedTool === status.tool}
                        onClick={() => setSelectedTool(status.tool)}
                      >
                        <div className="overview-tool-row-main">
                          <div className="overview-tool-row-title">
                            <span className={`health-dot health-dot-${resolveCardState(status)}`} aria-hidden="true" />
                            <strong>{toolDisplayName(status.tool)}</strong>
                          </div>
                          <p className="inline-note">
                            {status.active_profile
                              ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
                              : !status.binary_found
                                ? "Tool not installed"
                                : "Not configured"}
                          </p>
                        </div>
                        <div className="overview-tool-row-meta">
                          <span>{status.active_profile ? "Configured" : "None"}</span>
                          <span>
                            {status.active_profile_applied == null
                              ? "Unknown"
                              : status.active_profile_applied
                                ? "Aligned"
                                : "Drifted"}
                          </span>
                          <span>{statusPillLabel(status)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </article>
              </div>
              <div className="overview-tool-detail-pane">
                <ToolInspector
                  key={selectedStatus.tool}
                  status={selectedStatus}
                  profiles={snapshot.profiles[selectedStatus.tool]?.profiles ?? []}
                  lastResult={lastCommandResults.tool[selectedStatus.tool]}
                  mutationLocked={mutationLock.isBusy}
                  refreshLocked={mutationLock.isBusy || refresh.isPending}
                  onRefresh={() => refresh.mutate()}
                  stateModes={supportedStateModes(selectedStatus.tool, toolCapabilities)}
                  settings={settings}
                  snapshot={snapshot}
                  onImport={(tool, profile, stateMode) =>
                    supportsProfileImportMode(tool, toolCapabilities, "from_live")
                      ? addProfileMutation.mutate({
                          tool,
                          profile,
                          label: titleCase(profile),
                          stateMode,
                          importMode: { kind: "from_live" },
                        })
                      : onOpenProfiles(tool, null, {
                          mode: preferredProfileImportMode(tool, toolCapabilities, "from_live"),
                        })
                  }
                  onUse={(tool, profile, stateMode) =>
                    useProfileMutation.mutate({
                      tool,
                      profile,
                      stateMode,
                      label: toolProfileDisplayLabel(settings, snapshot, tool, profile),
                    })
                  }
                  onAddProfile={(tool) => onOpenProfiles(tool)}
                  onOpenDetails={(tool, profile) => onOpenProfiles(tool, profile)}
                  toolCapabilities={toolCapabilities}
                  selected
                  onInspect={() => setSelectedTool(selectedStatus.tool)}
                />
              </div>
            </div>
          ) : (
            <article className="diagnostic-card">
              <h3>No tools detected</h3>
              <p className="inline-note">
                Add or detect a supported tool before switching can begin.
              </p>
            </article>
          )}
        </section>
      </div>
    </SectionCard>
  );
}

function ToolInspector({
  status,
  profiles,
  lastResult,
  mutationLocked,
  refreshLocked,
  onRefresh,
  stateModes,
  toolCapabilities,
  settings,
  snapshot,
  onImport,
  onUse,
  onAddProfile,
  onOpenDetails,
  selected,
  onInspect,
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
  refreshLocked: boolean;
  onRefresh: () => void;
  stateModes: string[];
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  onImport: (tool: string, profile: string, stateMode: string | null) => void;
  onUse: (tool: string, profile: string, stateMode: string | null) => void;
  onAddProfile: (tool: string) => void;
  onOpenDetails: (tool: string, profile: string | null | undefined) => void;
  selected: boolean;
  onInspect: () => void;
}) {
  const activeState = status.active_profile_applied;
  const [importName, setImportName] = useState("");
  const [stateMode, setStateMode] = useState(status.state_mode ?? stateModes[0] ?? "");
  const [selectedProfile, setSelectedProfile] = useState(
    status.active_profile ?? profiles[0]?.name ?? "",
  );
  const activeProfileLabel = status.active_profile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
    : null;
  const selectedProfileLabel = selectedProfile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, selectedProfile)
    : null;
  const supportsLiveImport = supportsProfileImportMode(status.tool, toolCapabilities, "from_live");
  const liveMatchLabel =
    activeState === null || activeState === undefined ? "Unknown" : activeState ? "Yes" : "Drifted";
  const toolSummaryCopy = status.active_profile
    ? `${toolDisplayName(status.tool)} is using ${activeProfileLabel}. Keep live match green before you start coding.`
    : `Add a saved profile for ${toolDisplayName(status.tool)} before switching from AI Switch.`;

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
    <article
      className={`tool-card overview-tool-card overview-tool-card-${resolveCardState(status)} ${
        selected ? "overview-tool-card-selected" : ""
      }`}
    >
      <button
        className="visually-hidden"
        type="button"
        aria-label={`Inspect ${titleCase(status.tool)}`}
        onClick={onInspect}
      >
        Inspect {toolDisplayName(status.tool)}
      </button>
      <header className="overview-tool-card-header">
        <div>
          <p className="card-kicker">Tool status</p>
          <h3>{toolDisplayName(status.tool)}</h3>
          <p className="inline-note">
            {status.active_profile
              ? `Active: ${activeProfileLabel}`
              : !status.binary_found
                ? "Tool not installed"
                : "Not configured"}
          </p>
        </div>
        <div className="overview-tool-status">
          <span className={`health-dot health-dot-${resolveCardState(status)}`} aria-hidden="true" />
          <span className={`pill ${pillClassForStatus(status)}`}>
            {statusPillLabel(status)}
          </span>
        </div>
      </header>
      <div className="overview-tool-lead">
        <dl className="overview-tool-facts">
          <div>
            <dt>Active</dt>
            <dd>{activeProfileLabel ?? "Not configured"}</dd>
          </div>
          <div>
            <dt>Live match</dt>
            <dd>{liveMatchLabel}</dd>
          </div>
          <div>
            <dt>Auth</dt>
            <dd>{status.auth_method ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Backend</dt>
            <dd>{credentialBackendLabel(status.credential_backend)}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{status.state_mode ?? "n/a"}</dd>
          </div>
        </dl>
        <p className="inline-note">{toolSummaryCopy}</p>
      </div>
      <div className="overview-tool-control-grid">
        {profiles.length ? (
          <label className="stacked-form overview-tool-control-panel">
            <span>Switch profile</span>
            <select
              aria-label={`Switch ${status.tool} profile`}
              value={selectedProfile}
              onChange={(event) => setSelectedProfile(event.target.value)}
            >
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name}>
                  {toolProfileDisplayLabel(settings, snapshot, status.tool, profile.name)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {stateModes.length ? (
          <div className="overview-tool-control-panel">
            <StateModeField
              name={`overview-state-mode-${status.tool}`}
              value={stateMode}
              options={stateModes}
              onChange={setStateMode}
            />
          </div>
        ) : null}
      </div>
      {status.token_warning ? (
        <div className="overview-tool-note-card">
          <p className="inline-note">
            Token warning: {formatTokenWarning(status)}
          </p>
        </div>
      ) : null}
      {status.warnings.length ? (
        <div className="stack-list overview-tool-note-card">
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
        <div className="overview-tool-note-card">
          <p className={`inline-note ${lastResult.status === "error" ? "diagnostic-status-fail" : ""}`}>
            Last result: {lastResult.message}
            {lastResult.remediation ? ` Remediation: ${lastResult.remediation}` : ""}
          </p>
        </div>
      ) : null}
      {!status.binary_found ? (
        <div className="overview-tool-note-card">
          <MissingBinaryGuidance
            tool={status.tool}
            onRefresh={onRefresh}
            refreshLocked={refreshLocked}
          />
        </div>
      ) : null}
      {activeState === false ? (
        <div className="stack-list overview-tool-note-card">
          <p className="inline-note">
            Live credentials changed outside the app. Re-apply the active profile or import the current
            login as a new profile.
          </p>
          {supportsLiveImport ? (
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
          ) : (
            <div className="stack-list">
              <p className="inline-note">
                This app cannot import the current {toolDisplayName(status.tool)} login directly.
                Open account setup to choose another sign-in method.
              </p>
              <button
                className="ghost-button"
                type="button"
                disabled={mutationLocked}
                onClick={() => onAddProfile(status.tool)}
              >
                Open account setup
              </button>
            </div>
          )}
        </div>
      ) : null}
      <div className="button-row overview-tool-actions">
        <button
          className={profiles.length ? "primary-button" : "ghost-button"}
          type="button"
          disabled={mutationLocked}
          onClick={() =>
            profiles.length && selectedProfile
              ? onUse(status.tool, selectedProfile, stateModes.length ? stateMode : null)
              : onAddProfile(status.tool)
          }
        >
          {profiles.length
            ? selectedProfile && selectedProfile === status.active_profile
              ? `Re-apply ${selectedProfileLabel}`
              : selectedProfileLabel
                ? `Switch to ${selectedProfileLabel}`
                : "Switch profile"
            : "Add profile"}
        </button>
        {selected && status.active_profile ? (
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

function MissingBinaryGuidance({
  tool,
  onRefresh,
  refreshLocked,
}: {
  tool: string;
  onRefresh: () => void;
  refreshLocked: boolean;
}) {
  const binary = toolBinaryName(tool);
  const verifyCommand = commandForCurrentPlatform(binary, "verify");
  const pathCommand = commandForCurrentPlatform(binary, "path");
  const installCommand = installCommandForTool(tool);
  const guideUrl = installGuideUrlForTool(tool);

  return (
    <div className="stack-list">
      <p className="inline-note">
        {toolDisplayName(tool)} is not available on PATH, so this computer cannot switch or verify that
        tool yet.
      </p>
      <p className="inline-note">
        Install command: <code>{installCommand}</code>
      </p>
      <p className="inline-note">
        Confirm installation: <code>{verifyCommand}</code>
      </p>
      <p className="inline-note">
        Check terminal path: <code>{pathCommand}</code>
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
        <button className="ghost-button" type="button" disabled={refreshLocked} onClick={onRefresh}>
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
  const detail = warning.message ?? warning.code ?? "Warning reported by the runtime.";
  return warning.remediation ? `${detail} Remediation: ${warning.remediation}` : detail;
}

function credentialBackendLabel(backend: string | null | undefined) {
  switch (backend) {
    case "system_keyring":
    case "system-keyring":
      return "macOS Keychain";
    case "file":
      return "File-backed";
    case "auto":
      return "Automatic";
    default:
      return backend ?? "Unknown";
  }
}

function resolveCardState(status: ToolStatus) {
  if (!status.binary_found) {
    return "neutral";
  }
  if (status.active_profile_applied === false || status.token_warning || status.warnings.length) {
    return "warning";
  }
  if (!status.active_profile) {
    return "neutral";
  }
  return "ok";
}

function statusPillLabel(status: ToolStatus) {
  if (!status.binary_found) {
    return "Missing";
  }
  if (!status.active_profile) {
    return "Not configured";
  }
  if (status.active_profile_applied === false) {
    return "Drifted";
  }
  if (status.token_warning || status.warnings.length) {
    return "Needs review";
  }
  return "Live match";
}

function pillClassForStatus(status: ToolStatus) {
  if (!status.binary_found) {
    return "pill-soft";
  }
  if (!status.active_profile) {
    return "pill-soft";
  }
  if (status.active_profile_applied === false || status.token_warning || status.warnings.length) {
    return "pill-warn";
  }
  return "pill-ok";
}
