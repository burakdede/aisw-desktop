export const DESKTOP_COMMANDS = {
  getBootstrap: "get_bootstrap",
  getSnapshot: "get_snapshot",
  openIssueTracker: "open_issue_tracker",
  addProfile: "add_profile",
  addProfileOAuth: "add_profile_oauth",
  useProfile: "use_profile",
  useAllProfiles: "use_all_profiles",
  useContext: "use_context",
  activateProfileSet: "activate_profile_set",
  renameProfile: "rename_profile",
  removeProfile: "remove_profile",
  listBackups: "list_backups",
  runDoctor: "run_doctor",
  runInit: "run_init",
  runVerify: "run_verify",
  runRepair: "run_repair",
  exportDiagnosticBundle: "export_diagnostic_bundle",
  exportActivityLog: "export_activity_log",
  openAppDataFolder: "open_app_data_folder",
  openReferenceDocument: "open_reference_document",
  getSettings: "get_settings",
  setTrayVisibility: "set_tray_visibility",
  getShellGuidance: "get_shell_guidance",
  getLaunchAtLoginStatus: "get_launch_at_login_status",
  setLaunchAtLogin: "set_launch_at_login",
  checkForUpdates: "check_for_updates",
  installUpdate: "install_update",
  getWorkspaceStatus: "get_workspace_status",
  getProjectBindings: "get_project_bindings",
  workspaceBind: "workspace_bind",
  workspaceUnbind: "workspace_unbind",
  workspaceGuard: "workspace_guard",
  restoreBackup: "restore_backup",
  updateSettings: "update_settings",
} as const;

export const REFERENCE_DOCUMENT_KINDS = [
  "documentation",
  "troubleshooting",
] as const;

export type DesktopCommandName = (typeof DESKTOP_COMMANDS)[keyof typeof DESKTOP_COMMANDS];
export type ReferenceDocumentKind = (typeof REFERENCE_DOCUMENT_KINDS)[number];

export const REFERENCE_DOCUMENT_KIND_DOCUMENTATION: ReferenceDocumentKind =
  REFERENCE_DOCUMENT_KINDS[0];
export const REFERENCE_DOCUMENT_KIND_TROUBLESHOOTING: ReferenceDocumentKind =
  REFERENCE_DOCUMENT_KINDS[1];
