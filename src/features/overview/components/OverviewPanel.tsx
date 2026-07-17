import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { OverflowMenuButton } from "../../../components/OverflowMenuButton";
import { ToolBrand } from "../../../components/ToolBrand";
import { useCompactLayout } from "../../../components/useCompactLayout";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
import { credentialBackendLabel as formatCredentialBackendLabel } from "../../../lib/credential-backends";
import {
  installGuideUrlForTool,
  openExternalGuide,
} from "../../../lib/tool-guidance";
import type { CommandResultStatus } from "../../shared/command-result-shape";
import { COMMAND_RESULT_GLOBAL_IDS } from "../../shared/command-result-scope";
import {
  supportedStateModes,
  type EditableStateMode,
  type StateModeRequest,
} from "../../shared/state-modes";
import { useDesktopActions } from "../../shared/useDesktopActions";
import {
  activeSetLabel,
  contextDisplayLabel,
  toolProfileDisplayLabel,
} from "../../../lib/profile-display";
import { EXPECTED_SET_PREFIX } from "../../../lib/sets-display";
import { PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import { eventTargetWithinSelector } from "../../../lib/dom-events";
import { BACKEND_UNAVAILABLE_LABEL } from "../../../lib/display-copy";
import { invalidateSnapshotDesktopQueries } from "../../shared/postMutationRefresh";
import {
  buildOverviewInspectorNotices,
  buildOverviewStateSummary,
  buildOverviewInspectorPresentation,
  overviewAuthMethodLabel,
  OVERVIEW_CURRENT_SET_LABEL,
  OVERVIEW_EMPTY_SELECTION_COPY,
  OVERVIEW_PANEL_COPY,
  overviewInspectorActionDisabled,
  overviewInspectorEmptyHeading,
  overviewMissingBinaryMessage,
  overviewRecentSummary,
  OVERVIEW_MORE_ACTIONS_LABEL,
  overviewSelectProfileLabel,
  overviewSelectedStateMode,
  overviewSetButtonLabel,
  overviewStateModeLabel,
  overviewToolCountLabel,
  overviewToolInspectorLabel,
  overviewToolListProfileLabel,
  overviewStateModeCopy,
  overviewWorkspaceActionLabel,
  resolveOverviewSelectedProfile,
  resolveOverviewSelectedTool,
  resolveOverviewStateMode,
} from "../../../lib/overview-display";
import {
  buildOverviewToolHealthPresentation,
  overviewHealthPresentation,
  toolVerificationLabel,
  resolveOverviewHealthState,
  type OverviewHealthState,
} from "../../../lib/status-display";
import { toolDisplayName } from "../../../lib/tool-display";
import {
  DEFAULT_PROFILE_IMPORT_MODE,
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
    void invalidateSnapshotDesktopQueries(queryClient);
  };

  const workspaceStatus = parseWorkspaceStatus(snapshot.workspace_status ?? undefined);
  const hasWorkspaceMismatch =
    workspaceStatus.status === "mismatch" &&
    workspaceStatus.expectedContext !== workspaceStatus.currentContext;
  const expectedWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.expectedContext);
  const currentWorkspaceDisplay = contextDisplayLabel(settings, workspaceStatus.currentContext);
  const currentSetLabel = activeSetLabel(settings, snapshot);
  const currentSetDisplay = currentSetLabel ?? OVERVIEW_PANEL_COPY.currentSetFallback;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selectedTool, setSelectedTool] = useState(snapshot.statuses[0]?.tool ?? "");
  const compactLayout = useCompactLayout(rootRef, PANEL_COMPACT_BREAKPOINT);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const selectedStatus =
    snapshot.statuses.find((status) => status.tool === selectedTool) ?? snapshot.statuses[0] ?? null;
  const overviewStates = snapshot.statuses.map(resolveOverviewHealthState);
  const overviewSummary = useMemo(
    () => buildOverviewStateSummary(overviewStates),
    [overviewStates],
  );
  const overallState: OverviewHealthState = overviewSummary.overallState;
  const overallHealthPresentation = overviewHealthPresentation(
    overallState,
    overviewSummary.metaLabel,
  );
  const workspaceResult = lastCommandResults.global[COMMAND_RESULT_GLOBAL_IDS.workspace];
  const contextResult = lastCommandResults.global[COMMAND_RESULT_GLOBAL_IDS.context];
  const bulkResult =
    lastCommandResults.global[COMMAND_RESULT_GLOBAL_IDS.profileSet]
    ?? lastCommandResults.global[COMMAND_RESULT_GLOBAL_IDS.switchAll];

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
  const selectedToolName = selectedStatus
    ? toolDisplayName(selectedStatus.tool)
    : OVERVIEW_PANEL_COPY.selectedToolFallback;

  return (
    <div ref={rootRef} className="overview-screen screen-content">
      <div className={`overview-status-strip overview-status-strip-${overallState}`}>
        <div className="overview-status-summary">
          <span className={`overview-status-symbol overview-status-symbol-${overallState}`} aria-hidden="true">
            {overallHealthPresentation.symbol}
          </span>
          <strong>{overviewSummary.headline}</strong>
        </div>
        <p className="overview-status-meta">
          {hasWorkspaceMismatch ? `${EXPECTED_SET_PREFIX}${expectedWorkspaceDisplay}` : overviewSummary.metaLabel}
        </p>
      </div>

      <div className="overview-set-row">
        <div className="overview-set-row-main">
          <span className="overview-set-row-inline">
            <span className="overview-set-row-label">{OVERVIEW_CURRENT_SET_LABEL}</span>
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
            {overviewSetButtonLabel(Boolean(currentSetLabel))}
          </button>
        </div>
      </div>

      <div className="overview-master-detail">
        {showToolList ? (
        <section className="overview-pane overview-list-pane">
          <div className="overview-pane-header">
            <h3>{OVERVIEW_PANEL_COPY.toolsHeading}</h3>
            <p className="overview-pane-meta">{overviewToolCountLabel(snapshot.statuses.length)}</p>
          </div>
          {snapshot.statuses.length ? (
            <div
              className="overview-tool-list"
              role="list"
              aria-label={OVERVIEW_PANEL_COPY.toolsAriaLabel}
            >
              {snapshot.statuses.map((status) => {
                const healthPresentation = buildOverviewToolHealthPresentation(status);
                const state = healthPresentation.state;
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
                    aria-label={overviewToolInspectorLabel(status.tool)}
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
                        {healthPresentation.symbol}
                      </span>
                    </div>
                    <div className="overview-tool-list-cell overview-tool-list-cell-main">
                      <ToolBrand
                        tool={status.tool}
                        variant="inlineSection"
                      />
                    </div>
                    <span className="overview-tool-list-profile">{activeProfileLabel}</span>
                    <span className={`overview-tool-list-status overview-tool-list-status-${state}`}>
                      {healthPresentation.text}
                    </span>
                    <span className="overview-tool-list-chevron" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="overview-empty-state">
              <h3>{OVERVIEW_PANEL_COPY.noToolsHeading}</h3>
              <p className="inline-note">{OVERVIEW_PANEL_COPY.noToolsBody}</p>
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
                mode: preferredProfileImportMode(
                  tool,
                  toolCapabilities,
                  DEFAULT_PROFILE_IMPORT_MODE,
                ),
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
              <h3>{overviewInspectorEmptyHeading(compactLayout, selectedToolName)}</h3>
              <p className="inline-note">{OVERVIEW_EMPTY_SELECTION_COPY}</p>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="overview-footer-strip">
        <p>{recentSummary}</p>
        <button className="ghost-button" type="button" onClick={onOpenActivity}>
          {OVERVIEW_PANEL_COPY.footerActionLabel}
        </button>
      </div>
    </div>
  );
}

const OVERVIEW_ACTIONS_BOUNDARY_ATTRIBUTE = "data-overview-actions";

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
    status: CommandResultStatus;
    message: string;
    remediation?: string;
  };
  mutationLocked: boolean;
  refreshLocked: boolean;
  onRefresh: () => void;
  stateModes: EditableStateMode[];
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  compactLayout: boolean;
  onImport: (tool: string) => void;
  onUse: (tool: string, profile: string, stateMode: StateModeRequest) => void;
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
  const supportsLiveImport = supportsProfileImportMode(
    status.tool,
    toolCapabilities,
    DEFAULT_PROFILE_IMPORT_MODE,
  );
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
  const toolName = toolDisplayName(status.tool);
  const notices = buildOverviewInspectorNotices({
    activeProfileLabel: inspector.activeProfileLabel,
    hasProfiles: inspector.hasProfiles,
    lastResult,
    status,
    toolName,
  });
  const inspectorHealthPresentation = buildOverviewToolHealthPresentation(status);

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
      if (
        eventTargetWithinSelector(
          event.target,
          `[${OVERVIEW_ACTIONS_BOUNDARY_ATTRIBUTE}]`,
        )
      ) {
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
    onUse(
      status.tool,
      selectedProfile,
      overviewSelectedStateMode(stateModes, stateMode),
    );
  }

  function runInspectorAction(kind: ReturnType<typeof buildOverviewInspectorPresentation>["menuActions"][number]["kind"]) {
    switch (kind) {
      case "switch":
      case "reapply":
        if (!selectedProfile) {
          return;
        }
        onUse(
          status.tool,
          selectedProfile,
          overviewSelectedStateMode(stateModes, stateMode),
        );
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
              {OVERVIEW_PANEL_COPY.backLabel}
            </button>
          ) : null}
          <h3>
            <ToolBrand
              tool={status.tool}
              variant="headingProminent"
            />
          </h3>
          <p className="inline-note">{inspector.summaryLabel}</p>
        </div>
        <div className={`overview-inspector-status overview-inspector-status-${inspector.state}`}>
          <span className={`overview-status-symbol overview-status-symbol-${inspector.state}`} aria-hidden="true">
            {inspectorHealthPresentation.symbol}
          </span>
          <span>{inspector.statusLabel}</span>
        </div>
      </header>

      {notices.map((notice, index) => (
        <OverviewInlineNotice key={`${notice.symbol}-${index}`} notice={notice} />
      ))}

      {!status.binary_found ? (
        <div className="overview-missing-binary">
          <p className="inline-note">{overviewMissingBinaryMessage(toolName)}</p>
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={() => openExternalGuide(installGuideUrlForTool(status.tool))}>
              {OVERVIEW_PANEL_COPY.missingBinaryActionLabel}
            </button>
            <button className="ghost-button" type="button" disabled={refreshLocked} onClick={onRefresh}>
              {OVERVIEW_PANEL_COPY.missingBinaryRefreshLabel}
            </button>
          </div>
        </div>
      ) : null}

      {status.binary_found && !inspector.hasProfiles ? (
        <div className="overview-empty-state overview-empty-state-inline">
          <h3>{OVERVIEW_PANEL_COPY.noProfileHeading}</h3>
          <p className="inline-note">{OVERVIEW_PANEL_COPY.noProfileBody}</p>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => onAddProfile(status.tool)}>
              {OVERVIEW_PANEL_COPY.addProfileLabel}
            </button>
          </div>
        </div>
      ) : null}

      {inspector.hasProfiles ? (
        <label className="stacked-form overview-inspector-control">
          <span>{OVERVIEW_PANEL_COPY.activeProfileFieldLabel}</span>
          <select
            aria-label={overviewSelectProfileLabel(status.tool)}
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
          <span className="overview-inspector-control-label">
            {OVERVIEW_PANEL_COPY.stateModeFieldLabel}
          </span>
          <div
            className="overview-state-mode-control"
            role="group"
            aria-label={OVERVIEW_PANEL_COPY.stateModeAriaLabel}
          >
            {stateModes.map((mode) => (
              <button
                key={mode}
                className={`overview-state-mode-button ${stateMode === mode ? "overview-state-mode-button-active" : ""}`}
                type="button"
                aria-pressed={stateMode === mode}
                onClick={() => setStateMode(mode)}
              >
                {overviewStateModeLabel(mode)}
              </button>
            ))}
          </div>
          <p className="inline-note">
            {overviewStateModeCopy(stateModes, stateMode, status.tool)}
          </p>
        </div>
      ) : inspector.hasProfiles && status.binary_found ? (
        <div className="overview-inspector-control">
          <span className="overview-inspector-control-label">
            {OVERVIEW_PANEL_COPY.stateModeFieldLabel}
          </span>
          <strong className="overview-static-value">
            {OVERVIEW_PANEL_COPY.stateModeFixedValue}
          </strong>
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
            <OverflowMenuButton
              open={actionsMenuOpen}
              anchorRef={actionsMenuAnchorRef}
              variant="toolbar"
              containerClassName="overview-actions-menu-wrap"
              triggerAriaLabel={OVERVIEW_MORE_ACTIONS_LABEL}
              menuAriaLabel={OVERVIEW_PANEL_COPY.actionsMenuAriaLabel}
              boundaryAttribute={OVERVIEW_ACTIONS_BOUNDARY_ATTRIBUTE}
              containmentSelector=".overview-inspector-pane"
              items={inspector.menuActions.map((action) => ({
                key: action.kind,
                label: action.label,
                disabled: overviewInspectorActionDisabled(
                  action.kind,
                  mutationLocked,
                  refreshLocked,
                ),
                onSelect: () => {
                  setActionsMenuOpen(false);
                  runInspectorAction(action.kind);
                },
              }))}
              onToggle={() => setActionsMenuOpen((open) => !open)}
            />
          ) : null}
        </div>
      </div>
      ) : null}

      {inspector.hasProfiles && status.binary_found ? (
      <dl className="overview-inspector-facts">
        <div>
          <dt>{OVERVIEW_PANEL_COPY.facts.activeProfile}</dt>
          <dd>{inspector.activeProfileLabel ?? OVERVIEW_PANEL_COPY.noneLabel}</dd>
        </div>
        <div>
          <dt>{OVERVIEW_PANEL_COPY.facts.liveState}</dt>
          <dd>{inspector.healthText}</dd>
        </div>
        <div>
          <dt>{OVERVIEW_PANEL_COPY.facts.authentication}</dt>
          <dd>{overviewAuthMethodLabel(status.auth_method)}</dd>
        </div>
        <div>
          <dt>{OVERVIEW_PANEL_COPY.facts.backend}</dt>
          <dd>{overviewCredentialBackendLabel(status.credential_backend)}</dd>
        </div>
        <div>
          <dt>{OVERVIEW_PANEL_COPY.facts.lastVerified}</dt>
          <dd>{toolVerificationLabel(status)}</dd>
        </div>
      </dl>
      ) : null}

    </aside>
  );
}

function OverviewInlineNotice({
  notice,
}: {
  notice: ReturnType<typeof buildOverviewInspectorNotices>[number];
}) {
  return (
    <div className={`overview-inline-notice overview-inline-notice-${notice.tone}`}>
      <div className="overview-inline-notice-copy">
        <span className="overview-inline-notice-symbol" aria-hidden="true">
          {notice.symbol}
        </span>
        {notice.detail ? (
          <div className="overview-inline-notice-body">
            <p>{notice.summary}</p>
            <p>{notice.detail}</p>
          </div>
        ) : (
          <p>{notice.summary}</p>
        )}
      </div>
    </div>
  );
}

const overviewCredentialBackendLabel = (backend: string | null | undefined) =>
  formatCredentialBackendLabel(backend, "overview");
