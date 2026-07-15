import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SFEllipsisCircle } from "sf-symbols-lib/monochrome/SFEllipsisCircle";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { ToolBrand } from "../../../components/ToolBrand";
import { useCompactLayout } from "../../../components/useCompactLayout";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
import { credentialBackendLabel as formatCredentialBackendLabel } from "../../../lib/credential-backends";
import {
  installGuideUrlForTool,
  openExternalGuide,
} from "../../../lib/tool-guidance";
import { supportedStateModes } from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import {
  activeSetLabel,
  contextDisplayLabel,
  toolProfileDisplayLabel,
} from "../../../lib/profile-display";
import { PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import { BACKEND_UNAVAILABLE_LABEL } from "../../../lib/display-copy";
import {
  buildOverviewInspectorPresentation,
  overviewAuthMethodLabel,
  overviewDiagnosticWarning,
  overviewHeadline,
  overviewMetaLabel,
  overviewRecentSummary,
  overviewToolListProfileLabel,
  overviewStateModeCopy,
  overviewTokenWarning,
  overviewWorkspaceActionLabel,
  resolveOverviewSelectedProfile,
  resolveOverviewSelectedTool,
  resolveOverviewStateMode,
  resolveOverallOverviewState,
} from "../../../lib/overview-display";
import {
  overviewHealthLabel,
  overviewHealthSymbol,
  overviewHealthText,
  toolVerificationLabel,
  resolveOverviewHealthState,
  type OverviewHealthState,
} from "../../../lib/status-display";
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selectedTool, setSelectedTool] = useState(snapshot.statuses[0]?.tool ?? "");
  const compactLayout = useCompactLayout(rootRef, PANEL_COMPACT_BREAKPOINT);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const selectedStatus =
    snapshot.statuses.find((status) => status.tool === selectedTool) ?? snapshot.statuses[0] ?? null;
  const overviewStates = snapshot.statuses.map(resolveOverviewHealthState);
  const overallState: OverviewHealthState = resolveOverallOverviewState(overviewStates);
  const workspaceResult = lastCommandResults.global.workspace;
  const contextResult = lastCommandResults.global.context;
  const bulkResult = lastCommandResults.global["profile-set"] ?? lastCommandResults.global["switch-all"];

  useEffect(() => {
    const nextTool = resolveOverviewSelectedTool(selectedTool, snapshot.statuses);
    if (nextTool !== selectedTool) {
      setSelectedTool(nextTool);
    }
  }, [selectedTool, snapshot.statuses]);

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  const headline = useMemo(() => overviewHeadline(overviewStates), [overviewStates]);
  const metaLabel = useMemo(() => overviewMetaLabel(overviewStates), [overviewStates]);

  const recentSummary = overviewRecentSummary({
    bulkResult,
    workspaceResult,
    contextResult,
  });
  const workspaceActivationTarget = hasWorkspaceMismatch
    ? resolveWorkspaceActivationTarget(workspaceStatus.expectedContext, settings, snapshot)
    : null;
  const showInspector = !compactLayout || compactInspectorOpen;
  const showToolList = !compactLayout || !compactInspectorOpen;
  const selectedToolName = selectedStatus ? toolDisplayName(selectedStatus.tool) : "Tool";

  return (
    <div ref={rootRef} className="overview-screen screen-content">
      <div className={`overview-status-strip overview-status-strip-${overallState}`}>
        <div className="overview-status-summary">
          <span className={`overview-status-symbol overview-status-symbol-${overallState}`} aria-hidden="true">
            {overviewHealthSymbol(overallState)}
          </span>
          <strong>{headline}</strong>
        </div>
        <p className="overview-status-meta">
          {hasWorkspaceMismatch ? `Expected set: ${expectedWorkspaceDisplay}` : metaLabel}
        </p>
      </div>

      <div className="overview-set-row">
        <div className="overview-set-row-main">
          <span className="overview-set-row-inline">
            <span className="overview-set-row-label">Current set:</span>
            <strong>{currentSetDisplay}</strong>
          </span>
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
                const state = resolveOverviewHealthState(status);
                const activeProfileLabel = overviewToolListProfileLabel(
                  status,
                  settings,
                  snapshot,
                );
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
                        {overviewHealthSymbol(state)}
                      </span>
                    </div>
                    <div className="overview-tool-list-cell overview-tool-list-cell-main">
                      <ToolBrand tool={status.tool} className="tool-brand-inline" logoSize={18} />
                    </div>
                    <span className="overview-tool-list-profile">{activeProfileLabel}</span>
                    <span className={`overview-tool-list-status overview-tool-list-status-${state}`}>
                      {overviewHealthText(status, state)}
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
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const supportsLiveImport = supportsProfileImportMode(status.tool, toolCapabilities, "from_live");
  const inspector = buildOverviewInspectorPresentation({
    profiles,
    selectedProfile,
    settings,
    snapshot,
    stateModes,
    status,
    supportsLiveImport,
    workspaceMismatchCanResolveDirectly: workspaceMismatch?.canResolveDirectly ?? false,
    workspaceMismatchPresent: Boolean(workspaceMismatch),
  });
  const primaryAction = inspector.primaryAction;
  const secondaryAction = inspector.secondaryAction;

  useEffect(() => {
    const nextStateMode = resolveOverviewStateMode(stateMode, stateModes);
    if (nextStateMode !== stateMode) {
      setStateMode(nextStateMode);
    }
  }, [stateMode, stateModes]);

  useEffect(() => {
    const nextProfile = resolveOverviewSelectedProfile(
      selectedProfile,
      profiles,
      status.active_profile,
    );
    if (nextProfile !== selectedProfile) {
      setSelectedProfile(nextProfile);
    }
  }, [profiles, selectedProfile, status.active_profile]);

  useEffect(() => {
    if (!actionsMenuOpen) {
      return;
    }

    function closeActions(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-overview-actions]")) {
        return;
      }
      setActionsMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeActions);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeActions);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionsMenuOpen]);

  function runPrimaryAction() {
    if (!selectedProfile) {
      return;
    }
    onUse(status.tool, selectedProfile, stateModes.length ? stateMode : null);
  }

  function runInspectorAction(kind: ReturnType<typeof buildOverviewInspectorPresentation>["menuActions"][number]["kind"]) {
    switch (kind) {
      case "switch":
      case "reapply":
        if (!selectedProfile) {
          return;
        }
        onUse(status.tool, selectedProfile, stateModes.length ? stateMode : null);
        return;
      case "import_current":
        onImport(status.tool);
        return;
      case "open_account_setup":
        onAddProfile(status.tool);
        return;
      case "open_profile":
        onOpenDetails(status.tool, status.active_profile);
        return;
      case "resolve_workspace":
        workspaceMismatch?.onResolve();
        return;
      case "refresh":
        onRefresh();
        return;
    }
  }

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
          <p className="inline-note">{inspector.summaryLabel}</p>
        </div>
        <div className={`overview-inspector-status overview-inspector-status-${inspector.state}`}>
          <span className={`overview-status-symbol overview-status-symbol-${inspector.state}`} aria-hidden="true">
            {overviewHealthSymbol(inspector.state)}
          </span>
          <span>{inspector.statusLabel}</span>
        </div>
      </header>

      {status.active_profile_applied === false ? (
        <div className="overview-inline-notice overview-inline-notice-warn">
          <div className="overview-inline-notice-copy">
            <span className="overview-inline-notice-symbol" aria-hidden="true">▲</span>
            <div className="overview-inline-notice-body">
              <p>
                Live credentials do not match <strong>{inspector.activeProfileLabel ?? "the saved profile"}</strong>.
              </p>
              <p>{toolDisplayName(status.tool)} appears to have been signed into outside AI Switch.</p>
            </div>
          </div>
        </div>
      ) : null}

      {!status.binary_found ? (
        <div className="overview-missing-binary">
          <p className="inline-note">{toolDisplayName(status.tool)} is not installed on this Mac.</p>
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={() => openExternalGuide(installGuideUrlForTool(status.tool))}>
              Installation Help
            </button>
            <button className="ghost-button" type="button" disabled={refreshLocked} onClick={onRefresh}>
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      {status.binary_found && !inspector.hasProfiles ? (
        <div className="overview-empty-state overview-empty-state-inline">
          <h3>No profile configured</h3>
          <p className="inline-note">Add a saved profile before switching this tool from Overview.</p>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => onAddProfile(status.tool)}>
              Add Profile…
            </button>
          </div>
        </div>
      ) : null}

      {inspector.hasProfiles ? (
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
            {overviewStateModeCopy(stateModes, stateMode, status.tool)}
          </p>
        </div>
      ) : inspector.hasProfiles && status.binary_found ? (
        <div className="overview-inspector-control">
          <span className="overview-inspector-control-label">State mode</span>
          <strong className="overview-static-value">Isolated</strong>
          <p className="inline-note">{overviewStateModeCopy([], "isolated", status.tool)}</p>
        </div>
      ) : null}

      {inspector.showActionArea ? (
      <div className="overview-inspector-actions">
        <div className="button-row">
          {primaryAction ? (
            <button
              className="primary-button"
              type="button"
              aria-label={primaryAction.ariaLabel}
              disabled={mutationLocked}
              onClick={runPrimaryAction}
            >
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              className="ghost-button"
              type="button"
              disabled={mutationLocked && secondaryAction.kind !== "open_profile"}
              onClick={() => runInspectorAction(secondaryAction.kind)}
            >
              {secondaryAction.label}
            </button>
          ) : null}
          {inspector.showActionsMenu ? (
            <div className="overview-actions-menu-wrap" data-overview-actions>
              <button
                ref={actionsMenuAnchorRef}
                className="ghost-button icon-button"
                type="button"
                aria-haspopup="menu"
                aria-expanded={actionsMenuOpen}
                aria-label="More profile actions"
                onClick={() => setActionsMenuOpen((open) => !open)}
              >
                <SFEllipsisCircle aria-hidden="true" focusable="false" size={16} />
              </button>
              {actionsMenuOpen ? (
                <AnchoredMenu
                  anchorRef={actionsMenuAnchorRef}
                  className="profile-row-actions-menu"
                  align="start"
                  boundaryAttribute="data-overview-actions"
                  containmentSelector=".overview-inspector-pane"
                  role="menu"
                  aria-label="Overview actions"
                >
                  {inspector.menuActions.map((action) => (
                    <button
                      key={action.kind}
                      className="ghost-button"
                      role="menuitem"
                      type="button"
                      disabled={
                        (action.kind === "open_profile"
                          ? false
                          : action.kind === "refresh"
                            ? refreshLocked
                            : mutationLocked)
                      }
                      onClick={() => {
                        setActionsMenuOpen(false);
                        runInspectorAction(action.kind);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </AnchoredMenu>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      ) : null}

      {inspector.hasProfiles && status.binary_found ? (
      <dl className="overview-inspector-facts">
        <div>
          <dt>Active profile</dt>
          <dd>{inspector.activeProfileLabel ?? "None"}</dd>
        </div>
        <div>
          <dt>Live state</dt>
          <dd>{inspector.healthText}</dd>
        </div>
        <div>
          <dt>Authentication</dt>
          <dd>{overviewAuthMethodLabel(status.auth_method)}</dd>
        </div>
        <div>
          <dt>Backend</dt>
          <dd>{overviewCredentialBackendLabel(status.credential_backend)}</dd>
        </div>
        <div>
          <dt>Last verified</dt>
          <dd>{toolVerificationLabel(status)}</dd>
        </div>
      </dl>
      ) : null}

      {inspector.hasProfiles && status.token_warning ? (
        <div className="overview-inline-notice overview-inline-notice-warn">
          <div className="overview-inline-notice-copy">
            <span className="overview-inline-notice-symbol" aria-hidden="true">▲</span>
            <p>{overviewTokenWarning(status)}</p>
          </div>
        </div>
      ) : null}

      {inspector.hasProfiles && status.warnings.length ? (
        <div className="overview-inline-notice overview-inline-notice-warn">
          <div className="overview-inline-notice-copy">
            <span className="overview-inline-notice-symbol" aria-hidden="true">▲</span>
            <p>{overviewDiagnosticWarning(status.warnings[0])}</p>
          </div>
        </div>
      ) : null}

      {inspector.hasProfiles && lastResult ? (
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

    </aside>
  );
}

const overviewCredentialBackendLabel = (backend: string | null | undefined) =>
  formatCredentialBackendLabel(backend, "overview");
