import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { SplitView } from "../../../components/SplitView";
import { useCompactLayout } from "../../../components/useCompactLayout";
import { AppBootstrap, AppSnapshot, DesktopSettings } from "../../../lib/schemas";
import { exportDiagnosticBundle, runDoctor, runRepair, runVerify } from "../../../lib/client";
import { WIDE_PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import { openExternalGuide, installGuideUrlForTool } from "../../../lib/tool-guidance";
import { useLastCommandResults } from "../../shared/lastCommandResult";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import {
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
import { diagnosticCheckRows, type DiagnosticCheckRow } from "../../../lib/diagnostic-display";
import { countLabel, pluralChoice } from "../../../lib/utils";
import type { SettingsSection } from "../../settings/components/SettingsPanel";
import {
  buildDiagnosticQuickFixModels,
  buildDiagnosticInspectorActions,
  buildDiagnosticFindings,
  buildRecentFailureCards,
  diagnosticQuickFixKey,
  formatRelativeVerifiedTime,
  groupDiagnosticFindings,
  impactTextForFinding,
  matchesQuickFixToFinding,
  type DiagnosticFinding,
  type DiagnosticQuickFixModel,
  type DiagnosticQuickFixInput,
} from "../diagnostics-panel-display";

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
    () => diagnosticCheckRows(summaryCards, snapshot),
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
    ? `${countLabel(totalIssues, "issue")} ${pluralChoice(totalIssues, "needs", "need")} attention`
    : "Everything looks good";
  const remainingIssues = Math.max(totalIssues - repairActions.length, 0);
  const summaryDetail = totalIssues
    ? `${countLabel(repairActions.length, "repair")} can be applied safely. ${countLabel(
        remainingIssues,
        "issue",
      )} ${pluralChoice(remainingIssues, "requires", "require")} a decision.`
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
      ? `Applied ${countLabel(lastAppliedCount, "safe fix", "safe fixes")}.`
      : "");

  useEffect(() => {
    setSelectedSafeFixes(safeFixIds);
  }, [safeFixIds.join("|")]);

  const importCurrentLabel = primaryFindingFix?.importTarget
    ? supportsProfileImportMode(primaryFindingFix.importTarget.tool, toolCapabilities, "from_live")
      ? "Import Current…"
      : "Open Account Setup"
    : null;
  const {
    secondaryInspectorAction,
    overflowActions: inspectorOverflowActions,
  } = buildDiagnosticInspectorActions({
    selectedFinding,
    primaryFindingFix,
    secondaryFindingFixes,
    importCurrentLabel,
  });

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

  function runInspectorAction(action: NonNullable<typeof secondaryInspectorAction>) {
    switch (action.kind) {
      case "quick_fix": {
        const fix = [primaryFindingFix, ...secondaryFindingFixes]
          .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
          .find((candidate) => diagnosticQuickFixKey(candidate) === action.quickFixKey);
        if (fix) {
          void fix.action();
        }
        return;
      }
      case "quick_fix_secondary":
        if (
          primaryFindingFix
          && primaryFindingFix.secondaryAction
          && diagnosticQuickFixKey(primaryFindingFix) === action.quickFixKey
        ) {
          void primaryFindingFix.secondaryAction.action();
        }
        return;
      case "import_current":
        if (!action.importTarget) {
          return;
        }
        onOpenProfileSetup({
          tool: action.importTarget.tool,
          mode: (action.importFallbackMode as ProfileImportMode | undefined) ?? "from_live",
        });
        return;
      case "open_profile_details":
        if (!action.profileTarget) {
          return;
        }
        onOpenProfiles(action.profileTarget.tool, action.profileTarget.profile);
        return;
    }
  }

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
                        onClick={() => runInspectorAction(secondaryInspectorAction)}
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
                                  runInspectorAction(action);
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
                    : `Apply ${countLabel(selectedSafeFixes.length, "Fix", "Fixes")}`}
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

type QuickFixCard = DiagnosticQuickFixInput & {
  kind: DiagnosticQuickFixModel["kind"];
  repairFix?: string;
  settingsSection?: "shell" | "keyring";
  setupMode?: ProfileImportMode;
  credentialBackend?: "file" | "system-keyring" | null;
  toolTarget?: string;
  importTarget?: { tool: string; stateMode: string | null };
  importFallbackMode?: ProfileImportMode;
  workspaceActivationTarget?: DiagnosticQuickFixModel["workspaceActivationTarget"];
  matchedWorkspaceTarget?: string;
  primary?: boolean;
  secondaryAction?: {
    kind?: "refresh_diagnostics";
    label: string;
    action: () => void | Promise<void>;
  };
  action: () => void;
};

function buildQuickFixes(
  {
    snapshot,
    doctor,
    repair,
    settings,
    toolCapabilities,
    useProfile,
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
  return buildDiagnosticQuickFixModels({
    snapshot,
    doctor,
    repair,
    settings,
    toolCapabilities,
  }).map((fix) => ({
    ...fix,
    action: () =>
      runQuickFixAction(fix, {
        useProfile,
        activateWorkspaceTarget,
        applyRepairFixes,
        onOpenSettings,
        onOpenContexts,
        onOpenProfileSetup,
      }),
    secondaryAction: fix.secondaryAction
      ? {
          kind: fix.secondaryAction.kind,
          label: fix.secondaryAction.label,
          action: onRefreshDiagnostics,
        }
      : undefined,
  }));
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

function runQuickFixAction(
  fix: DiagnosticQuickFixModel,
  handlers: {
    useProfile: (request: {
      tool: string;
      profile: string;
      stateMode: string | null;
      label?: string;
    }) => void;
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
  },
) {
  switch (fix.kind) {
    case "repair_doctor_issue":
      if (fix.repairFix) {
        handlers.applyRepairFixes([fix.repairFix]);
      }
      return;
    case "open_settings":
      handlers.onOpenSettings(fix.settingsSection);
      return;
    case "open_profile_setup":
      handlers.onOpenProfileSetup({
        mode: fix.setupMode,
        credentialBackend: fix.credentialBackend,
      });
      return;
    case "open_installation_guide":
      openExternalGuide(installGuideUrlForTool(fix.toolTarget ?? ""));
      return;
    case "reapply_profile":
      if (!fix.profileTarget) {
        return;
      }
      handlers.useProfile({
        tool: fix.profileTarget.tool,
        profile: fix.profileTarget.profile ?? "",
        stateMode: fix.importTarget?.stateMode ?? null,
        label: fix.label.replace(/^Re-apply\s+/u, ""),
      });
      return;
    case "resolve_workspace":
      if (fix.workspaceActivationTarget && fix.matchedWorkspaceTarget) {
        handlers.activateWorkspaceTarget({
          ...fix.workspaceActivationTarget,
          matchedTarget: fix.matchedWorkspaceTarget,
        });
        return;
      }
      handlers.onOpenContexts();
      return;
  }
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
