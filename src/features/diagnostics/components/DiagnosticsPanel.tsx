import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SectionCard } from "../../../components/SectionCard";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
import { exportDiagnosticBundle, runDoctor, runRepair, runVerify } from "../../../lib/client";
import { openExternalGuide, installGuideUrlForTool } from "../../../lib/tool-guidance";
import { useLastCommandResults } from "../../shared/lastCommandResult";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
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
import { titleCase } from "../../../lib/utils";
import type { SettingsSection } from "../../settings/components/SettingsPanel";

const SUPPORTED_TOOLS = new Set(["claude", "codex", "gemini"]);

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
    addProfileMutation,
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
  const [importDrafts, setImportDrafts] = useState<Record<string, string>>({});
  const [bundleCopyMessage, setBundleCopyMessage] = useState("");
  const applyRepair = useMutation({
    mutationFn: (fixes: string[]) => runRepair({ apply: true, fixes }),
    onSuccess: async () => {
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

  return (
    <SectionCard
      title="Diagnostics"
      kicker="Doctor · Verify · Repair"
      actions={
        <div className="button-row">
          <button
            className="ghost-button"
            disabled={mutationLock.isBusy}
            onClick={() =>
              void refreshDiagnostics(queryClient, doctor.refetch, verify.refetch, repair.refetch)
            }
          >
            Refresh diagnostics
          </button>
          <button
            className="primary-button"
            onClick={() => applyRepair.mutate([])}
            disabled={applyRepair.isPending || !repairActions.length}
          >
            {applyRepair.isPending ? "Applying repairs…" : "Apply safe repairs"}
          </button>
          <button
            className="ghost-button"
            onClick={() => exportBundle.mutate()}
            disabled={exportBundle.isPending}
          >
            {exportBundle.isPending ? "Exporting bundle…" : "Export redacted bundle"}
          </button>
        </div>
      }
    >
      {exportBundle.data ? (
        <article className="diagnostic-card diagnostic-pass diagnostics-body">
          <h3>Diagnostic bundle exported</h3>
          <p className="inline-note">{exportBundle.data.filename}</p>
          <p className="inline-note">{exportBundle.data.path}</p>
          <div className="button-row">
            <button
              className="ghost-button"
              type="button"
              onClick={() => void copyBundlePath(exportBundle.data.path, setBundleCopyMessage)}
            >
              Copy bundle path
            </button>
          </div>
          {bundleCopyMessage ? <p className="inline-note">{bundleCopyMessage}</p> : null}
        </article>
      ) : null}
      {exportBundle.error ? (
        <article className="diagnostic-card diagnostic-fail diagnostics-body">
          <h3>Diagnostic bundle export failed</h3>
          <p className="inline-note">
            {exportBundle.error instanceof Error
              ? exportBundle.error.message
              : "Diagnostic bundle export failed."}
          </p>
        </article>
      ) : null}

      <div className="panel-grid panel-grid-3">
        {summaryCards.map((card) => (
          <article key={card.title} className={`diagnostic-card diagnostic-${card.status}`}>
            <h3>{card.title}</h3>
            <p className="diagnostic-status">{card.status}</p>
            {card.lines.map((line) => (
              <p key={line} className="inline-note">
                {line}
              </p>
            ))}
          </article>
        ))}
      </div>

      {applyRepair.data ? (
        <article className="diagnostic-card diagnostic-pass diagnostics-body">
          <h3>Last applied repair</h3>
          <p className="diagnostic-status">
            {String(
              ((applyRepair.data.result as { summary?: { status?: string } } | undefined)
                ?.summary?.status ?? "unknown"),
            )}
          </p>
          <p className="inline-note">
            {String(
              ((applyRepair.data.result as {
                summary?: { actions_applied?: number };
              } | undefined)?.summary?.actions_applied ?? 0),
            )}{" "}
            actions applied
          </p>
          <p className="inline-note">
            {String(
              ((applyRepair.data.result as {
                summary?: { issues_remaining?: number };
              } | undefined)?.summary?.issues_remaining ?? 0),
            )}{" "}
            issues remaining
          </p>
        </article>
      ) : null}

      <div className="panel-grid panel-grid-2 diagnostics-body">
        <div className="stack-list">
          <h3>Issues and remediation</h3>
          {issueCards.map((card) => (
            <article key={`${card.title}-${card.status}`} className={`diagnostic-card diagnostic-${card.status}`}>
              <h4>{card.title}</h4>
              {card.issues.map((issue) => (
                <p key={issue} className="inline-note">
                  {issue}
                </p>
              ))}
              {card.remediation.length ? (
                <div className="diagnostic-remediation">
                  {card.remediation.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </div>
              ) : null}
              {resolveIssueProfileTarget(card, snapshot) ? (
                <div className="button-row">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      const target = resolveIssueProfileTarget(card, snapshot);
                      if (!target) return;
                      onOpenProfiles(target.tool, target.profile);
                    }}
                  >
                    Open profile details
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {!issueCards.length ? (
            <p className="inline-note">No failing or warning diagnostics are currently reported.</p>
          ) : null}
        </div>

        <div className="stack-list">
          <h3>Direct fixes</h3>
          {quickFixes.map((fix) => (
            <article key={quickFixKey(fix)} className={`diagnostic-card diagnostic-${fix.status}`}>
              <h4>{fix.title}</h4>
              <p className="inline-note">{fix.detail}</p>
              <div className="button-row">
                <button
                  className={fix.primary ? "primary-button" : "ghost-button"}
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={fix.action}
                >
                  {fix.label}
                </button>
                {fix.secondaryAction ? (
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={mutationLock.isBusy}
                    onClick={() => void fix.secondaryAction?.action()}
                  >
                    {fix.secondaryAction?.label}
                  </button>
                ) : null}
                {fix.profileTarget ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => onOpenProfiles(fix.profileTarget!.tool, fix.profileTarget!.profile)}
                  >
                    Open profile details
                  </button>
                ) : null}
              </div>
              {fix.importTarget ? (
                supportsProfileImportMode(fix.importTarget.tool, toolCapabilities, "from_live") ? (
                  <div className="inline-form">
                    <input
                      aria-label={`import ${fix.importTarget.tool} current login from diagnostics`}
                      placeholder="new profile name"
                      value={importDrafts[quickFixKey(fix)] ?? ""}
                      onChange={(event) =>
                        setImportDrafts((current) => ({
                          ...current,
                          [quickFixKey(fix)]: event.target.value,
                        }))
                      }
                    />
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={mutationLock.isBusy || !importDrafts[quickFixKey(fix)]?.trim()}
                      onClick={() => {
                        const profile = importDrafts[quickFixKey(fix)]?.trim();
                        if (!profile) return;
                        addProfileMutation.mutate(
                          {
                            tool: fix.importTarget!.tool,
                            profile,
                            label: titleCase(profile),
                            stateMode: fix.importTarget!.stateMode,
                            importMode: { kind: "from_live" },
                          },
                          {
                            onSuccess: () =>
                              setImportDrafts((current) => ({
                                ...current,
                                [quickFixKey(fix)]: "",
                              })),
                          },
                        );
                      }}
                    >
                      Import current as new
                    </button>
                  </div>
                ) : (
                  <div className="stack-list">
                    <p className="inline-note">
                      This runtime does not advertise live import for {titleCase(fix.importTarget.tool)}. Open profile setup to use a supported flow.
                    </p>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() =>
                        onOpenProfileSetup({
                          tool: fix.importTarget?.tool,
                          mode: fix.importFallbackMode ?? preferredProfileImportMode(fix.importTarget!.tool, toolCapabilities, "from_live"),
                        })
                      }
                    >
                      Open profile setup
                    </button>
                  </div>
                )
              ) : null}
            </article>
          ))}
          {!quickFixes.length ? (
            <p className="inline-note">No direct fix actions are available from the current diagnostics state.</p>
          ) : null}
        </div>

        <div className="stack-list">
          <h3>Recent command failures</h3>
          {recentFailures.map((failure) => (
            <article key={failure.key} className="diagnostic-card diagnostic-fail">
              <h4>{failure.title}</h4>
              <p className="inline-note">{failure.message}</p>
              {failure.remediation ? <p className="inline-note">{failure.remediation}</p> : null}
              {failure.profileTarget ? (
                <div className="button-row">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => onOpenProfiles(failure.profileTarget!.tool, failure.profileTarget!.profile)}
                  >
                    Open profile details
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {!recentFailures.length ? (
            <p className="inline-note">No recent command failures are recorded in this session.</p>
          ) : null}
        </div>

        <div className="stack-list">
          <h3>Planned repair actions</h3>
          {repairActions.map((action) => (
            <article key={`${action.title}-${action.detail}`} className="diagnostic-card">
              <h4>{action.title}</h4>
              <p className="inline-note">{action.detail}</p>
              <p className="diagnostic-status">{action.status}</p>
            </article>
          ))}
          {!repairActions.length ? (
            <p className="inline-note">No safe automatic repairs are currently planned.</p>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

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
      title: "Shell hook not active",
      detail: shellHookIssue.detail,
      label: "Open shell setup",
      status: shellHookIssue.status,
      action: () => onOpenSettings("shell"),
    });
  }

  const keyringIssue = keyringDoctorIssue(doctor);
  if (keyringIssue) {
    fixes.push({
      title: "Use file-backed storage",
      detail: "Open profile setup with file-backed credential storage preselected for the next import or add flow.",
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
        detail: `Re-apply ${profileLabel} so the live credentials match AI Switch again.`,
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
      title: "Workspace context mismatch",
      detail: target
        ? `This folder wants ${expectedContextLabel}, but ${currentContextLabel} is currently active.`
        : `This folder wants ${expectedContextLabel}, but no matching CLI context or non-empty profile set is currently available.`,
      label: target ? "Use expected set now" : "Open sets",
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
    const detail = asStringValue(check.detail) ?? "Shell hook guidance needs attention.";
    const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";
    const detailText = detail.toLowerCase();
    if (
      (name.includes("shell") && name.includes("hook")) ||
      detailText.includes("shell hook")
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
  if (status.tool === "gemini") {
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
  return SUPPORTED_TOOLS.has(candidate) ? candidate : null;
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
