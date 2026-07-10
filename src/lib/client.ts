import {
  appBootstrapSchema,
  appSnapshotSchema,
  backupEntrySchema,
  desktopSettingsSchema,
  diagnosticBundleExportSchema,
  doctorReportSchema,
  initReportSchema,
  installUpdateReportSchema,
  mutationResponseSchema,
  oauthProgressEventSchema,
  projectBindingsReportSchema,
  repairReportSchema,
  type AppBootstrap,
  type AppSnapshot,
  type BackupEntry,
  type DiagnosticBundleExport,
  type DesktopSettings,
  type InstallUpdateReport,
  type InitReport,
  type MutationResponse,
  type OAuthProgressEvent,
  type ShellHookGuidance,
  type UpdateCheckReport,
  shellHookGuidanceSchema,
  updateCheckReportSchema,
  workspaceStatusReportSchema,
  verifyReportSchema,
} from "./schemas";
import { invokeDesktop } from "./tauri";

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
  runtime_kind: "bundled" | "system" | "custom";
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
    | { scope: "default" }
    | { scope: "path"; path: string }
    | { scope: "git_remote"; pattern: string };
  context: string;
  label?: string;
}

export interface WorkspaceUnbindInput {
  scope: "default" | "path" | "git_remote";
  path?: string;
  pattern?: string;
}

export async function getBootstrap(): Promise<AppBootstrap> {
  return appBootstrapSchema.parse(await invokeDesktop("get_bootstrap"));
}

export async function getSnapshot(): Promise<AppSnapshot> {
  return appSnapshotSchema.parse(await invokeDesktop("get_snapshot"));
}

export async function addProfile(input: AddProfileInput): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("add_profile", {
      request: {
        tool: input.tool,
        profile: input.profile,
        label: input.label ?? null,
        state_mode: input.stateMode ?? null,
        credential_backend: input.credentialBackend ?? null,
        import_mode: input.importMode,
      },
    }),
  );
}

export async function addProfileOAuth(
  input: AddOAuthProfileInput,
): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("add_profile_oauth", {
      request: {
        tool: input.tool,
        profile: input.profile,
        label: input.label ?? null,
        state_mode: input.stateMode ?? null,
        credential_backend: input.credentialBackend ?? null,
      },
    }),
  );
}

export async function useProfile(input: UseProfileInput): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("use_profile", {
      request: {
        tool: input.tool,
        profile: input.profile,
        state_mode: input.stateMode ?? null,
      },
    }),
  );
}

export async function useAllProfiles(
  input: UseAllProfilesInput,
): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("use_all_profiles", {
      request: {
        profile: input.profile,
        state_mode: input.stateMode ?? null,
      },
    }),
  );
}

export async function useContext(input: UseContextInput): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("use_context", {
      request: {
        context: input.context,
        state_mode: input.stateMode ?? null,
      },
    }),
  );
}

export async function activateProfileSet(
  input: ActivateProfileSetInput,
): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("activate_profile_set", {
      name: input.name,
    }),
  );
}

export async function renameProfile(
  input: RenameProfileInput,
): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("rename_profile", {
      tool: input.tool,
      old_name: input.oldName,
      new_name: input.newName,
    }),
  );
}

export async function removeProfile(
  input: RemoveProfileInput,
): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("remove_profile", {
      tool: input.tool,
      profile: input.profile,
      force: input.force,
    }),
  );
}

export async function listBackups(): Promise<BackupEntry[]> {
  return backupEntrySchema.array().parse(await invokeDesktop("list_backups"));
}

export async function runDoctor() {
  return doctorReportSchema.parse(await invokeDesktop("run_doctor"));
}

export async function runInit(): Promise<InitReport> {
  return initReportSchema.parse(await invokeDesktop("run_init"));
}

export async function runVerify() {
  return verifyReportSchema.parse(await invokeDesktop("run_verify"));
}

export async function runRepair(request: { apply: boolean; fixes: string[] }) {
  return repairReportSchema.parse(await invokeDesktop("run_repair", { request }));
}

export async function exportDiagnosticBundle(): Promise<DiagnosticBundleExport> {
  return diagnosticBundleExportSchema.parse(await invokeDesktop("export_diagnostic_bundle"));
}

export async function getSettings(): Promise<DesktopSettings> {
  return desktopSettingsSchema.parse(await invokeDesktop("get_settings"));
}

export async function getShellGuidance(): Promise<ShellHookGuidance> {
  return shellHookGuidanceSchema.parse(await invokeDesktop("get_shell_guidance"));
}

export function parseOAuthProgressEvent(payload: unknown): OAuthProgressEvent {
  return oauthProgressEventSchema.parse(payload);
}

export async function checkForUpdates(): Promise<UpdateCheckReport> {
  return updateCheckReportSchema.parse(await invokeDesktop("check_for_updates"));
}

export async function installUpdate(): Promise<InstallUpdateReport> {
  return installUpdateReportSchema.parse(await invokeDesktop("install_update"));
}

export async function getWorkspaceStatus() {
  return workspaceStatusReportSchema.parse(await invokeDesktop("get_workspace_status"));
}

export async function getProjectBindings() {
  return projectBindingsReportSchema.parse(await invokeDesktop("get_project_bindings"));
}

export async function workspaceBind(
  request: WorkspaceBindInput,
): Promise<MutationResponse> {
  return mutationResponseSchema.parse(await invokeDesktop("workspace_bind", { request }));
}

export async function workspaceUnbind(
  target: WorkspaceUnbindInput,
): Promise<MutationResponse> {
  return mutationResponseSchema.parse(await invokeDesktop("workspace_unbind", { target }));
}

export async function workspaceGuard(mode: "warn" | "strict"): Promise<MutationResponse> {
  return mutationResponseSchema.parse(await invokeDesktop("workspace_guard", { mode }));
}

export async function restoreBackup(backupId: string): Promise<MutationResponse> {
  return mutationResponseSchema.parse(
    await invokeDesktop("restore_backup", { backup_id: backupId }),
  );
}

export async function updateSettings(
  request: UpdateSettingsInput,
): Promise<DesktopSettings> {
  return desktopSettingsSchema.parse(await invokeDesktop("update_settings", { request }));
}
