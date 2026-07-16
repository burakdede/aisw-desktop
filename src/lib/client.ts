import {
  appBootstrapSchema,
  appSnapshotSchema,
  backupEntrySchema,
  desktopSettingsSchema,
  diagnosticBundleExportSchema,
  doctorReportSchema,
  initReportSchema,
  installUpdateReportSchema,
  launchAtLoginStatusSchema,
  mutationResponseSchema,
  oauthProgressEventSchema,
  openedPathSchema,
  projectBindingsReportSchema,
  repairReportSchema,
  type AppBootstrap,
  type AppSnapshot,
  type BackupEntry,
  type DiagnosticBundleExport,
  type DesktopSettings,
  type InstallUpdateReport,
  type InitReport,
  type LaunchAtLoginStatus,
  type MutationResponse,
  type OAuthProgressEvent,
  type ShellHookGuidance,
  type UpdateCheckReport,
  shellHookGuidanceSchema,
  updateCheckReportSchema,
  workspaceStatusReportSchema,
  verifyReportSchema,
} from "./schemas";
import {
  DESKTOP_COMMANDS,
  type DesktopCommandName,
  type ReferenceDocumentKind,
} from "./desktop-command-contract";
import { invokeDesktop } from "./tauri";
import type { WorkspaceBindingScope } from "./workspace-binding-contract";
import type { WorkspaceGuardMode } from "./workspace-policy";
import type { output, ZodTypeAny } from "zod";

export interface AddProfileInput {
  tool: string;
  profile: string;
  label?: string | null;
  stateMode?: string | null;
  credentialBackend?: string | null;
  importMode:
    | { kind: "from_live" }
    | { kind: "from_env" }
    | { kind: "api_key"; value: string };
}

export interface AddOAuthProfileInput {
  tool: string;
  profile: string;
  label?: string | null;
  stateMode?: string | null;
  credentialBackend?: string | null;
}

export interface UseProfileInput {
  tool: string;
  profile: string;
  stateMode?: string | null;
  label?: string;
}

export interface UseAllProfilesInput {
  profile: string;
  stateMode?: string | null;
  label?: string;
}

export interface UseContextInput {
  context: string;
  stateMode?: string | null;
  label?: string;
}

export interface ActivateProfileSetInput {
  name: string;
  label?: string;
}

export interface RenameProfileInput {
  tool: string;
  oldName: string;
  newName: string;
}

export interface RemoveProfileInput {
  tool: string;
  profile: string;
  force: boolean;
}

export interface UpdateSettingsInput {
  runtime_kind: DesktopSettings["runtime_kind"];
  runtime_path?: string | null;
  aisw_home?: string | null;
  update_channel: string;
  profile_labels: Record<string, Record<string, string | null | undefined>>;
  profile_sets: Array<{
    name: string;
    label?: string | null;
    profiles: Record<string, string | null | undefined>;
  }>;
}

export interface WorkspaceBindInput {
  target:
    | { scope: Extract<WorkspaceBindingScope, "default"> }
    | { scope: Extract<WorkspaceBindingScope, "path">; path: string }
    | { scope: Extract<WorkspaceBindingScope, "git_remote">; pattern: string };
  context: string;
  label?: string;
}

export interface WorkspaceUnbindInput {
  scope: WorkspaceBindingScope;
  path?: string;
  pattern?: string;
}

async function invokeParsed<Schema extends ZodTypeAny>(
  command: DesktopCommandName,
  schema: Schema,
  args?: Record<string, unknown>,
): Promise<output<Schema>> {
  return schema.parse(await invokeDesktop(command, args));
}

export async function getBootstrap(): Promise<AppBootstrap> {
  return invokeParsed(DESKTOP_COMMANDS.getBootstrap, appBootstrapSchema);
}

export async function getSnapshot(): Promise<AppSnapshot> {
  return invokeParsed(DESKTOP_COMMANDS.getSnapshot, appSnapshotSchema);
}

export async function openIssueTracker(): Promise<string> {
  return invokeParsed(DESKTOP_COMMANDS.openIssueTracker, openedPathSchema);
}

export async function addProfile(input: AddProfileInput): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.addProfile,
    mutationResponseSchema,
    {
      request: {
        tool: input.tool,
        profile: input.profile,
        label: input.label ?? null,
        state_mode: input.stateMode ?? null,
        credential_backend: input.credentialBackend ?? null,
        import_mode: input.importMode,
      },
    },
  );
}

export async function addProfileOAuth(
  input: AddOAuthProfileInput,
): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.addProfileOAuth,
    mutationResponseSchema,
    {
      request: {
        tool: input.tool,
        profile: input.profile,
        label: input.label ?? null,
        state_mode: input.stateMode ?? null,
        credential_backend: input.credentialBackend ?? null,
      },
    },
  );
}

export async function useProfile(input: UseProfileInput): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.useProfile,
    mutationResponseSchema,
    {
      request: {
        tool: input.tool,
        profile: input.profile,
        state_mode: input.stateMode ?? null,
      },
    },
  );
}

export async function useAllProfiles(
  input: UseAllProfilesInput,
): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.useAllProfiles,
    mutationResponseSchema,
    {
      request: {
        profile: input.profile,
        state_mode: input.stateMode ?? null,
      },
    },
  );
}

