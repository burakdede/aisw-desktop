import type { QueryClient } from "@tanstack/react-query";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "../../lib/schemas";
import { DESKTOP_QUERY_KEYS } from "../../lib/desktop-query-keys";
import { openExternalGuide, installGuideUrlForTool } from "../../lib/tool-guidance";
import type { SettingsSection } from "../../lib/settings-sections";
import { DEFAULT_PROFILE_IMPORT_MODE, type ExplicitProfileCredentialBackend, type ProfileImportMode } from "../shared/profile-capabilities";
import type { StateModeRequest, ToolStateModeTarget } from "../shared/state-modes";
import {
  buildDiagnosticQuickFixModels,
  diagnosticBundlePathCopyMessage,
  type DiagnosticQuickFixInput,
  type DiagnosticQuickFixModel,
} from "./diagnostics-panel-display";
import type { DoctorReport, RepairReport } from "../../lib/schemas";

export type DiagnosticsQuickFixCard = DiagnosticQuickFixInput & {
  kind: DiagnosticQuickFixModel["kind"];
  repairFix?: string;
  settingsSection?: SettingsSection;
  setupMode?: ProfileImportMode;
  credentialBackend?: ExplicitProfileCredentialBackend | null;
  toolTarget?: string;
  importTarget?: ToolStateModeTarget;
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

export type DiagnosticsQuickFixHandlers = {
  useProfile: (request: {
    tool: string;
    profile: string;
    stateMode: StateModeRequest;
    label?: string;
  }) => void;
  activateWorkspaceTarget: (request:
    | {
        kind: "profile_set";
        name: string;
        matchedTarget: string;
      }
    | {
        kind: "context";
        name: string;
        matchedTarget: string;
        stateMode: StateModeRequest;
      }) => void;
  applyRepairFixes: (fixes: string[]) => void;
  onOpenSettings: (section?: SettingsSection) => void;
  onOpenContexts: () => void;
  onOpenProfileSetup: (options?: {
    tool?: string;
    mode?: ProfileImportMode;
    credentialBackend?: ExplicitProfileCredentialBackend | null;
  }) => void;
};

type BuildDiagnosticsQuickFixCardsInput = {
  snapshot: AppSnapshot | undefined;
  doctor: DoctorReport | undefined;
  repair: RepairReport | undefined;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  handlers: DiagnosticsQuickFixHandlers;
  onRefreshDiagnostics: () => void;
};

const DIAGNOSTICS_REFRESH_QUERY_KEYS = [
  DESKTOP_QUERY_KEYS.bootstrap,
  DESKTOP_QUERY_KEYS.snapshot,
] as const;

export function buildDiagnosticsQuickFixCards(
  input: BuildDiagnosticsQuickFixCardsInput,
): DiagnosticsQuickFixCard[] {
  const { handlers, onRefreshDiagnostics, ...quickFixModelInput } = input;

  return buildDiagnosticQuickFixModels(quickFixModelInput).map((fix) => ({
    ...fix,
    action: () => runDiagnosticsQuickFixAction(fix, handlers),
    secondaryAction: fix.secondaryAction
      ? {
          kind: fix.secondaryAction.kind,
          label: fix.secondaryAction.label,
          action: onRefreshDiagnostics,
        }
      : undefined,
  }));
}

export function runDiagnosticsQuickFixAction(
  fix: DiagnosticQuickFixModel,
  handlers: DiagnosticsQuickFixHandlers,
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

export async function refreshDiagnosticsData(
  queryClient: QueryClient,
  refetchDoctor: () => Promise<unknown>,
  refetchVerify: () => Promise<unknown>,
  refetchRepair: () => Promise<unknown>,
) {
  await Promise.all(
    DIAGNOSTICS_REFRESH_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
  await Promise.all([refetchDoctor(), refetchVerify(), refetchRepair()]);
}

export async function copyDiagnosticsBundlePath(
  path: string,
  setMessage: (message: string) => void,
  clipboard: Pick<Clipboard, "writeText"> | null | undefined = navigator.clipboard,
) {
  if (!clipboard?.writeText) {
    setMessage(diagnosticBundlePathCopyMessage(path, false));
    return;
  }

  await clipboard.writeText(path);
  setMessage(diagnosticBundlePathCopyMessage(path, true));
}
