import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
import { SplitView } from "../../../components/SplitView";
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
  const workspaceSummaryLabel =
    expectedWorkspaceTarget?.kind === "profile_set"
      ? "Expected set"
      : expectedWorkspaceTarget?.kind === "context"
        ? "Expected imported set"
        : "Expected set";
  const expectedWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.expectedContext);
  const currentWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.currentContext);
  const workspaceResult = lastCommandResults.global.workspace;
  const contextResult = lastCommandResults.global.context;
  const currentSetLabel = activeSetLabel(settings, snapshot);
  const [selectedTool, setSelectedTool] = useState(snapshot.statuses[0]?.tool ?? "");
  const activeToolsCount = snapshot.statuses.filter((status) => status.active_profile).length;
  const currentSetProfiles = snapshot.statuses.map((status) => ({
    tool: status.tool,
    label: status.active_profile
      ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
      : null,
  }));
  const selectedToolStatus =
    snapshot.statuses.find((status) => status.tool === selectedTool) ?? snapshot.statuses[0] ?? null;
  const selectedToolProfileLabel =
    selectedToolStatus?.active_profile
      ? toolProfileDisplayLabel(
          settings,
          snapshot,
          selectedToolStatus.tool,
          selectedToolStatus.active_profile,
        )
      : null;

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
      title="Switch readiness"
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
            onClick={() => onOpenProfiles(selectedToolStatus?.tool ?? "claude")}
          >
            + Profile
          </button>
        </div>
      }
    >
      <div className="overview-status-strip" aria-label="Overview highlights">
        <article className="overview-status-card">
          <p className="card-kicker">Active tools</p>
          <h3>{activeToolsCount}</h3>
          <p className="inline-note">
            {activeToolsCount} active profile
            {activeToolsCount === 1 ? "" : "s"}
          </p>
        </article>
        <article className="overview-status-card">
          <p className="card-kicker">Shared set</p>
          <h3>{currentSetLabel ?? "No active set"}</h3>
          <p className="inline-note">{currentSetLabel ? "Shared set ready" : "Choose a shared set or switch per tool."}</p>
        </article>
        <article className={`overview-status-card ${hasWorkspaceMismatch ? "overview-status-card-warning" : ""}`}>
          <p className="card-kicker">Project</p>
          <h3>{hasWorkspaceMismatch ? "Needs review" : "Ready"}</h3>
          <p className="inline-note">
            {hasWorkspaceMismatch ? "Project mismatch" : "Ready to switch"}
          </p>
        </article>
      </div>
      <SplitView
        className="overview-layout"
        primaryClassName="overview-summary-pane"
        secondaryClassName="overview-tools-pane"
        primary={
          <div className="overview-stack desktop-pane-column">
            {currentSetLabel || currentSetProfiles.length ? (
              <article className="overview-current-set diagnostic-card">
                <div className="overview-current-set-copy">
                  <div className="overview-current-set-header">
                    <div>
                      <p className="card-kicker">Current set</p>
                      <h3>{currentSetLabel ?? "No active set"}</h3>
                    </div>
                    <span className={`pill ${activeToolsCount ? "pill-ok" : "pill-soft"}`}>
                      {activeToolsCount ? `${activeToolsCount} ready` : "Needs setup"}
                    </span>
                  </div>
                  <p className="inline-note">
                    {activeToolsCount} of {snapshot.statuses.length} tools are ready to switch.
                  </p>
                  <div className="overview-current-set-inline">
                    <p className="inline-note">
                      Current set: <strong>{currentSetLabel ?? "No active set"}</strong>
                    </p>
                    <p className="inline-note">
                      Shared switching stays available when profile names line up across installed tools.
                    </p>
                  </div>
                  <div className="overview-current-set-grid">
                    {currentSetProfiles.map((entry) => (
                      <div key={entry.tool} className="overview-current-set-cell">
                        <span className="overview-current-set-cell-label">{titleCase(entry.tool)}</span>
                        <strong>{entry.label ?? "Not configured"}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overview-current-set-actions">
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
                </div>
              </article>
            ) : null}
            {selectedToolStatus ? (
              <article className={`diagnostic-card overview-focus-card overview-focus-card-${resolveCardState(selectedToolStatus)}`}>
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Current identity</p>
                    <h3>{titleCase(selectedToolStatus.tool)}</h3>
                  </div>
                  <span className={`pill ${pillClassForStatus(selectedToolStatus)}`}>
                    {statusPillLabel(selectedToolStatus)}
                  </span>
                </div>
                <div className="overview-focus-grid">
                  <div>
                    <span className="overview-current-set-cell-label">Active</span>
                    <strong>{selectedToolProfileLabel ?? "Not configured"}</strong>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Live match</span>
                    <strong>
                      {selectedToolStatus.active_profile_applied === false
                        ? "Drifted"
                        : selectedToolStatus.active_profile_applied
                          ? "Ready"
                          : "Unknown"}
                    </strong>
                  </div>
                  <div>
                    <span className="overview-current-set-cell-label">Backend</span>
                    <strong>{selectedToolStatus.credential_backend ?? "Unknown"}</strong>
                  </div>
                </div>
                <p className="inline-note">
                  {selectedToolStatus.active_profile
                    ? `${titleCase(selectedToolStatus.tool)} is currently focused on ${selectedToolProfileLabel}. Inspect the detail pane for switching, drift recovery, and profile actions.`
                    : `${titleCase(selectedToolStatus.tool)} has not been configured yet. Add a profile to make it available for switching.`}
                </p>
                <div className="button-row">
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => setSelectedTool(selectedToolStatus.tool)}
                  >
                    Inspect selected tool
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => onOpenProfiles(selectedToolStatus.tool, selectedToolStatus.active_profile ?? null)}
                  >
                    Manage tool
                  </button>
                </div>
              </article>
            ) : null}
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
                    {expectedWorkspaceTarget ? "Use expected set now" : "Open sets"}
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
                  Keep bulk switches, project rule changes, and imported-set activations visible without leaving Overview.
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
                    Last imported-set result: {normalizeRuntimeLanguage(contextResult.message)}
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
        }
        secondary={
          <div className="overview-stack desktop-pane-column">
            <div className="overview-tools-header">
              <div>
                <p className="card-kicker">Tools</p>
                <h3>Live account state</h3>
              </div>
              <p className="inline-note">
                Keep the full switching inventory visible while inspecting one tool in detail.
              </p>
            </div>
            <SplitView
              className="overview-tools-split"
              primaryClassName="overview-tool-list-pane"
              secondaryClassName="overview-tool-detail-pane"
              primary={
                <article className="diagnostic-card overview-tools-list-card">
                  <div className="overview-tool-list-header">
                    <p className="inline-note">
                      Select a tool to inspect its active account, state mode, and recovery actions.
                    </p>
                  </div>
                  <div className="overview-tool-list-columns" aria-hidden="true">
                    <span>Tool</span>
                    <span>Status</span>
                    <span>Auth</span>
                    <span>State</span>
                  </div>
                  <div className="stack-list desktop-list-stack overview-tool-list-stack">
                    {snapshot.statuses.map((status) => (
                      <button
                        key={status.tool}
                        type="button"
                        aria-label={`Inspect ${titleCase(status.tool)}`}
                        className={`list-row overview-tool-row ${
                          selectedTool === status.tool ? "overview-tool-row-selected" : ""
                        } overview-tool-row-${resolveCardState(status)}`}
                        onClick={() => setSelectedTool(status.tool)}
                      >
                        <div className="overview-tool-row-main">
                          <div className="overview-tool-row-title">
                            <span className={`health-dot health-dot-${resolveCardState(status)}`} aria-hidden="true" />
                            <strong>{titleCase(status.tool)}</strong>
                          </div>
                          <p className="inline-note">
                            {status.active_profile
                              ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
                              : "No saved profile"}
                          </p>
                        </div>
                        <div className="overview-tool-row-meta">
                          <span>{statusPillLabel(status)}</span>
                          <span>{status.auth_method ?? "Unknown"}</span>
                          <span>{status.state_mode ?? "n/a"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </article>
              }
              secondary={
                selectedToolStatus ? (
                  <ToolInspector
                    status={selectedToolStatus}
                    profiles={snapshot.profiles[selectedToolStatus.tool]?.profiles ?? []}
                    lastResult={lastCommandResults.tool[selectedToolStatus.tool]}
                    mutationLocked={mutationLock.isBusy}
                    refreshLocked={mutationLock.isBusy || refresh.isPending}
                    onRefresh={() => refresh.mutate()}
                    stateModes={supportedStateModes(selectedToolStatus.tool, toolCapabilities)}
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
                  />
                ) : (
                  <article className="diagnostic-card">
                    <h3>No tools detected</h3>
                    <p className="inline-note">
                      Add or detect a supported CLI before switching can begin.
                    </p>
                  </article>
                )
              }
            />
          </div>
        }
      />
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
    <article className={`tool-card overview-tool-card overview-tool-card-${resolveCardState(status)}`}>
      <header className="overview-tool-card-header">
        <div>
          <p className="card-kicker">Selected tool</p>
          <h3>{activeProfileLabel ?? "Not configured"}</h3>
          <p className="inline-note">{titleCase(status.tool)}</p>
        </div>
        <div className="overview-tool-status">
          <span className={`health-dot health-dot-${resolveCardState(status)}`} aria-hidden="true" />
          <span className={`pill ${pillClassForStatus(status)}`}>
            {statusPillLabel(status)}
          </span>
        </div>
      </header>
      <dl className="overview-tool-facts">
        <div>
          <dt>Active</dt>
          <dd>{activeProfileLabel ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Live match</dt>
          <dd>
            {activeState === null || activeState === undefined
              ? "Unknown"
              : activeState
                ? "Yes"
                : "Drifted"}
          </dd>
        </div>
        <div>
          <dt>Auth</dt>
          <dd>{status.auth_method ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Backend</dt>
          <dd>{status.credential_backend ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{status.state_mode ?? "n/a"}</dd>
        </div>
      </dl>
      <p className="inline-note">
        {status.active_profile
          ? `${titleCase(status.tool)} is using ${activeProfileLabel}. Keep live match green before you start coding.`
          : `Add a saved profile for ${titleCase(status.tool)} before switching from the desktop app.`}
      </p>
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
        <StateModeField
          name={`overview-state-mode-${status.tool}`}
          value={stateMode}
          options={stateModes}
          onChange={setStateMode}
        />
      ) : null}
      {!status.binary_found ? (
        <MissingBinaryGuidance
          tool={status.tool}
          onRefresh={onRefresh}
          refreshLocked={refreshLocked}
        />
      ) : null}
      {activeState === false ? (
        <div className="stack-list">
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
                This runtime does not support one-click capture for {titleCase(status.tool)}.
                Open profile setup to choose another sign-in method.
              </p>
              <button
                className="ghost-button"
                type="button"
                disabled={mutationLocked}
                onClick={() => onAddProfile(status.tool)}
              >
                Open profile setup
              </button>
            </div>
          )}
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
                  {toolProfileDisplayLabel(settings, snapshot, status.tool, profile.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <div className="button-row">
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
        {titleCase(tool)} is not available on PATH, so this Mac cannot switch or verify that
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
