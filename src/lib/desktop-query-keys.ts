export const DESKTOP_QUERY_KEYS = {
  bootstrap: ["bootstrap"],
  snapshot: ["snapshot"],
  init: ["init"],
  doctor: ["doctor"],
  verify: ["verify"],
  repairDryRun: ["repair", "dry-run"],
  backups: ["backups"],
  workspaceStatus: ["workspace-status"],
  projectBindings: ["project-bindings"],
  shellGuidance: ["shell-guidance"],
  launchAtLogin: ["launch-at-login"],
} as const;

export const CORE_DESKTOP_QUERY_KEYS = [
  DESKTOP_QUERY_KEYS.bootstrap,
  DESKTOP_QUERY_KEYS.snapshot,
  DESKTOP_QUERY_KEYS.init,
] as const;

export const DESKTOP_DIAGNOSTIC_QUERY_KEYS = [
  DESKTOP_QUERY_KEYS.doctor,
  DESKTOP_QUERY_KEYS.verify,
  DESKTOP_QUERY_KEYS.repairDryRun,
  DESKTOP_QUERY_KEYS.snapshot,
  DESKTOP_QUERY_KEYS.bootstrap,
] as const;

export const POST_MUTATION_QUERY_KEYS = [
  DESKTOP_QUERY_KEYS.bootstrap,
  DESKTOP_QUERY_KEYS.snapshot,
  DESKTOP_QUERY_KEYS.doctor,
  DESKTOP_QUERY_KEYS.verify,
  DESKTOP_QUERY_KEYS.backups,
  DESKTOP_QUERY_KEYS.init,
  DESKTOP_QUERY_KEYS.workspaceStatus,
  DESKTOP_QUERY_KEYS.projectBindings,
] as const;
