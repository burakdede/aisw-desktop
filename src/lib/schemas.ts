import { z } from "zod";

export const runtimeKindSchema = z.enum(["bundled", "system", "custom"]);

export const versionInfoSchema = z.object({
  version: z.string(),
  cli_api_version: z.number(),
  json_schema_version: z.number(),
  progress_schema_version: z.number(),
});

export const capabilitiesInfoSchema = z.object({
  features: z.record(z.boolean()),
  tools: z.record(
    z.object({
      state_modes: z.array(z.string()).default([]),
      fail_closed_keyring_identity: z.boolean().default(false),
    }),
  ),
});

export const desktopSettingsSchema = z.object({
  runtime_kind: runtimeKindSchema,
  runtime_path: z.string().nullable().optional(),
  aisw_home: z.string().nullable().optional(),
  update_channel: z.string(),
  profile_sets: z
    .array(
      z.object({
        name: z.string(),
        label: z.string().nullable().optional(),
        profiles: z.record(z.string().nullable().optional()),
      }),
    )
    .default([]),
});

export const toolStatusSchema = z.object({
  tool: z.string(),
  binary_found: z.boolean(),
  stored_profiles: z.number(),
  active_profile: z.string().nullable().optional(),
  auth_method: z.string().nullable().optional(),
  credential_backend: z.string().nullable().optional(),
  state_mode: z.string().nullable().optional(),
  active_profile_applied: z.boolean().nullable().optional(),
  credentials_present: z.boolean().nullable().optional(),
  permissions_ok: z.boolean().nullable().optional(),
});

export const toolProfileSummarySchema = z.object({
  name: z.string(),
  auth: z.string(),
  label: z.string().nullable().optional(),
});

export const toolProfilesSchema = z.object({
  active: z.string().nullable().optional(),
  profiles: z.array(toolProfileSummarySchema),
});

export const contextSummarySchema = z.object({
  name: z.string(),
  profiles: z.record(z.string().nullable().optional()),
});

export const appSnapshotSchema = z.object({
  statuses: z.array(toolStatusSchema),
  profiles: z.record(toolProfilesSchema),
  contexts: z.array(contextSummarySchema),
});

export const runtimeStatusSchema = z.object({
  resolved_path: z.string().nullable().optional(),
  version: versionInfoSchema.nullable().optional(),
  capabilities: capabilitiesInfoSchema.nullable().optional(),
  compatible: z.boolean(),
  issues: z.array(z.string()),
});

export const appBootstrapSchema = z.object({
  settings: desktopSettingsSchema,
  runtime_status: runtimeStatusSchema,
  snapshot: appSnapshotSchema.nullable().optional(),
});

export const backupEntrySchema = z.object({
  backup_id: z.string(),
  tool: z.string(),
  profile: z.string(),
});

export const doctorReportSchema = z.record(z.unknown());
export const verifyReportSchema = z.record(z.unknown());
export const repairReportSchema = z.record(z.unknown());
export const initReportSchema = z.record(z.unknown());
export const workspaceStatusReportSchema = z.record(z.unknown());
export const projectBindingsReportSchema = z.record(z.unknown());
export const updateInfoSchema = z.object({
  version: z.string(),
  current_version: z.string(),
  target: z.string(),
  notes: z.string().nullable().optional(),
});
export const updateCheckReportSchema = z.object({
  configured: z.boolean(),
  channel: z.string(),
  current_version: z.string(),
  endpoint: z.string().nullable().optional(),
  update: updateInfoSchema.nullable().optional(),
  message: z.string().nullable().optional(),
});
export const installUpdateReportSchema = z.object({
  configured: z.boolean(),
  channel: z.string(),
  current_version: z.string(),
  installed_version: z.string().nullable().optional(),
  restart_requested: z.boolean(),
  message: z.string().nullable().optional(),
});
export const shellHookVariantSchema = z.object({
  shell: z.string(),
  title: z.string(),
  config_path: z.string(),
  alternate_config_path: z.string().nullable().optional(),
  install_command: z.string(),
  reload_command: z.string(),
  verify_command: z.string(),
  verify_expected: z.string(),
});
export const shellHookGuidanceSchema = z.object({
  detected_shell: z.string().nullable().optional(),
  capabilities: z.array(z.string()),
  note: z.string(),
  manual_apply_examples: z.array(z.string()),
  variants: z.array(shellHookVariantSchema),
});
export const oauthProgressEventSchema = z.object({
  type: z.string().nullable().optional(),
  seq: z.number().nullable().optional(),
  command: z.string().nullable().optional(),
  tool: z.string().nullable().optional(),
  profile: z.string().nullable().optional(),
  phase: z.string().nullable().optional(),
  safe_to_cancel: z.boolean().nullable().optional(),
  message: z.string().nullable().optional(),
  ok: z.boolean().nullable().optional(),
  result: z.record(z.unknown()).nullable().optional(),
  error: z.record(z.unknown()).nullable().optional(),
});

export const mutationResponseSchema = z.object({
  command: z.string(),
  snapshot: appSnapshotSchema,
}).passthrough();

export type AppBootstrap = z.infer<typeof appBootstrapSchema>;
export type AppSnapshot = z.infer<typeof appSnapshotSchema>;
export type DesktopSettings = z.infer<typeof desktopSettingsSchema>;
export type RuntimeKind = z.infer<typeof runtimeKindSchema>;
export type BackupEntry = z.infer<typeof backupEntrySchema>;
export type MutationResponse = z.infer<typeof mutationResponseSchema>;
export type ToolStatus = z.infer<typeof toolStatusSchema>;
export type ToolProfiles = z.infer<typeof toolProfilesSchema>;
export type InitReport = z.infer<typeof initReportSchema>;
export type UpdateCheckReport = z.infer<typeof updateCheckReportSchema>;
export type InstallUpdateReport = z.infer<typeof installUpdateReportSchema>;
export type ShellHookGuidance = z.infer<typeof shellHookGuidanceSchema>;
export type OAuthProgressEvent = z.infer<typeof oauthProgressEventSchema>;
