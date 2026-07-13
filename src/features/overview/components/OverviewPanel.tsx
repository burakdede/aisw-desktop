import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ToolBrand } from "../../../components/ToolBrand";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
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

type OverviewHealthState =
  | "ready"
  | "needs_attention"
  | "blocked"
  | "not_configured"
  | "not_verified";

const OVERVIEW_COMPACT_BREAKPOINT = 800;

export function OverviewPanel({
  snapshot,
  settings,
  toolCapabilities,
  onOpenProfiles,
  onOpenContexts,
  onOpenQuickSwitch,
  onOpenActivity,
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
  onOpenActivity: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    activateWorkspaceTargetMutation,
    useProfileMutation,
    mutationLock,
    lastCommandResults,
  } = useDesktopActions();

  const refreshSnapshot = () => {
    void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
  };

  const workspaceStatus = parseWorkspaceStatus(snapshot.workspace_status ?? undefined);
  const hasWorkspaceMismatch =
    workspaceStatus.status === "mismatch" &&
    workspaceStatus.expectedContext !== workspaceStatus.currentContext;
  const expectedWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.expectedContext);
  const currentWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.currentContext);
  const currentSetLabel = activeSetLabel(settings, snapshot);
  const currentSetDisplay = currentSetLabel ?? "None";
  const [selectedTool, setSelectedTool] = useState(snapshot.statuses[0]?.tool ?? "");
  const [compactLayout, setCompactLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < OVERVIEW_COMPACT_BREAKPOINT : false,
  );
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const selectedStatus =
    snapshot.statuses.find((status) => status.tool === selectedTool) ?? snapshot.statuses[0] ?? null;
  const overviewStates = snapshot.statuses.map(resolveOverviewState);
  const readyCount = overviewStates.filter((state) => state === "ready").length;
  const attentionCount = overviewStates.filter((state) => state === "needs_attention").length;
  const notConfiguredCount = overviewStates.filter((state) => state === "not_configured").length;
  const notVerifiedCount = overviewStates.filter((state) => state === "not_verified").length;
  const blockedCount = overviewStates.filter((state) => state === "blocked").length;
  const overallState: OverviewHealthState = blockedCount
    ? "blocked"
    : attentionCount
      ? "needs_attention"
      : !snapshot.statuses.length || readyCount === 0
        ? "not_configured"
        : readyCount === snapshot.statuses.length
          ? "ready"
          : "not_verified";
  const workspaceResult = lastCommandResults.global.workspace;
  const contextResult = lastCommandResults.global.context;
  const bulkResult = lastCommandResults.global["profile-set"] ?? lastCommandResults.global["switch-all"];

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const updateLayout = () => {
      setCompactLayout(window.innerWidth < OVERVIEW_COMPACT_BREAKPOINT);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  const overviewHeadline = useMemo(() => {
    if (blockedCount) {
      return `${blockedCount} tool${blockedCount === 1 ? "" : "s"} blocked`;
    }
    if (attentionCount) {
      return `${attentionCount} tool${attentionCount === 1 ? "" : "s"} need attention`;
    }
    if (notConfiguredCount === snapshot.statuses.length) {
      return "No tools configured yet";
    }
    if (notVerifiedCount) {
      return `${notVerifiedCount} tool${notVerifiedCount === 1 ? "" : "s"} still need verification`;
    }
    if (readyCount) {
      return `${readyCount} tool${readyCount === 1 ? "" : "s"} ready`;
    }
    return "Review tool readiness";
  }, [attentionCount, blockedCount, notConfiguredCount, notVerifiedCount, readyCount, snapshot.statuses.length]);

  const recentSummary = latestOverviewSummary({
    bulkResult,
    workspaceResult,
    contextResult,
  });
  const workspaceActivationTarget = hasWorkspaceMismatch
    ? resolveWorkspaceActivationTarget(workspaceStatus.expectedContext, settings, snapshot)
    : null;
  const statusMeta = hasWorkspaceMismatch
    ? `Project rules expect ${expectedWorkspaceDisplay}`
    : readyCount
      ? `${readyCount}/${snapshot.statuses.length} ready`
      : "Review local switching state";
  const showInspector = !compactLayout || compactInspectorOpen;
  const showToolList = !compactLayout || !compactInspectorOpen;
  const selectedToolName = selectedStatus ? toolDisplayName(selectedStatus.tool) : "Tool";

  return (
    <div className="overview-screen screen-content">
      <div className={`overview-status-strip overview-status-strip-${overallState}`}>
        <div className="overview-status-summary">
          <span className={`overview-status-symbol overview-status-symbol-${overallState}`} aria-hidden="true">
            {overviewStatusSymbol(overallState)}
          </span>
          <strong>{overviewHeadline}</strong>
        </div>
        <p className="overview-status-meta">{statusMeta}</p>
      </div>

      <div className="overview-set-row">
        <div className="overview-set-row-main">
          <span className="overview-set-row-label">Current set</span>
          <strong>{currentSetDisplay}</strong>
        </div>
        <div className="button-row overview-set-row-actions">
          <button
            className="ghost-button"
            type="button"
            disabled={mutationLock.isBusy}
            onClick={onOpenContexts}
          >
            {currentSetLabel ? "Open Sets" : "Choose Set…"}
          </button>
        </div>
      </div>

      <div className="overview-master-detail">
        {showToolList ? (
        <section className="overview-pane overview-list-pane">
          <div className="overview-pane-header">
            <h3>Tools</h3>
            <p className="overview-pane-meta">{snapshot.statuses.length} total</p>
          </div>
          {snapshot.statuses.length ? (
            <div className="overview-tool-list" role="list" aria-label="Tools">
              {snapshot.statuses.map((status) => {
                const state = resolveOverviewState(status);
                const activeProfileLabel = status.active_profile
                  ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
                  : toolListEmptyLabel(status);
                return (
                  <button
                    key={status.tool}
                    className={`overview-tool-list-row ${
                      selectedTool === status.tool ? "overview-tool-list-row-selected" : ""
                    }`}
                    type="button"
                    aria-label={`Inspect ${titleCase(status.tool)}`}
                    aria-pressed={selectedTool === status.tool}
                    onClick={() => {
                      setSelectedTool(status.tool);
                      if (compactLayout) {
                        setCompactInspectorOpen(true);
                      }
                    }}
                  >
                    <div className="overview-tool-list-cell overview-tool-list-cell-status">
                      <span className={`overview-status-symbol overview-status-symbol-${state}`} aria-hidden="true">
                        {overviewStatusSymbol(state)}
                      </span>
                    </div>
                    <div className="overview-tool-list-cell overview-tool-list-cell-main">
                      <ToolBrand tool={status.tool} className="tool-brand-inline" logoSize={18} />
                    </div>
                    <span className="overview-tool-list-profile">{activeProfileLabel}</span>
                    <span className={`overview-tool-list-status overview-tool-list-status-${state}`}>
                      {overviewStatusLabel(state)}
                    </span>
                    <span className="overview-tool-list-chevron" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="overview-empty-state">
              <h3>No tools detected</h3>
              <p className="inline-note">Install or configure a supported tool before switching can begin.</p>
            </div>
          )}
        </section>
        ) : null}

        {selectedStatus && showInspector ? (
          <ToolInspector
            key={selectedStatus.tool}
            status={selectedStatus}
            profiles={snapshot.profiles[selectedStatus.tool]?.profiles ?? []}
            lastResult={lastCommandResults.tool[selectedStatus.tool]}
            mutationLocked={mutationLock.isBusy}
            refreshLocked={mutationLock.isBusy}
            onRefresh={refreshSnapshot}
            stateModes={supportedStateModes(selectedStatus.tool, toolCapabilities)}
            settings={settings}
            snapshot={snapshot}
            compactLayout={compactLayout}
            onImport={(tool) =>
              onOpenProfiles(tool, null, {
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
            onBack={compactLayout ? () => setCompactInspectorOpen(false) : undefined}
            toolCapabilities={toolCapabilities}
            workspaceMismatch={
              hasWorkspaceMismatch
                ? {
                    expected: expectedWorkspaceDisplay,
                    current: currentWorkspaceDisplay,
                    onResolve: () => {
                      if (!workspaceActivationTarget) {
                        onOpenContexts();
                        return;
                      }
                      activateWorkspaceTargetMutation.mutate({
                        ...workspaceActivationTarget,
                        matchedTarget: workspaceStatus.target,
                      });
                    },
                    canResolveDirectly: Boolean(workspaceActivationTarget),
                  }
                : null
            }
          />
        ) : showInspector ? (
          <aside className="overview-pane overview-inspector-pane">
            <div className="overview-empty-state">
              <h3>{compactLayout ? selectedToolName : "No tool selected"}</h3>
              <p className="inline-note">Choose a tool to inspect its active profile and switching state.</p>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="overview-footer-strip">
        <p>{recentSummary}</p>
        <button className="ghost-button" type="button" onClick={onOpenActivity}>
          View Activity
        </button>
      </div>
    </div>
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
  compactLayout,
  onImport,
  onUse,
  onAddProfile,
  onOpenDetails,
  workspaceMismatch,
  onBack,
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
  compactLayout: boolean;
  onImport: (tool: string) => void;
  onUse: (tool: string, profile: string, stateMode: string | null) => void;
  onAddProfile: (tool: string) => void;
  onOpenDetails: (tool: string, profile: string | null | undefined) => void;
  workspaceMismatch: {
    expected: string;
    current: string;
    onResolve: () => void;
    canResolveDirectly: boolean;
  } | null;
  onBack?: () => void;
}) {
  const [stateMode, setStateMode] = useState(status.state_mode ?? stateModes[0] ?? "");
  const [selectedProfile, setSelectedProfile] = useState(status.active_profile ?? profiles[0]?.name ?? "");
  const activeProfileLabel = status.active_profile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
    : null;
  const selectedProfileLabel = selectedProfile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, selectedProfile)
    : null;
  const supportsLiveImport = supportsProfileImportMode(status.tool, toolCapabilities, "from_live");
  const state = resolveOverviewState(status);
  const statusLabel = overviewStatusLabel(state);
  const hasAlternateSelection = Boolean(selectedProfile && selectedProfile !== status.active_profile);

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
    <aside className="overview-pane overview-inspector-pane tool-card">
      <header className="overview-inspector-header">
        <div className="overview-inspector-title-block">
          {compactLayout && onBack ? (
            <button className="ghost-button overview-inspector-back" type="button" onClick={onBack}>
              Back
            </button>
          ) : null}
          <h3>
            <ToolBrand tool={status.tool} className="tool-brand-heading" logoSize={20} />
          </h3>
          <p className="inline-note">
            {activeProfileLabel
              ? `Active profile: ${activeProfileLabel}`
              : !status.binary_found
                ? "Tool not installed"
                : "No saved profile yet"}
          </p>
        </div>
        <div className={`overview-inspector-status overview-inspector-status-${state}`}>
          <span className={`overview-status-symbol overview-status-symbol-${state}`} aria-hidden="true">
            {overviewStatusSymbol(state)}
          </span>
          <span>{statusLabel}</span>
        </div>
      </header>

      <dl className="overview-inspector-facts">
        <div>
          <dt>Active profile</dt>
          <dd>{activeProfileLabel ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Authentication</dt>
          <dd>{status.auth_method ? titleCase(status.auth_method.replace(/_/g, " ")) : "Not configured"}</dd>
        </div>
        <div>
          <dt>Backend</dt>
          <dd>{credentialBackendLabel(status.credential_backend)}</dd>
        </div>
        <div>
          <dt>Live state</dt>
          <dd>{statusLabel}</dd>
        </div>
        {workspaceMismatch ? (
          <div>
            <dt>Project rules</dt>
            <dd>{`Expected ${workspaceMismatch.expected}`}</dd>
          </div>
        ) : null}
      </dl>

      {status.active_profile_applied === false ? (
        <div className="overview-inline-notice overview-inline-notice-warn">
          <div className="overview-inline-notice-copy">
            <span className="overview-inline-notice-symbol" aria-hidden="true">▲</span>
            <p>
              Live credentials do not match <strong>{activeProfileLabel ?? "the saved profile"}</strong>.
            </p>
          </div>
          <div className="button-row overview-inline-notice-actions">
            {selectedProfileLabel ? (
              <button
                className="primary-button"
                type="button"
                disabled={mutationLocked}
                onClick={() => {
                  if (!selectedProfile) {
                    return;
                  }
                  onUse(status.tool, selectedProfile, stateModes.length ? stateMode : null);
                }}
              >
                Re-apply {selectedProfileLabel}
              </button>
            ) : null}
            {supportsLiveImport ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => onImport(status.tool)}
              >
                Import Current…
              </button>
            ) : (
              <button
                className="ghost-button"
                type="button"
                disabled={mutationLocked}
                onClick={() => onAddProfile(status.tool)}
              >
                Open account setup
              </button>
            )}
          </div>
        </div>
      ) : null}

      {profiles.length ? (
        <label className="stacked-form overview-inspector-control">
          <span>Active profile</span>
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
        <div className="overview-inspector-control">
          <span className="overview-inspector-control-label">State mode</span>
          <div className="overview-state-mode-control" role="group" aria-label="State mode">
            {stateModes.map((mode) => (
              <button
                key={mode}
                className={`overview-state-mode-button ${stateMode === mode ? "overview-state-mode-button-active" : ""}`}
                type="button"
                aria-pressed={stateMode === mode}
                onClick={() => setStateMode(mode)}
              >
                {titleCase(mode)}
              </button>
            ))}
          </div>
          <p className="inline-note">
            {stateModes.includes("shared")
              ? stateMode === "shared"
                ? "Keep the normal tool config and history while switching credentials only."
                : "Separate configuration, history, and extensions for this profile."
              : "This tool keeps authentication and local state together."}
          </p>
        </div>
      ) : null}

      {!profiles.length ? (
        <div className="button-row overview-inspector-actions">
          <button
            className="primary-button"
            type="button"
            disabled={mutationLocked}
            onClick={() => onAddProfile(status.tool)}
          >
            Add Profile…
          </button>
        </div>
      ) : hasAlternateSelection ? (
        <div className="button-row overview-inspector-actions">
          <button
            className="primary-button"
            type="button"
            disabled={mutationLocked}
            onClick={() => {
              if (!selectedProfile) {
                return;
              }
              onUse(status.tool, selectedProfile, stateModes.length ? stateMode : null);
            }}
          >
            Switch
          </button>
          {status.active_profile ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => onOpenDetails(status.tool, status.active_profile)}
            >
              Open Profile
            </button>
          ) : null}
        </div>
      ) : status.active_profile ? (
        <div className="button-row overview-inspector-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => onOpenDetails(status.tool, status.active_profile)}
          >
            Open Profile
          </button>
          {workspaceMismatch ? (
            <button
              className="ghost-button"
              type="button"
              disabled={mutationLocked}
              onClick={workspaceMismatch.onResolve}
            >
              {workspaceMismatch.canResolveDirectly ? "Use Expected Set" : "Open Sets"}
            </button>
          ) : null}
        </div>
      ) : null}

      {status.token_warning ? (
        <div className="overview-inline-notice overview-inline-notice-warn">
          <div className="overview-inline-notice-copy">
            <span className="overview-inline-notice-symbol" aria-hidden="true">▲</span>
            <p>{formatTokenWarning(status)}</p>
          </div>
        </div>
      ) : null}

      {status.warnings.length ? (
        <div className="overview-inline-notice overview-inline-notice-warn">
          <div className="overview-inline-notice-copy">
            <span className="overview-inline-notice-symbol" aria-hidden="true">▲</span>
            <p>{formatDiagnosticWarning(status.warnings[0])}</p>
          </div>
        </div>
      ) : null}

      {lastResult ? (
        <div className={`overview-inline-notice overview-inline-notice-${lastResult.status === "error" ? "warn" : "ok"}`}>
          <div className="overview-inline-notice-copy">
            <span className="overview-inline-notice-symbol" aria-hidden="true">
              {lastResult.status === "error" ? "▲" : "●"}
            </span>
            <p>
              {`Last result: ${lastResult.message}`}
              {lastResult.remediation ? ` Remediation: ${lastResult.remediation}` : ""}
            </p>
          </div>
        </div>
      ) : null}

      {!status.binary_found ? (
        <div className="overview-missing-binary">
          <MissingBinaryGuidance
            tool={status.tool}
            onRefresh={onRefresh}
            refreshLocked={refreshLocked}
          />
        </div>
      ) : null}
    </aside>
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
        {toolDisplayName(tool)} is not available on PATH, so this computer cannot switch or verify that tool yet.
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
      <div className="button-row">
        <button className="ghost-button" type="button" onClick={() => openExternalGuide(guideUrl)}>
          Open installation guide
        </button>
        <button className="ghost-button" type="button" disabled={refreshLocked} onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </div>
  );
}

function latestOverviewSummary({
  bulkResult,
  workspaceResult,
  contextResult,
}: {
  bulkResult?: {
    status: "success" | "error";
    message: string;
    remediation?: string;
  };
  workspaceResult?: {
    status: "success" | "error";
    message: string;
    remediation?: string;
  };
  contextResult?: {
    status: "success" | "error";
    message: string;
    remediation?: string;
  };
}) {
  if (bulkResult) {
    return `Last set result: ${bulkResult.message}${bulkResult.remediation ? ` Remediation: ${bulkResult.remediation}` : ""}`;
  }
  if (workspaceResult) {
    return `Last project result: ${workspaceResult.message}${workspaceResult.remediation ? ` Remediation: ${workspaceResult.remediation}` : ""}`;
  }
  if (contextResult) {
    return `Last set result: ${normalizeRuntimeLanguage(contextResult.message)}${contextResult.remediation ? ` Remediation: ${normalizeRuntimeLanguage(contextResult.remediation)}` : ""}`;
  }
  return "No recent set or workspace changes are recorded in this session.";
}

function toolListEmptyLabel(status: ToolStatus) {
  if (!status.binary_found) {
    return "Tool not installed";
  }
  if (!status.active_profile) {
    return "Not configured";
  }
  return "Verification required";
}

function resolveOverviewState(status: ToolStatus): OverviewHealthState {
  if (!status.binary_found) {
    return "blocked";
  }
  if (!status.active_profile) {
    return "not_configured";
  }
  if (status.active_profile_applied === false || status.token_warning || status.warnings.length) {
    return "needs_attention";
  }
  if (status.active_profile_applied === null || status.active_profile_applied === undefined) {
    return "not_verified";
  }
  return "ready";
}

function overviewStatusLabel(state: OverviewHealthState) {
  switch (state) {
    case "ready":
      return "Ready";
    case "needs_attention":
      return "Needs Attention";
    case "blocked":
      return "Blocked";
    case "not_configured":
      return "Not Configured";
    case "not_verified":
      return "Not Verified";
  }
}

function overviewStatusSymbol(state: OverviewHealthState) {
  switch (state) {
    case "ready":
      return "●";
    case "needs_attention":
      return "▲";
    case "blocked":
      return "⨯";
    case "not_configured":
      return "○";
    case "not_verified":
      return "?";
  }
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
  return `Token warning: ${detail}${suffix}`;
}

function formatDiagnosticWarning(warning: ToolStatus["warnings"][number]) {
  const detail = warning.message ?? warning.code ?? "Warning reported by the runtime.";
  return warning.remediation ? `Warning: ${detail} Remediation: ${warning.remediation}` : `Warning: ${detail}`;
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
      return backend ?? "Backend Unavailable";
  }
}