export async function useContext(input: UseContextInput): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.useContext,
    mutationResponseSchema,
    {
      request: {
        context: input.context,
        state_mode: input.stateMode ?? null,
      },
    },
  );
}

export async function activateProfileSet(
  input: ActivateProfileSetInput,
): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.activateProfileSet,
    mutationResponseSchema,
    {
      name: input.name,
    },
  );
}

export async function renameProfile(
  input: RenameProfileInput,
): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.renameProfile,
    mutationResponseSchema,
    {
      tool: input.tool,
      old_name: input.oldName,
      new_name: input.newName,
    },
  );
}

export async function removeProfile(
  input: RemoveProfileInput,
): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.removeProfile,
    mutationResponseSchema,
    {
      tool: input.tool,
      profile: input.profile,
      force: input.force,
    },
  );
}

export async function listBackups(): Promise<BackupEntry[]> {
  return invokeParsed(DESKTOP_COMMANDS.listBackups, backupEntrySchema.array());
}

export async function runDoctor() {
  return invokeParsed(DESKTOP_COMMANDS.runDoctor, doctorReportSchema);
}

export async function runInit(): Promise<InitReport> {
  return invokeParsed(DESKTOP_COMMANDS.runInit, initReportSchema);
}

export async function runVerify() {
  return invokeParsed(DESKTOP_COMMANDS.runVerify, verifyReportSchema);
}

export async function runRepair(request: { apply: boolean; fixes: string[] }) {
  return invokeParsed(DESKTOP_COMMANDS.runRepair, repairReportSchema, { request });
}

export async function exportDiagnosticBundle(): Promise<DiagnosticBundleExport> {
  return invokeParsed(
    DESKTOP_COMMANDS.exportDiagnosticBundle,
    diagnosticBundleExportSchema,
  );
}

export async function exportActivityLog(contents: string): Promise<DiagnosticBundleExport> {
  return invokeParsed(
    DESKTOP_COMMANDS.exportActivityLog,
    diagnosticBundleExportSchema,
    { contents },
  );
}

export async function openAppDataFolder(): Promise<string> {
  return invokeParsed(DESKTOP_COMMANDS.openAppDataFolder, openedPathSchema);
}

export async function openReferenceDocument(
  kind: ReferenceDocumentKind,
): Promise<string> {
  return invokeParsed(DESKTOP_COMMANDS.openReferenceDocument, openedPathSchema, { kind });
}

export async function getSettings(): Promise<DesktopSettings> {
  return invokeParsed(DESKTOP_COMMANDS.getSettings, desktopSettingsSchema);
}

export async function setTrayVisibility(visible: boolean): Promise<void> {
  await invokeDesktop(DESKTOP_COMMANDS.setTrayVisibility, { visible });
}

export async function getShellGuidance(): Promise<ShellHookGuidance> {
  return invokeParsed(DESKTOP_COMMANDS.getShellGuidance, shellHookGuidanceSchema);
}

export async function getLaunchAtLoginStatus(): Promise<LaunchAtLoginStatus> {
  return invokeParsed(
    DESKTOP_COMMANDS.getLaunchAtLoginStatus,
    launchAtLoginStatusSchema,
  );
}

export async function setLaunchAtLogin(enabled: boolean): Promise<LaunchAtLoginStatus> {
  return invokeParsed(
    DESKTOP_COMMANDS.setLaunchAtLogin,
    launchAtLoginStatusSchema,
    { enabled },
  );
}

export function parseOAuthProgressEvent(payload: unknown): OAuthProgressEvent {
  return oauthProgressEventSchema.parse(payload);
}

export async function checkForUpdates(): Promise<UpdateCheckReport> {
  return invokeParsed(DESKTOP_COMMANDS.checkForUpdates, updateCheckReportSchema);
}

export async function installUpdate(): Promise<InstallUpdateReport> {
  return invokeParsed(DESKTOP_COMMANDS.installUpdate, installUpdateReportSchema);
}

export async function getWorkspaceStatus() {
  return invokeParsed(DESKTOP_COMMANDS.getWorkspaceStatus, workspaceStatusReportSchema);
}

export async function getProjectBindings() {
  return invokeParsed(DESKTOP_COMMANDS.getProjectBindings, projectBindingsReportSchema);
}

export async function workspaceBind(
  request: WorkspaceBindInput,
): Promise<MutationResponse> {
  return invokeParsed(DESKTOP_COMMANDS.workspaceBind, mutationResponseSchema, { request });
}

export async function workspaceUnbind(
  target: WorkspaceUnbindInput,
): Promise<MutationResponse> {
  return invokeParsed(DESKTOP_COMMANDS.workspaceUnbind, mutationResponseSchema, { target });
}

export async function workspaceGuard(mode: WorkspaceGuardMode): Promise<MutationResponse> {
  return invokeParsed(DESKTOP_COMMANDS.workspaceGuard, mutationResponseSchema, { mode });
}

export async function restoreBackup(backupId: string): Promise<MutationResponse> {
  return invokeParsed(
    DESKTOP_COMMANDS.restoreBackup,
    mutationResponseSchema,
    { backup_id: backupId },
  );
}

export async function updateSettings(
  request: UpdateSettingsInput,
): Promise<DesktopSettings> {
  return invokeParsed(DESKTOP_COMMANDS.updateSettings, desktopSettingsSchema, { request });
}
