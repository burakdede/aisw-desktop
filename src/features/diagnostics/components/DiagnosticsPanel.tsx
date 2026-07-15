import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { SplitView } from "../../../components/SplitView";
import { useCompactLayout } from "../../../components/useCompactLayout";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
import { exportDiagnosticBundle, runDoctor, runRepair, runVerify } from "../../../lib/client";
import { WIDE_PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import { openExternalGuide, installGuideUrlForTool } from "../../../lib/tool-guidance";
import { useLastCommandResults } from "../../shared/lastCommandResult";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../../shared/terminal-integration-language";
import {
  preferredProfileImportMode,
  supportsProfileImportMode,
  type ProfileImportMode,
} from "../../shared/profile-capabilities";
import {
  parseDoctorIssues,
  parseDoctorSummary,
  parseRepairActions,
  parseRepairSummary,
  parseVerifyIssues,
  parseVerifySummary,
  type IssueCardData,
  type SummaryCardData,
} from "../diagnostic-parsers";
import { parseWorkspaceStatus } from "../../workspaces/workspace-parsers";
import { resolveWorkspaceActivationTarget } from "../../workspaces/workspace-activation";
import { contextDisplayLabel, toolProfileDisplayLabel } from "../../../lib/profile-display";
import { toolDisplayName } from "../../../lib/tool-display";
import { isSupportedTool, toolSupportsEditableStateModes } from "../../../lib/tool-registry";
import { titleCase } from "../../../lib/utils";
import type { SettingsSection } from "../../settings/components/SettingsPanel";

export function DiagnosticsPanel({
  settings,
  snapshot,
  toolCapabilities,
  onOpenProfiles,
  onOpenSettings,
  onOpenContexts,
  onOpenProfileSetup,
}: {
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  onOpenProfiles: (tool: string, expandedProfile?: string | null) => void;
  onOpenSettings: (section?: SettingsSection) => void;
  onOpenContexts: () => void;
  onOpenProfileSetup: (options?: {
    tool?: string;
    mode?: ProfileImportMode;
    credentialBackend?: "file" | "system-keyring" | null;
  }) => void;
}) {
  const queryClient = useQueryClient();
  const {
    useProfileMutation,
    useContextMutation,
    activateProfileSetMutation,
    activateWorkspaceTargetMutation,
    mutationLock,
  } =
    useDesktopActions();
  const lastCommandResults = useLastCommandResults();
  const readEnabled = useMutationAwareQueryEnabled();
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor, enabled: readEnabled });
  const verify = useQuery({ queryKey: ["verify"], queryFn: runVerify, enabled: readEnabled });
  const repair = useQuery({
    queryKey: ["repair", "dry-run"],
    queryFn: () => runRepair({ apply: false, fixes: [] }),
    enabled: readEnabled,
  });
  const [bundleCopyMessage, setBundleCopyMessage] = useState("");
  const [selectedFindingKey, setSelectedFindingKey] = useState<string | null>(null);
  const [repairPlanOpen, setRepairPlanOpen] = useState(false);
  const [selectedSafeFixes, setSelectedSafeFixes] = useState<string[]>([]);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [inspectorMenuOpen, setInspectorMenuOpen] = useState(false);
  const toolbarMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const inspectorMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const compactLayout = useCompactLayout(rootRef, WIDE_PANEL_COMPACT_BREAKPOINT);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const applyRepair = useMutation({
    mutationFn: (fixes: string[]) => runRepair({ apply: true, fixes }),
    onSuccess: async () => {
      setRepairPlanOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["repair", "dry-run"] });
      await queryClient.invalidateQueries({ queryKey: ["doctor"] });
      await queryClient.invalidateQueries({ queryKey: ["verify"] });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
  const exportBundle = useMutation({
    mutationFn: exportDiagnosticBundle,
  });

  const summaryCards: SummaryCardData[] = [
    parseDoctorSummary(doctor.data),
    parseVerifySummary(verify.data),
    parseRepairSummary(repair.data),
  ];
  const issueCards: IssueCardData[] = [
    ...parseDoctorIssues(doctor.data),
    ...parseVerifyIssues(verify.data),
  ];
  const repairActions = parseRepairActions(repair.data);
  const recentFailures = buildRecentFailureCards(lastCommandResults, snapshot);
  const quickFixes = buildQuickFixes({
    snapshot,
    doctor: doctor.data,
    repair: repair.data,
    settings,
    toolCapabilities,
    useProfile: useProfileMutation.mutate,
    useContext: useContextMutation.mutate,
    activateProfileSet: activateProfileSetMutation.mutate,
    activateWorkspaceTarget: activateWorkspaceTargetMutation.mutate,
    applyRepairFixes: (fixes) => applyRepair.mutate(fixes),
    onOpenSettings,
    onOpenContexts,
    onOpenProfileSetup,
    onRefreshDiagnostics: () =>
      void refreshDiagnostics(queryClient, doctor.refetch, verify.refetch, repair.refetch),
  });
  const findings = useMemo(
    () => buildDiagnosticFindings(issueCards, recentFailures, quickFixes, snapshot),
    [issueCards, recentFailures, quickFixes, snapshot],
  );
  const totalIssues = issueCards.length + recentFailures.length;
  const checkRows = useMemo(
    () => buildDiagnosticCheckRows(summaryCards, snapshot),
    [snapshot, summaryCards],
  );
  useEffect(() => {
    if (selectedFindingKey && findings.some((finding) => finding.key === selectedFindingKey)) {
      return;
    }
    setSelectedFindingKey(findings[0]?.key ?? null);
  }, [findings, selectedFindingKey]);
  const selectedFinding =
    findings.find((finding) => finding.key === selectedFindingKey) ?? findings[0] ?? null;
  const findingGroups = useMemo(() => groupDiagnosticFindings(findings), [findings]);
  const passedChecks = useMemo(
    () => checkRows.filter((row) => row.status === "pass"),
    [checkRows],
  );
  const safeFixIds = useMemo(
    () => repairActions.map((action) => repairActionKey(action)),
    [repairActions],
  );
  const selectedFindingQuickFixes = useMemo(
    () => quickFixes.filter((fix) => matchesQuickFixToFinding(fix, selectedFinding)),
    [quickFixes, selectedFinding],
  );
  const primaryFindingFix =
    selectedFindingQuickFixes.find((fix) => fix.primary) ?? selectedFindingQuickFixes[0] ?? null;
  const secondaryFindingFixes = selectedFindingQuickFixes.filter((fix) => fix !== primaryFindingFix);
  const verifiedAt = Math.max(
    doctor.dataUpdatedAt || 0,
    verify.dataUpdatedAt || 0,
    repair.dataUpdatedAt || 0,
  );
  const verifiedLabel = formatRelativeVerifiedTime(verifiedAt);
  const summaryTitle = totalIssues
    ? `${totalIssues} issue${totalIssues === 1 ? "" : "s"} need attention`
    : "Everything looks good";
  const summaryDetail = totalIssues
    ? `${repairActions.length} ${repairActions.length === 1 ? "repair can" : "repairs can"} be applied safely. ${
        Math.max(totalIssues - repairActions.length, 0)
      } ${Math.max(totalIssues - repairActions.length, 0) === 1 ? "requires" : "require"} a decision.`
    : "All configured tools match their active AISW profiles and local storage checks passed.";
  const lastAppliedCount = Number(
    ((applyRepair.data?.result as {
      summary?: { actions_applied?: number };
    } | undefined)?.summary?.actions_applied ?? 0),
  );
  const exportedBundle = exportBundle.data;
  const diagnosticsStatusMessage = bundleCopyMessage
    || (exportedBundle ? `Support report ready: ${exportedBundle.filename}. ${exportedBundle.path}` : "")
    || (exportBundle.error
      ? exportBundle.error instanceof Error
        ? exportBundle.error.message
        : "Support report export failed."
      : "")
    || (applyRepair.data
      ? `Applied ${lastAppliedCount} ${lastAppliedCount === 1 ? "safe fix" : "safe fixes"}.`
      : "");

  useEffect(() => {
    setSelectedSafeFixes(safeFixIds);
  }, [safeFixIds.join("|")]);

  const importCurrentAction =
    primaryFindingFix?.importTarget
      ? {
          key: `import-${quickFixKey(primaryFindingFix)}`,
          label: supportsProfileImportMode(primaryFindingFix.importTarget.tool, toolCapabilities, "from_live")
            ? "Import Current…"
            : "Open Account Setup",
          action: () =>
            onOpenProfileSetup({
              tool: primaryFindingFix.importTarget?.tool,
              mode:
                primaryFindingFix.importFallbackMode ??
                preferredProfileImportMode(primaryFindingFix.importTarget!.tool, toolCapabilities, "from_live"),
            }),
        }
      : null;
  const secondaryInspectorAction =
    (primaryFindingFix?.secondaryAction
      ? {
          key: `secondary-${quickFixKey(primaryFindingFix)}`,
          label: primaryFindingFix.secondaryAction.label,
          action: () => void primaryFindingFix.secondaryAction?.action(),
        }
      : null) ??
    (secondaryFindingFixes[0]
      ? {
          key: `fix-${quickFixKey(secondaryFindingFixes[0])}`,
          label: secondaryFindingFixes[0].label,
          action: secondaryFindingFixes[0].action,
        }
      : null) ??
    (selectedFinding?.profileTarget
      ? {
          key: `profile-${selectedFinding.key}`,
          label: "Open Profile Details",
          action: () => onOpenProfiles(selectedFinding.profileTarget!.tool, selectedFinding.profileTarget!.profile),
        }
      : null) ??
    importCurrentAction;
  const inspectorOverflowActions = [
    ...(importCurrentAction && secondaryInspectorAction?.key !== importCurrentAction.key ? [importCurrentAction] : []),
    ...(primaryFindingFix?.secondaryAction && secondaryInspectorAction?.key !== `secondary-${quickFixKey(primaryFindingFix)}`
      ? [
          {
            key: `secondary-${quickFixKey(primaryFindingFix)}`,
            label: primaryFindingFix.secondaryAction.label,
            action: () => void primaryFindingFix.secondaryAction?.action(),
          },
        ]
      : []),
    ...secondaryFindingFixes.slice(secondaryInspectorAction?.key?.startsWith("fix-") ? 1 : 0).map((fix) => ({
      key: `fix-${quickFixKey(fix)}`,
      label: fix.label,
      action: fix.action,
    })),
    ...(selectedFinding?.profileTarget && secondaryInspectorAction?.key !== `profile-${selectedFinding.key}`
      ? [
          {
            key: `profile-${selectedFinding.key}`,
            label: "Open Profile Details",
            action: () => onOpenProfiles(selectedFinding.profileTarget!.tool, selectedFinding.profileTarget!.profile),
          },
        ]
      : []),
  ];

  useEffect(() => {
    setInspectorMenuOpen(false);
  }, [selectedFindingKey]);

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  const showFindings = !compactLayout || !compactInspectorOpen;
  const showInspector = !compactLayout || compactInspectorOpen;

  return (
    <div ref={rootRef} className="diagnostics-screen screen-content">
      <div className="diagnostics-toolbar-row">
        <div className="button-row">
          <button
            className="primary-button"
            aria-label="Verify Again"
            disabled={mutationLock.isBusy}
            onClick={() =>
              void refreshDiagnostics(queryClient, doctor.refetch, verify.refetch, repair.refetch)
            }
          >
            Verify
          </button>
          <button
            className="ghost-button"
            aria-label="Review Safe Fixes"
            onClick={() => setRepairPlanOpen(true)}
            disabled={applyRepair.isPending || !repairActions.length}
          >
            {applyRepair.isPending ? "Applying Repairs…" : "Review Safe Fixes…"}
          </button>
          <div className="diagnostics-toolbar-menu-wrap">
            <button
              ref={toolbarMenuAnchorRef}
              className="ghost-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={toolbarMenuOpen}
              aria-label="Diagnostics more actions"
              onClick={() => setToolbarMenuOpen((open) => !open)}
            >
              •••
            </button>
            {toolbarMenuOpen ? (
              <AnchoredMenu
                anchorRef={toolbarMenuAnchorRef}
                className="profile-row-actions-menu"
                role="menu"
                aria-label="Diagnostics actions"
              >
                <button
                  className="ghost-button"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setToolbarMenuOpen(false);
                    exportBundle.mutate();
                  }}
                  disabled={exportBundle.isPending}
                >
                  {exportBundle.isPending ? "Exporting Report…" : "Export Report"}
                </button>
              </AnchoredMenu>
            ) : null}
          </div>
        </div>
      </div>

      <section className={`diagnostics-summary-strip ${totalIssues ? "diagnostics-summary-strip-warn" : "diagnostics-summary-strip-ok"}`}>
        <div className="diagnostics-summary-copy">
          <div className="diagnostics-summary-headline">
            <span className="diagnostics-summary-symbol" aria-hidden="true">
              {totalIssues ? "▲" : "✓"}
            </span>
            <strong>{summaryTitle}</strong>
          </div>
          <p className="inline-note">{summaryDetail}</p>
        </div>
        <div className="diagnostics-summary-meta">
          <span className="overview-current-set-cell-label">Verified</span>
          <strong>{verifiedLabel}</strong>
        </div>
      </section>

      <SplitView
        className="diagnostics-master-detail"
        primaryClassName="diagnostics-findings-pane"
        secondaryClassName="diagnostics-inspector-pane"
        primary={showFindings ? (
          <section className="diagnostics-pane">
            {findings.length ? (
              <div className="diagnostics-findings-list" aria-label="Diagnostics findings">
                {findingGroups.map((group) => (
                  group.items.length ? (
                    <section key={group.id} className="diagnostics-finding-group">
                      <div className="diagnostics-finding-group-header">
                        <p className="card-kicker">{group.label}</p>
                        <span className="diagnostics-group-count">{group.items.length}</span>
                      </div>
                      <div className="stack-list">
                        {group.items.map((finding) => (
                          <button
                            key={finding.key}
                            type="button"
                            aria-label={`Inspect ${finding.title}`}
                            aria-pressed={selectedFinding?.key === finding.key}
                            className={`list-row diagnostic-finding-row ${
                              selectedFinding?.key === finding.key ? "diagnostic-finding-row-selected" : ""
                            }`}
                            onClick={() => {
                              setSelectedFindingKey(finding.key);
                              if (compactLayout) {
                                setCompactInspectorOpen(true);
                              }
                            }}
                          >
                            <div className="diagnostic-finding-main">
                              <div className="diagnostic-finding-title">
                                <span className={`diagnostic-finding-symbol diagnostic-finding-symbol-${finding.status}`} aria-hidden="true">
                                  {finding.status === "fail" ? "⨯" : "▲"}
                                </span>
                                <strong>{finding.title}</strong>
                              </div>
                              <p className="inline-note">{finding.preview}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null
                ))}
                {passedChecks.length ? (
                  <details className="diagnostics-passed-section">
                    <summary>{passedChecks.length} checks passed</summary>
                    <div className="stack-list">
                      {passedChecks.map((row) => (
                        <div key={row.label} className="diagnostics-passed-row">
                          <strong>{row.label}</strong>
                          <p className="inline-note">{row.detail}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <div className="diagnostics-healthy-state">
                <span aria-hidden="true">✓</span>
                <h3>Everything looks good</h3>
                <p className="inline-note">
                  All configured tools match their active AISW profiles and local storage checks passed.
                </p>
                <p className="inline-note">Verified {verifiedLabel.toLowerCase()}</p>
                <div className="button-row">
                  <button
                    className="ghost-button"
                    aria-label="Verify Again"
                    disabled={mutationLock.isBusy}
                    onClick={() =>
                      void refreshDiagnostics(queryClient, doctor.refetch, verify.refetch, repair.refetch)
                    }
                  >
                    Verify Again
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}
        secondary={showInspector ? (
          <aside className="diagnostics-pane diagnostics-inspector-surface">
            {selectedFinding ? (
              <>
                <header className="diagnostics-pane-header diagnostics-inspector-header">
                  <div>
                    {compactLayout ? (
                      <button
                        className="ghost-button diagnostics-inspector-back"
                        type="button"
                        onClick={() => setCompactInspectorOpen(false)}
                      >
                        Back
                      </button>
                    ) : null}
                    <h3>{selectedFinding.title}</h3>
                    <p className={`diagnostics-inspector-status diagnostics-inspector-status-${selectedFinding.status}`}>
                      <span aria-hidden="true">{selectedFinding.status === "fail" ? "⨯" : "▲"}</span>
                      <span>{selectedFinding.status === "fail" ? "Blocked" : "Needs attention"}</span>
                    </p>
                  </div>
                </header>
                <section className="diagnostics-inspector-section">
                  <p className="card-kicker">What happened</p>
                  <p className="inline-note">{normalizeRuntimeLanguage(selectedFinding.preview)}</p>
                  {selectedFinding.lines.slice(1, 2).map((line) => (
                    <p key={line} className="inline-note">{normalizeRuntimeLanguage(line)}</p>
                  ))}
                </section>
                <section className="diagnostics-inspector-section">
                  <p className="card-kicker">Impact</p>
                  <p className="inline-note">{impactTextForFinding(selectedFinding)}</p>
                </section>
                <section className="diagnostics-inspector-section">
                  <p className="card-kicker">Recommended action</p>
                  <p className="inline-note">
                    {primaryFindingFix?.detail ??
                      selectedFinding.remediation[0] ??
                      "Review the evidence below and decide how you want to correct this state."}
                  </p>
                </section>
                {primaryFindingFix || secondaryInspectorAction || inspectorOverflowActions.length ? (
                  <div className="button-row diagnostics-inspector-actions">
                    {primaryFindingFix ? (
                      <button
                        className={primaryFindingFix.primary ? "primary-button" : "ghost-button"}
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={primaryFindingFix.action}
                      >
                        {primaryFindingFix.label}
                      </button>
                    ) : null}
                    {secondaryInspectorAction ? (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() => void secondaryInspectorAction.action()}
                      >
                        {secondaryInspectorAction.label}
                      </button>
                    ) : null}
                    {inspectorOverflowActions.length ? (
                      <div className="profile-row-actions" data-profile-row-actions>
                        <button
                          ref={inspectorMenuAnchorRef}
                          className="ghost-button profile-row-actions-trigger profile-row-actions-trigger-visible"
                          type="button"
                          aria-label="More finding actions"
                          aria-expanded={inspectorMenuOpen}
                          onClick={() => setInspectorMenuOpen((open) => !open)}
                        >
                          •••
                        </button>
                        {inspectorMenuOpen ? (
                          <AnchoredMenu
                            anchorRef={inspectorMenuAnchorRef}
                            className="profile-row-actions-menu"
                            align="start"
                            boundaryAttribute="data-profile-row-actions"
                            containmentSelector=".diagnostics-inspector-surface"
                            role="menu"
                            aria-label="Finding actions"
                          >
                            {inspectorOverflowActions.map((action) => (
                              <button
                                key={action.key}
                                type="button"
                                role="menuitem"
                                disabled={mutationLock.isBusy}
                                onClick={() => {
                                  setInspectorMenuOpen(false);
                                  void action.action();
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
                ) : null}
                <details className="diagnostics-disclosure">
                  <summary>Evidence</summary>
                  <div className="stack-list">
                    {selectedFinding.lines.map((line) => (
                      <p key={line} className="inline-note">{normalizeRuntimeLanguage(line)}</p>
                    ))}
                  </div>
                </details>
                <details className="diagnostics-disclosure">
                  <summary>Technical Details</summary>
                  <div className="stack-list">
                    <p className="inline-note">Suggested commands for validation and recovery.</p>
                    <pre className="diagnostics-command-block">
{`aisw doctor --json
aisw verify --json
${primaryFindingFix?.label ? `# ${primaryFindingFix.label}` : "# Review the explicit action above"}`}
                    </pre>
                    {selectedFinding.remediation.length ? (
                      <div className="stack-list">
                        {selectedFinding.remediation.map((item) => (
                          <code key={item}>{item}</code>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              </>
            ) : (
              <div className="diagnostics-healthy-state diagnostics-healthy-state-compact">
                <span aria-hidden="true">✓</span>
                <h3>Everything looks good</h3>
                <p className="inline-note">
                  Active profiles, local storage, and repair checks are currently passing.
                </p>
              </div>
            )}
          </aside>
        ) : null}
      />
      {repairPlanOpen ? (
        <DialogSurface
          ariaLabel="Review Safe Fixes"
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setRepairPlanOpen(false)}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Repair plan</p>
                <h3>Review Safe Fixes</h3>
                <p className="inline-note">
                  {repairActions.length} {repairActions.length === 1 ? "repair can" : "repairs can"} be applied without changing account identity.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setRepairPlanOpen(false)}>
                Close
              </button>
            </div>
            {repairActions.length ? (
              <div className="stack-list">
                {repairActions.map((action) => (
                  <label key={`sheet-${action.title}-${action.detail}`} className="diagnostics-safe-fix-row">
                    <input
                      type="checkbox"
                      checked={selectedSafeFixes.includes(repairActionKey(action))}
                      onChange={(event) =>
                        setSelectedSafeFixes((current) =>
                          event.target.checked
                            ? [...current, repairActionKey(action)]
                            : current.filter((item) => item !== repairActionKey(action)),
                        )
                      }
                    />
                    <div>
                      <strong>{action.title}</strong>
                      <p className="inline-note">{action.detail}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="diagnostics-sheet-empty">
                <h3>No safe repairs queued</h3>
                <p className="inline-note">
                  Diagnostics did not find any safe automatic repairs to apply right now.
                </p>
              </div>
            )}
            <footer className="quick-switch-footer">
              <div className="quick-switch-selection">
                <p className="card-kicker">Repairs</p>
                <strong>{selectedSafeFixes.length} selected</strong>
                <p>Profile re-apply, restore, and removal actions still require their own explicit flow.</p>
              </div>
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => setRepairPlanOpen(false)}>
                  Cancel
                </button>
                <button
                  className="primary-button"
                  aria-label="Apply Safe Fixes"
                  type="button"
                  disabled={!selectedSafeFixes.length || applyRepair.isPending}
                  onClick={() =>
                    applyRepair.mutate(
                      selectedSafeFixes
                        .map((id) =>
                          repairActions.find((action) => repairActionKey(action) === id),
                        )
                        .filter((action): action is NonNullable<typeof action> => Boolean(action))
                        .map((action) => repairFixFromAction(action)),
                    )
                  }
                >
                  {applyRepair.isPending
                    ? "Applying Repairs…"
                    : `Apply ${selectedSafeFixes.length} ${selectedSafeFixes.length === 1 ? "Fix" : "Fixes"}`}
                </button>
              </div>
            </footer>
        </DialogSurface>
      ) : null}
      {diagnosticsStatusMessage ? (
        <div className="diagnostics-footer-line">
          <p className={`inline-note ${exportBundle.error ? "diagnostics-footer-line-error" : ""}`}>
            {diagnosticsStatusMessage}
          </p>
          {exportedBundle ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => void copyBundlePath(exportedBundle.path, setBundleCopyMessage)}
            >
              Copy report path
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type DiagnosticCheckRow = {
  label: string;
  detail: string;
  status: "pass" | "warn" | "fail";
};

type QuickFixCard = {
  title: string;
  detail: string;
  label: string;
  status: "warn" | "fail";
  profileTarget?: { tool: string; profile: string | null };
  importTarget?: { tool: string; stateMode: string | null };
  importFallbackMode?: ProfileImportMode;
  primary?: boolean;
  disabled?: boolean;
  secondaryAction?: {
    label: string;
    action: () => void | Promise<void>;
  };
  action: () => void;
};

type DiagnosticFinding = {
  key: string;
  title: string;
  preview: string;
  lines: string[];
  remediation: string[];
  status: "warn" | "fail";
  scopeLabel: string;
  countLabel: string;
  profileTarget?: { tool: string; profile: string | null };
};

function buildDiagnosticFindings(
  issueCards: IssueCardData[],
  recentFailures: ReturnType<typeof buildRecentFailureCards>,
  quickFixes: QuickFixCard[],
  snapshot: AppSnapshot | undefined,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = issueCards.map((card) => ({
    key: `issue-${card.title}-${card.status}`,
    title: formatFindingTitle(card, snapshot),
    preview: normalizeRuntimeLanguage(card.issues[0] ?? "Review diagnostic details."),
    lines: card.issues,
    remediation: card.remediation,
    status: card.status === "fail" ? "fail" : "warn",
    scopeLabel: "Check",
    countLabel: `${card.issues.length} detail${card.issues.length === 1 ? "" : "s"}`,
    profileTarget: snapshot ? resolveIssueProfileTarget(card, snapshot) ?? undefined : undefined,
  }));

  recentFailures.forEach((failure) => {
    findings.push({
      key: `failure-${failure.key}`,
      title: failure.title,
      preview: normalizeRuntimeLanguage(failure.message),
      lines: [failure.message],
      remediation: failure.remediation ? [failure.remediation] : [],
      status: "fail",
      scopeLabel: "Recent failure",
      countLabel: "History",
      profileTarget: failure.profileTarget,
    });
  });

  quickFixes.forEach((fix) => {
    const duplicate = findings.some((finding) => matchesQuickFixToFinding(fix, finding));
    if (duplicate) {
      return;
    }

    findings.push({
      key: `quick-fix-${quickFixKey(fix)}`,
      title: fix.title,
      preview: normalizeRuntimeLanguage(fix.detail),
      lines: [normalizeRuntimeLanguage(fix.detail)],
      remediation: [fix.label],
      status: fix.status,
      scopeLabel: "Suggested fix",
      countLabel: "Action",
      profileTarget: fix.profileTarget,
    });
  });

  return findings;
}

function formatFindingTitle(card: IssueCardData, snapshot: AppSnapshot | undefined) {
  const tool = resolveDiagnosticTool(card.title);
  if (tool) {
    const status = snapshot?.statuses.find((entry) => entry.tool === tool);
    if (status && status.binary_found === false) {
      return `${tool} is missing`;
    }
    if (status?.active_profile_applied === false || card.remediation.some((item) => item.toLowerCase().includes("re-apply"))) {
      return `${tool} live mismatch`;
    }
  }

  const normalized = card.title.trim().toLowerCase();
  if (normalized.includes("permission")) {
    return "Permissions incorrect";
  }
  if (normalized.includes("keyring")) {
    return "Keyring unavailable";
  }
  if (normalized.includes("oauth")) {
    return "OAuth failure";
  }
  if (normalized.includes("shell")) {
    return "Shell hook not installed";
  }

  return card.title;
}

function buildDiagnosticCheckRows(
  summaryCards: SummaryCardData[],
  snapshot: AppSnapshot | undefined,
): DiagnosticCheckRow[] {
  const rows: DiagnosticCheckRow[] = summaryCards.map((card) => ({
    label: card.title,
    detail: card.lines.join(" · "),
    status:
      card.status === "fail" ? "fail" : card.status === "warn" ? "warn" : "pass",
  }));

  snapshot?.statuses.forEach((status) => {
    if (!status.binary_found) {
      rows.push({
        label: `${toolDisplayName(status.tool)} availability`,
        detail: `${toolDisplayName(status.tool)} is not installed on this computer yet.`,
        status: "warn",
      });
      return;
    }

    if (status.active_profile_applied === false) {
      rows.push({
        label: `${toolDisplayName(status.tool)} live match`,
        detail: `${toolDisplayName(status.tool)} no longer matches the active saved profile.`,
        status: "warn",
      });
      return;
    }

    rows.push({
      label: `${toolDisplayName(status.tool)} status`,
      detail: status.active_profile
        ? `${toolStatusDisplayLabel(status)} is ready.`
        : `${toolDisplayName(status.tool)} is installed, but no saved profile is configured yet.`,
      status: status.active_profile ? "pass" : "warn",
    });
  });

  return rows;
}

function toolStatusDisplayLabel(status: ToolStatus) {
  return `${toolDisplayName(status.tool)}${status.active_profile ? ` is using ${status.active_profile}` : ""}`;
}

function buildQuickFixes(
  {
    snapshot,
    doctor,
    repair,
    settings,
    toolCapabilities,
    useProfile,
    useContext,
    activateProfileSet,
    activateWorkspaceTarget,
    applyRepairFixes,
    onOpenSettings,
    onOpenContexts,
    onOpenProfileSetup,
    onRefreshDiagnostics,
  }: {
    snapshot: AppSnapshot | undefined;
    doctor: Record<string, unknown> | undefined;
    repair: Record<string, unknown> | undefined;
    settings: DesktopSettings;
    toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
    useProfile: (request: {
      tool: string;
      profile: string;
      stateMode: string | null;
      label?: string;
    }) => void;
    useContext: (request: { context: string; stateMode: string | null }) => void;
    activateProfileSet: (request: { name: string }) => void;
    activateWorkspaceTarget: (request: {
      kind: "profile_set";
      name: string;
      matchedTarget: string;
    } | {
      kind: "context";
      name: string;
      matchedTarget: string;
      stateMode: string | null;
    }) => void;
    applyRepairFixes: (fixes: string[]) => void;
    onOpenSettings: (section?: SettingsSection) => void;
    onOpenContexts: () => void;
    onOpenProfileSetup: (options?: {
      tool?: string;
      mode?: ProfileImportMode;
      credentialBackend?: "file" | "system-keyring" | null;
    }) => void;
    onRefreshDiagnostics: () => void;
  },
): QuickFixCard[] {
  const fixes: QuickFixCard[] = [];
  const repairFixMap = buildRepairFixMap(repair);

  for (const issue of repairableDoctorIssues(doctor, repairFixMap)) {
    fixes.push({
      title: issue.title,
      detail: issue.detail,
      label: issue.label,
      status: issue.status,
      primary: issue.primary,
      action: () => applyRepairFixes([issue.fix]),
    });
  }

  const shellHookIssue = shellHookDoctorIssue(doctor);
  if (shellHookIssue) {
    fixes.push({
      title: "Terminal integration not active",
      detail: shellHookIssue.detail,
      label: "Open terminal setup",
      status: shellHookIssue.status,
      action: () => onOpenSettings("shell"),
    });
  }

  const keyringIssue = keyringDoctorIssue(doctor);
  if (keyringIssue) {
    fixes.push({
      title: "Use file-backed storage",
      detail: "Open account setup with file-backed credential storage preselected for the next import or add flow.",
      label: "Use file-backed storage",
      status: keyringIssue.status,
      action: () =>
        onOpenProfileSetup({
          mode: "from_live",
          credentialBackend: "file",
        }),
    });
    fixes.push({
      title: "Keyring setup instructions",
      detail: "Review the supported local keyring services for macOS, Windows, and Linux.",
      label: "Show keyring setup",
      status: keyringIssue.status,
      action: () => onOpenSettings("keyring"),
    });
  }

  if (!snapshot) {
    return fixes;
  }

  snapshot.statuses.forEach((status) => {
    if (!status.binary_found) {
      fixes.push({
        title: `${status.tool} is missing`,
        detail: `Open the install guide for ${status.tool} and then refresh diagnostics.`,
        label: "Open installation guide",
        status: "warn",
        action: () => openExternalGuide(installGuideUrlForTool(status.tool)),
        secondaryAction: {
          label: "Refresh diagnostics",
          action: onRefreshDiagnostics,
        },
      });
    }

    if (status.active_profile && status.active_profile_applied === false) {
      const profileLabel = toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile);
      fixes.push({
        title: `${status.tool} live mismatch`,
        detail: `Re-apply ${profileLabel} so the live credentials match the saved profile again.`,
        label: `Re-apply ${profileLabel}`,
        status: "fail",
        profileTarget: {
          tool: status.tool,
          profile: status.active_profile,
        },
        importTarget: {
          tool: status.tool,
          stateMode: resolveStateMode(status),
        },
        importFallbackMode: preferredProfileImportMode(
          status.tool,
          toolCapabilities,
          "from_live",
        ),
        primary: true,
        action: () =>
          useProfile({
            tool: status.tool,
            profile: status.active_profile!,
            stateMode: resolveStateMode(status),
            label: profileLabel,
          }),
      });
    }
  });

  const workspace = parseWorkspaceStatus(snapshot.workspace_status ?? undefined);
  const hasWorkspaceMismatch =
    workspace.status === "mismatch" &&
    workspace.expectedContext !== "none" &&
    workspace.expectedContext !== workspace.currentContext;

  if (hasWorkspaceMismatch) {
    const expectedContextLabel = contextDisplayLabel(settings, workspace.expectedContext);
    const currentContextLabel = contextDisplayLabel(settings, workspace.currentContext);
    const target = resolveWorkspaceActivationTarget(workspace.expectedContext, settings, snapshot);
    fixes.push({
      title: "Project set mismatch",
      detail: target
        ? `This folder wants ${expectedContextLabel}, but ${currentContextLabel} is currently active.`
        : `This folder wants ${expectedContextLabel}, but no matching detected set or ready saved set is currently available.`,
      label: target ? "Use expected set now" : "Open Sets",
      status: "warn",
      primary: true,
      action: () =>
        target
          ? activateWorkspaceTarget({
              ...target,
              matchedTarget: workspace.target,
            })
          : onOpenContexts(),
    });
  }

  return fixes;
}

function buildRepairFixMap(repair: Record<string, unknown> | undefined) {
  const result = asObject(repair?.result);
  return asArray(result?.actions)
    .map((action) => asObject(action))
    .filter((action): action is Record<string, unknown> => Boolean(action))
    .reduce((map, action) => {
      const fix = asStringValue(action.fix);
      if (fix) {
        map.set(fix.toLowerCase(), fix);
      }
      return map;
    }, new Map<string, string>());
}

function repairableDoctorIssues(
  doctor: Record<string, unknown> | undefined,
  repairFixMap: Map<string, string>,
): Array<{
  title: string;
  detail: string;
  label: string;
  fix: string;
  status: "warn" | "fail";
  primary?: boolean;
}> {
  return asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check))
    .flatMap((check) => {
      const name = asStringValue(check.name)?.toLowerCase() ?? "";
      const detail = asStringValue(check.detail) ?? "AI Switch reported an issue.";
      const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";

      if (name.includes("keyring")) {
        return [doctorRepairFixCard(
          "Keyring unavailable",
          detail,
          "Apply keyring repair",
          status,
          repairFixMap.get("keyring") ?? "keyring",
        )];
      }
      if (name.includes("permission")) {
        return [doctorRepairFixCard(
          "Permission issue",
          detail,
          "Repair permissions",
          status,
          repairFixMap.get("permissions") ?? "permissions",
        )];
      }
      if (name.includes("oauth")) {
        return [doctorRepairFixCard(
          "OAuth failure",
          detail,
          "Retry OAuth repair",
          status,
          repairFixMap.get("oauth") ?? "oauth",
        )];
      }
      return [];
    });
}

function doctorRepairFixCard(
  title: string,
  detail: string,
  label: string,
  status: "warn" | "fail",
  fix: string,
) {
  return {
    title,
    detail,
    label,
    status,
    fix,
    primary: true,
  };
}

function shellHookDoctorIssue(doctor: Record<string, unknown> | undefined) {
  const checks = asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check));

  for (const check of checks) {
    const name = asStringValue(check.name)?.toLowerCase() ?? "";
    const detail = normalizeTerminalIntegrationText(
      asStringValue(check.detail) ?? "Terminal integration guidance needs attention.",
    );
    const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";
    const detailText = detail.toLowerCase();
    if (
      (name.includes("shell") && name.includes("hook")) ||
      detailText.includes("shell hook") || detailText.includes("terminal integration")
    ) {
      return { detail, status };
    }
  }

  return null;
}

function keyringDoctorIssue(doctor: Record<string, unknown> | undefined) {
  const checks = asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check));

  for (const check of checks) {
    const name = asStringValue(check.name)?.toLowerCase() ?? "";
    const detail = asStringValue(check.detail) ?? "Keyring access needs attention.";
    const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";
    const detailText = detail.toLowerCase();
    if (name.includes("keyring") || detailText.includes("keyring")) {
      return { detail, status };
    }
  }

  return null;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function resolveStateMode(status: ToolStatus) {
  if (!toolSupportsEditableStateModes(status.tool)) {
    return null;
  }
  return status.state_mode ?? "isolated";
}

function resolveIssueProfileTarget(card: IssueCardData, snapshot: AppSnapshot) {
  const tool = resolveDiagnosticTool(card.title);
  if (!tool) {
    return null;
  }

  const status = snapshot.statuses.find((entry) => entry.tool === tool);
  const activeProfile = status?.active_profile ?? snapshot.profiles[tool]?.active ?? null;
  return {
    tool,
    profile: activeProfile,
  };
}

function resolveDiagnosticTool(title: string) {
  const normalized = title.trim().toLowerCase();
  const candidate = normalized.startsWith("tool/") ? normalized.slice("tool/".length) : normalized;
  return isSupportedTool(candidate) ? candidate : null;
}

function buildRecentFailureCards(
  lastCommandResults: ReturnType<typeof useLastCommandResults>,
  snapshot: AppSnapshot | undefined,
) {
  const failures: Array<{
    key: string;
    title: string;
    message: string;
    kind?: string;
    remediation?: string;
    at: number;
    profileTarget?: { tool: string; profile: string | null };
  }> = [];

  for (const [tool, result] of Object.entries(lastCommandResults.tool)) {
    if (!result || result.status !== "error") {
      continue;
    }
    const activeProfile =
      snapshot?.statuses.find((entry) => entry.tool === tool)?.active_profile ??
      snapshot?.profiles[tool]?.active ??
      null;
    failures.push({
      key: `tool:${tool}`,
      title: recentFailureTitle({
        kind: result.kind,
        scope: "tool",
        tool,
        label: result.label,
      }),
      message: result.message,
      kind: result.kind,
      remediation: result.remediation,
      at: result.at,
      profileTarget: { tool, profile: activeProfile },
    });
  }

  for (const [id, result] of Object.entries(lastCommandResults.global)) {
    if (!result || result.status !== "error") {
      continue;
    }
    failures.push({
      key: `global:${id}`,
      title: recentFailureTitle({
        kind: result.kind,
        scope: "global",
        id,
        label: result.label,
      }),
      message: result.message,
      kind: result.kind,
      remediation: result.remediation,
      at: result.at,
    });
  }

  return failures.sort((left, right) => right.at - left.at);
}

function recentFailureTitle(input: {
  kind?: string;
  scope: "tool" | "global";
  tool?: string;
  id?: string;
  label: string;
}) {
  switch (input.kind) {
    case "ToolMissing":
      return `${titleCase(input.tool ?? "Tool")} CLI missing`;
    case "ProfileMissing":
      return `${titleCase(input.tool ?? "Profile")} profile missing`;
    case "KeyringUnavailable":
      return `${titleCase(input.tool ?? "Credential")} keyring unavailable`;
    case "PermissionDenied":
      return "Permission issue";
    case "OAuthTimeout":
      return "OAuth timeout";
    case "ConfigLockTimeout":
      return "Config lock timeout";
    case "NonInteractiveMode":
      return "Non-interactive mode failure";
    case "InvalidStateMode":
      return input.tool === "gemini" ? "Gemini shared-mode failure" : "Unsupported state mode";
    default:
      if (input.scope === "global" && input.id === "backup") {
        return "Backup restore needs attention";
      }
      return input.tool ? `${titleCase(input.tool)} · ${input.label}` : input.label;
  }
}

function quickFixKey(fix: QuickFixCard) {
  return `${fix.title}:${fix.label}`;
}

function matchesQuickFixToFinding(fix: QuickFixCard, finding: DiagnosticFinding | null) {
  if (!finding) {
    return false;
  }
  const findingTitle = finding.title.trim().toLowerCase();
  const fixTitle = fix.title.trim().toLowerCase();

  if (findingTitle === fixTitle) {
    return true;
  }

  if (finding.profileTarget?.tool && fix.profileTarget?.tool === finding.profileTarget.tool) {
    if (findingTitle.includes("live mismatch") && fixTitle.includes("live mismatch")) {
      return true;
    }
    if (findingTitle.includes("profile missing") && fixTitle.includes(finding.profileTarget.tool)) {
      return true;
    }
  }

  if (findingTitle.includes("permission") && fixTitle.includes("permission")) {
    return true;
  }
  if (findingTitle.includes("keyring") && (fixTitle.includes("keyring") || fixTitle.includes("file-backed storage"))) {
    return true;
  }
  if (findingTitle.includes("oauth") && fixTitle.includes("oauth")) {
    return true;
  }
  if (findingTitle.includes("shell") && fixTitle.includes("terminal integration")) {
    return true;
  }
  if (findingTitle.includes("project") && fixTitle.includes("project")) {
    return true;
  }
  if (findingTitle.includes("missing") && fixTitle.includes("missing")) {
    return true;
  }

  return false;
}

function groupDiagnosticFindings(findings: DiagnosticFinding[]) {
  const groups = [
    { id: "blocked", label: "Blocked", items: [] as DiagnosticFinding[] },
    { id: "needs-attention", label: "Needs Attention", items: [] as DiagnosticFinding[] },
    { id: "suggestions", label: "Suggestions", items: [] as DiagnosticFinding[] },
  ];

  findings.forEach((finding) => {
    const title = finding.title.toLowerCase();
    if (finding.status === "fail") {
      groups[0].items.push(finding);
      return;
    }
    if (title.includes("missing") || title.includes("shell") || title.includes("setup")) {
      groups[2].items.push(finding);
      return;
    }
    groups[1].items.push(finding);
  });

  return groups;
}

function impactTextForFinding(finding: DiagnosticFinding) {
  const title = finding.title.toLowerCase();
  if (title.includes("live mismatch")) {
    return "Switching is no longer guaranteed to match the saved profile, so you may start coding with the wrong account identity.";
  }
  if (title.includes("keyring")) {
    return "Stored credentials may not be readable or writable until local credential storage is repaired.";
  }
  if (title.includes("permission")) {
    return "AI Switch may fail to update local state, backups, or profile changes until local file permissions are corrected.";
  }
  if (title.includes("shell")) {
    return "Shell commands can drift from the desktop state until terminal integration is installed or refreshed.";
  }
  if (title.includes("missing")) {
    return "This tool cannot be switched or verified from the desktop app until its CLI is installed.";
  }
  if (title.includes("project")) {
    return "Project rules are no longer protecting the active workspace from using the wrong saved set.";
  }
  return "This state needs review before you rely on the current desktop switching state.";
}

function repairActionKey(action: { title: string; detail: string }) {
  return `${action.title}:${action.detail}`;
}

function repairFixFromAction(action: { title: string; fix?: string }) {
  if (action.fix && action.fix.length) {
    return action.fix;
  }
  return action.title.trim().toLowerCase().replace(/\s+/g, "_");
}

function formatRelativeVerifiedTime(timestamp: number) {
  if (!timestamp) {
    return "Unavailable";
  }

  const diffMs = Math.max(Date.now() - timestamp, 0);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 10) {
    return "just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds} sec ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

async function refreshDiagnostics(
  queryClient: ReturnType<typeof useQueryClient>,
  refetchDoctor: () => Promise<unknown>,
  refetchVerify: () => Promise<unknown>,
  refetchRepair: () => Promise<unknown>,
) {
  await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
  await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
  await Promise.all([refetchDoctor(), refetchVerify(), refetchRepair()]);
}

async function copyBundlePath(
  path: string,
  setMessage: (message: string) => void,
) {
  if (!navigator.clipboard?.writeText) {
    setMessage(`Clipboard access is unavailable. Copy the bundle path manually: ${path}`);
    return;
  }
  await navigator.clipboard.writeText(path);
  setMessage(`Copied bundle path ${path}.`);
}
