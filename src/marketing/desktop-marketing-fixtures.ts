import type {
  AppBootstrap,
  AppSnapshot,
  BackupEntry,
  DesktopSettings,
  DoctorReport,
  ProjectBindingsReport,
  RepairReport,
  VerifyReport,
  WorkspaceStatusReport,
} from "../lib/schemas";
import {
  asObject,
  asOptionalString,
  asOptionalStringFieldOr,
} from "../lib/parse-guards";
import {
  findProfileSetByName,
  findSnapshotToolStatus,
  snapshotHasToolProfile,
} from "../lib/profile-display";
import {
  toolDefaultAuthMethods,
  toolDefaultCredentialBackends,
  toolDefaultFailClosedKeyringIdentity,
  toolDefaultStateModes,
} from "../lib/tool-registry";

export const MARKETING_SCENES = [
  "overview",
  "profiles",
  "sets",
  "workspace",
  "diagnostics",
  "operations",
] as const;

export type MarketingSceneName = (typeof MARKETING_SCENES)[number];

type MarketingSceneData = {
  bootstrap: AppBootstrap;
  snapshot: AppSnapshot;
  settings: DesktopSettings;
  doctor: DoctorReport;
  verify: VerifyReport;
  repair: RepairReport;
  workspaceStatus: WorkspaceStatusReport;
  projectBindings: ProjectBindingsReport;
  backups: BackupEntry[];
  activityStore: unknown;
};

type RuntimeStatus = AppBootstrap["runtime_status"];
type SnapshotPayloadRecord = NonNullable<AppSnapshot["workspace_status"]>;

const baseRuntimeStatus: RuntimeStatus = {
  resolved_path: "/Applications/AI Switcher.app/Contents/Resources/aisw",
  version: {
    version: "0.3.8",
    cli_api_version: 1,
    json_schema_version: 1,
    progress_schema_version: 1,
  },
  capabilities: {
    features: {
      api_key_stdin: true,
      mutation_json: true,
      progress_json: true,
      non_prompting_init: true,
      detect_live_init: true,
      verify: true,
      repair: true,
      contexts: true,
      workspace_bindings: true,
      project_bindings_alias: true,
    },
    tools: {
      claude: marketingToolCapability("claude"),
      codex: marketingToolCapability("codex"),
      gemini: marketingToolCapability("gemini"),
      antigravity: marketingToolCapability("antigravity"),
    },
  },
  inventory: {
    bundled_path: "/Applications/AI Switcher.app/Contents/Resources/aisw",
    system_path: "/opt/homebrew/bin/aisw",
    configured_path: null,
  },
  compatible: true,
  issues: [],
};

function marketingToolCapability(tool: "claude" | "codex" | "gemini" | "antigravity") {
  return {
    auth_methods: toolDefaultAuthMethods(tool),
    state_modes: toolDefaultStateModes(tool),
    credential_backends: toolDefaultCredentialBackends(tool),
    fail_closed_keyring_identity: toolDefaultFailClosedKeyringIdentity(tool),
  };
}

const baseSettings: DesktopSettings = {
  runtime_kind: "bundled",
  runtime_path: null,
  aisw_home: null,
  update_channel: "stable",
  profile_labels: {
    claude: {
      acme: "Acme Main",
      personal: "Personal",
      review: "Release Review",
    },
    codex: {
      acme: "Acme Main",
      personal: "Personal",
      release: "Release Review",
    },
    gemini: {
      acme: "Acme Main",
      personal: "Personal",
      research: "Research",
    },
    antigravity: {
      acme: "Acme Main",
      personal: "Personal",
      review: "Release Review",
    },
  },
  profile_sets: [
    {
      name: "acme-product",
      label: "Acme Product",
      profiles: {
        claude: "acme",
        codex: "acme",
        gemini: "acme",
        antigravity: "acme",
      },
    },
    {
      name: "personal-stack",
      label: "Personal",
      profiles: {
        claude: "personal",
        codex: "personal",
        gemini: "personal",
        antigravity: "personal",
      },
    },
    {
      name: "release-review",
      label: "Release Review",
      profiles: {
        claude: "review",
        codex: "release",
        gemini: "research",
        antigravity: "review",
      },
    },
  ],
};

const baseProfiles: AppSnapshot["profiles"] = {
  claude: {
    active: "acme",
    profiles: [
      { name: "acme", auth: "oauth", label: "Acme Main" },
      { name: "personal", auth: "oauth", label: "Personal" },
      { name: "review", auth: "oauth", label: "Release Review" },
    ],
  },
  codex: {
    active: "acme",
    profiles: [
      { name: "acme", auth: "oauth", label: "Acme Main" },
      { name: "personal", auth: "oauth", label: "Personal" },
      { name: "release", auth: "api_key", label: "Release Review" },
    ],
  },
  gemini: {
    active: "acme",
    profiles: [
      { name: "acme", auth: "oauth", label: "Acme Main" },
      { name: "personal", auth: "oauth", label: "Personal" },
      { name: "research", auth: "oauth", label: "Research" },
    ],
  },
  antigravity: {
    active: "acme",
    profiles: [
      { name: "acme", auth: "oauth", label: "Acme Main" },
      { name: "personal", auth: "oauth", label: "Personal" },
      { name: "review", auth: "oauth", label: "Release Review" },
    ],
  },
};

const baseContexts: AppSnapshot["contexts"] = [
  {
    name: "acme-product",
    profiles: {
      claude: "acme",
      codex: "acme",
      gemini: "acme",
      antigravity: "acme",
    },
  },
  {
    name: "personal-stack",
    profiles: {
      claude: "personal",
      codex: "personal",
      gemini: "personal",
      antigravity: "personal",
    },
  },
  {
    name: "release-review",
    profiles: {
      claude: "review",
      codex: "release",
      gemini: "research",
      antigravity: "review",
    },
  },
];

const matchWorkspaceStatus = {
  result: {
    status: "match",
    current_context: "acme-product",
    expected_context: "acme-product",
    matched_binding: {
      scope: "path",
      path: "~/Projects/acme-app",
      context: "acme-product",
    },
  },
} satisfies WorkspaceStatusReport;

const matchProjectBindings = {
  result: {
    user_bindings: {
      guard_mode: "strict",
      default_context: "personal-stack",
      items: [
        {
          scope: "path",
          path: "~/Projects/acme-app",
          context: "acme-product",
        },
        {
          scope: "git_remote",
          pattern: "github.com/acme/*",
          context: "acme-product",
        },
      ],
    },
  },
} satisfies ProjectBindingsReport;

const mismatchWorkspaceStatus = {
  result: {
    status: "mismatch",
    current_context: "personal-stack",
    expected_context: "acme-product",
    matched_binding: {
      scope: "path",
      path: "~/Projects/acme-app",
      context: "acme-product",
    },
  },
} satisfies WorkspaceStatusReport;

const mismatchProjectBindings = {
  result: {
    user_bindings: {
      guard_mode: "warn",
      default_context: "personal-stack",
      items: [
        {
          scope: "path",
          path: "~/Projects/acme-app",
          context: "acme-product",
        },
        {
          scope: "git_remote",
          pattern: "github.com/acme/*",
          context: "acme-product",
        },
      ],
    },
  },
} satisfies ProjectBindingsReport;

const baseBackups: BackupEntry[] = [
  {
    backup_id: "2026-07-16T09:42:11Z-before-switch-claude-acme",
    tool: "claude",
    profile: "acme",
    created_at: "2026-07-16T09:42:11Z",
  },
  {
    backup_id: "2026-07-15T20:11:54Z-before-switch-codex-release",
    tool: "codex",
    profile: "release",
    created_at: "2026-07-15T20:11:54Z",
  },
  {
    backup_id: "2026-07-14T18:07:33Z-before-remove-gemini-research",
    tool: "gemini",
    profile: "research",
    created_at: "2026-07-14T18:07:33Z",
  },
  {
    backup_id: "2026-07-13T16:20:12Z-before-switch-antigravity-review",
    tool: "agy",
    profile: "review",
    created_at: "2026-07-13T16:20:12Z",
  },
];

const baseActivityStore = {
  tool: {
    claude: {
      label: "Switch profile",
      status: "success",
      message: "Switched Claude Code to Acme Main.",
      command: "use_profile",
      resultSummary: "Snapshot updated",
      at: Date.parse("2026-07-16T11:18:00Z"),
    },
    codex: {
      label: "Switch profile",
      status: "success",
      message: "Switched Codex CLI to Release Review.",
      command: "use_profile",
      resultSummary: "Snapshot updated",
      at: Date.parse("2026-07-16T10:51:00Z"),
    },
  },
  global: {
    "profile-set": {
      label: "Activate saved set",
      status: "success",
      message: "Activated set Acme Product.",
      command: "activate_profile_set",
      resultSummary: "Snapshot updated",
      at: Date.parse("2026-07-16T10:42:00Z"),
    },
    workspace: {
      label: "Use Expected Set",
      status: "success",
      message: "Switched to Acme Product for ~/Projects/acme-app.",
      command: "activate_profile_set",
      resultSummary: "Snapshot updated",
      at: Date.parse("2026-07-16T10:39:00Z"),
    },
  },
  timeline: [
    {
      key: "tool:claude:2026-07-16T11:18:00Z",
      scope: { type: "tool", tool: "claude" },
      label: "Switch profile",
      status: "success",
      message: "Switched Claude Code to Acme Main.",
      command: "use_profile",
      resultSummary: "Snapshot updated",
      at: Date.parse("2026-07-16T11:18:00Z"),
    },
    {
      key: "tool:codex:2026-07-16T10:51:00Z",
      scope: { type: "tool", tool: "codex" },
      label: "Switch profile",
      status: "success",
      message: "Switched Codex CLI to Release Review.",
      command: "use_profile",
      resultSummary: "Snapshot updated",
      at: Date.parse("2026-07-16T10:51:00Z"),
    },
    {
      key: "global:profile-set:2026-07-16T10:42:00Z",
      scope: { type: "global", id: "profile-set" },
      label: "Activate saved set",
      status: "success",
      message: "Activated set Acme Product.",
      command: "activate_profile_set",
      resultSummary: "Snapshot updated",
      at: Date.parse("2026-07-16T10:42:00Z"),
    },
    {
      key: "global:workspace:2026-07-16T10:39:00Z",
      scope: { type: "global", id: "workspace" },
      label: "Use Expected Set",
      status: "success",
      message: "Switched to Acme Product for ~/Projects/acme-app.",
      command: "activate_profile_set",
      resultSummary: "Snapshot updated",
      at: Date.parse("2026-07-16T10:39:00Z"),
    },
  ],
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withSnapshot(
  snapshot: AppSnapshot,
  workspaceStatus: WorkspaceStatusReport,
  projectBindings: ProjectBindingsReport,
): AppSnapshot {
  return {
    ...snapshot,
    workspace_status: deepClone(
      ("result" in workspaceStatus ? workspaceStatus.result : workspaceStatus) as SnapshotPayloadRecord,
    ),
    project_bindings: deepClone(
      ("result" in projectBindings ? projectBindings.result : projectBindings) as SnapshotPayloadRecord,
    ),
  };
}

function buildBaseSnapshot(): AppSnapshot {
  return {
    statuses: [
      {
        tool: "claude",
        binary_found: true,
        stored_profiles: 3,
        active_profile: "acme",
        auth_method: "oauth",
        credential_backend: "system_keyring",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
        warnings: [],
      },
      {
        tool: "codex",
        binary_found: true,
        stored_profiles: 3,
        active_profile: "acme",
        auth_method: "oauth",
        credential_backend: "system_keyring",
        state_mode: "shared",
        active_profile_applied: false,
        credentials_present: true,
        permissions_ok: true,
        warnings: [
          {
            code: "live_mismatch",
            severity: "warn",
            message: "Live CLI state differs from the saved profile.",
            remediation: "Re-apply the active profile before coding.",
          },
        ],
      },
      {
        tool: "gemini",
        binary_found: true,
        stored_profiles: 3,
        active_profile: "acme",
        auth_method: "oauth",
        credential_backend: "file",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
        token_warning: {
          code: "token-expiring",
          severity: "warn",
          summary: "Refresh soon",
          message: "The active Gemini credential expires in 3 days.",
          provider: "Google",
          expires_in_days: 3,
        },
        warnings: [],
      },
      {
        tool: "antigravity",
        binary_found: true,
        stored_profiles: 3,
        active_profile: "acme",
        auth_method: "oauth",
        credential_backend: "system_keyring",
        state_mode: null,
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
        warnings: [],
      },
    ],
    profiles: deepClone(baseProfiles),
    contexts: deepClone(baseContexts),
  };
}

function buildOverviewScene(): MarketingSceneData {
  const snapshot = withSnapshot(buildBaseSnapshot(), matchWorkspaceStatus, matchProjectBindings);
  return {
    bootstrap: {
      settings: deepClone(baseSettings),
      runtime_status: deepClone(baseRuntimeStatus),
      snapshot,
    },
    snapshot,
    settings: deepClone(baseSettings),
    doctor: {
      summary: { status: "pass" },
      checks: [],
    },
    verify: {
      summary: { status: "warn", passed: 2, warnings: 1, failed: 0 },
      tools: [
        {
          tool: "codex",
          status: "warn",
          issues: ["live credentials differ from the saved profile"],
          remediation: ["Re-apply the active profile"],
        },
      ],
    },
    repair: {
      result: {
        summary: { status: "warn", actions_planned: 1, actions_applied: 0, issues_remaining: 1 },
        actions: [
          {
            kind: "profile",
            fix: "oauth",
            tool: "codex",
            profile: "acme",
            detail: "Refresh the saved Codex live session.",
          },
        ],
      },
    },
    workspaceStatus: deepClone(matchWorkspaceStatus),
    projectBindings: deepClone(matchProjectBindings),
    backups: deepClone(baseBackups),
    activityStore: deepClone(baseActivityStore),
  };
}

function buildProfilesScene(): MarketingSceneData {
  const snapshot = withSnapshot(buildBaseSnapshot(), matchWorkspaceStatus, matchProjectBindings);
  snapshot.statuses[0]!.active_profile_applied = true;
  snapshot.statuses[1]!.active_profile_applied = true;
  return {
    ...buildOverviewScene(),
    bootstrap: {
      settings: deepClone(baseSettings),
      runtime_status: deepClone(baseRuntimeStatus),
      snapshot,
    },
    snapshot,
  };
}

function buildSetsScene(): MarketingSceneData {
  const overview = buildOverviewScene();
  const snapshot = deepClone(overview.snapshot);
  snapshot.statuses.forEach((status) => {
    status.active_profile_applied = true;
  });
  return {
    ...overview,
    bootstrap: {
      settings: deepClone(baseSettings),
      runtime_status: deepClone(baseRuntimeStatus),
      snapshot,
    },
    snapshot,
  };
}

function buildWorkspaceScene(): MarketingSceneData {
  const snapshot = withSnapshot(buildBaseSnapshot(), mismatchWorkspaceStatus, mismatchProjectBindings);
  snapshot.statuses.forEach((status) => {
    status.active_profile = "personal";
    status.active_profile_applied = true;
  });
  snapshot.profiles.claude!.active = "personal";
  snapshot.profiles.codex!.active = "personal";
  snapshot.profiles.gemini!.active = "personal";

  return {
    ...buildOverviewScene(),
    bootstrap: {
      settings: deepClone(baseSettings),
      runtime_status: deepClone(baseRuntimeStatus),
      snapshot,
    },
    snapshot,
    workspaceStatus: deepClone(mismatchWorkspaceStatus),
    projectBindings: deepClone(mismatchProjectBindings),
  };
}

function buildDiagnosticsScene(): MarketingSceneData {
  const snapshot = withSnapshot(buildBaseSnapshot(), mismatchWorkspaceStatus, mismatchProjectBindings);
  snapshot.statuses = [
    {
      tool: "claude",
      binary_found: true,
      stored_profiles: 3,
      active_profile: "acme",
      auth_method: "oauth",
      credential_backend: "system_keyring",
      state_mode: "isolated",
      active_profile_applied: false,
      credentials_present: true,
      permissions_ok: true,
      warnings: [],
    },
    {
      tool: "codex",
      binary_found: false,
      stored_profiles: 2,
      active_profile: null,
      auth_method: null,
      credential_backend: null,
      state_mode: "shared",
      active_profile_applied: null,
      credentials_present: false,
      permissions_ok: true,
      warnings: [],
    },
    {
      tool: "gemini",
      binary_found: true,
      stored_profiles: 3,
      active_profile: "acme",
      auth_method: "oauth",
      credential_backend: "file",
      state_mode: "isolated",
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: false,
      warnings: [
        {
          code: "permissions",
          severity: "warn",
          message: "Managed config files need permission repair.",
          remediation: "Repair permissions before the next switch.",
        },
      ],
    },
    {
      tool: "antigravity",
      binary_found: true,
      stored_profiles: 3,
      active_profile: "review",
      auth_method: "oauth",
      credential_backend: "system_keyring",
      state_mode: null,
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: true,
      warnings: [],
    },
  ];

  return {
    bootstrap: {
      settings: deepClone(baseSettings),
      runtime_status: deepClone(baseRuntimeStatus),
      snapshot,
    },
    snapshot,
    settings: deepClone(baseSettings),
    doctor: {
      summary: { status: "fail" },
      checks: [
        {
          name: "tool/codex",
          status: "warn",
          detail: "codex not found on PATH",
          remediation: ["Install Codex CLI or point AI Switcher to the correct binary."],
        },
        {
          name: "permissions",
          status: "warn",
          detail: "AI Switch cannot write the managed Gemini config path.",
          remediation: ["Grant write access to ~/.aisw and retry."],
        },
        {
          name: "keyring",
          status: "fail",
          detail: "Local credential store is locked.",
          remediation: "Unlock the local credential store and retry.",
        },
      ],
    },
    verify: {
      summary: { status: "fail", passed: 1, warnings: 1, failed: 2 },
      tools: [
        {
          tool: "claude",
          status: "fail",
          issues: ["live credentials changed outside AI Switcher"],
          remediation: ["Re-apply the active profile"],
        },
        {
          tool: "codex",
          status: "warn",
          issues: ["tool binary not found on PATH"],
          remediation: ["Install Codex CLI"],
        },
        {
          tool: "workspace",
          status: "fail",
          issues: ["current repository is on the Personal stack"],
          remediation: ["Use the expected Acme Product set"],
        },
      ],
    },
    repair: {
      result: {
        summary: { status: "warn", actions_planned: 3, actions_applied: 0, issues_remaining: 3 },
        actions: [
          {
            kind: "profile",
            fix: "oauth",
            tool: "claude",
            profile: "acme",
            detail: "Refresh the saved Claude login.",
          },
          {
            kind: "filesystem",
            fix: "permissions",
            path: "~/.aisw/gemini/config.json",
            detail: "Repair write access for managed config files.",
          },
          {
            kind: "keyring",
            fix: "keyring",
            detail: "Reconnect to the local credential store.",
          },
        ],
      },
    },
    workspaceStatus: deepClone(mismatchWorkspaceStatus),
    projectBindings: deepClone(mismatchProjectBindings),
    backups: deepClone(baseBackups),
    activityStore: deepClone(baseActivityStore),
  };
}

function buildOperationsScene(): MarketingSceneData {
  const snapshot = withSnapshot(buildBaseSnapshot(), matchWorkspaceStatus, matchProjectBindings);
  snapshot.statuses.forEach((status) => {
    status.active_profile_applied = true;
  });
  return {
    ...buildOverviewScene(),
    bootstrap: {
      settings: deepClone(baseSettings),
      runtime_status: deepClone(baseRuntimeStatus),
      snapshot,
    },
    snapshot,
  };
}

export function buildMarketingScene(sceneName: MarketingSceneName): MarketingSceneData {
  switch (sceneName) {
    case "profiles":
      return buildProfilesScene();
    case "sets":
      return buildSetsScene();
    case "workspace":
      return buildWorkspaceScene();
    case "diagnostics":
      return buildDiagnosticsScene();
    case "operations":
      return buildOperationsScene();
    case "overview":
    default:
      return buildOverviewScene();
  }
}

type MutableMarketingState = {
  settings: DesktopSettings;
  runtimeStatus: RuntimeStatus;
  snapshot: AppSnapshot;
  doctor: DoctorReport;
  verify: VerifyReport;
  repair: RepairReport;
  workspaceStatus: WorkspaceStatusReport;
  projectBindings: ProjectBindingsReport;
  backups: BackupEntry[];
};

function syncSnapshotState(state: MutableMarketingState) {
  state.snapshot.workspace_status = deepClone(
    ("result" in state.workspaceStatus
      ? state.workspaceStatus.result
      : state.workspaceStatus) as SnapshotPayloadRecord,
  );
  state.snapshot.project_bindings = deepClone(
    ("result" in state.projectBindings
      ? state.projectBindings.result
      : state.projectBindings) as SnapshotPayloadRecord,
  );
}

function setActiveProfile(state: MutableMarketingState, tool: string, profile: string) {
  const profileStore = state.snapshot.profiles[tool];
  const status = findSnapshotToolStatus(state.snapshot, tool);
  if (!profileStore || !status) {
    return;
  }

  profileStore.active = profile;
  status.active_profile = profile;
  status.binary_found = true;
  status.active_profile_applied = true;
  status.credentials_present = true;
  status.permissions_ok = true;
  status.warnings = [];
}

function applySet(state: MutableMarketingState, setName: string) {
  const set = findProfileSetByName(state.settings.profile_sets, setName);
  if (!set) {
    return;
  }

  Object.entries(set.profiles).forEach(([tool, profile]) => {
    if (typeof profile === "string" && profile.length > 0) {
      setActiveProfile(state, tool, profile);
    }
  });

  const isWorkspaceMatch =
    "result" in state.workspaceStatus &&
    typeof state.workspaceStatus.result === "object" &&
    state.workspaceStatus.result !== null &&
    "expected_context" in state.workspaceStatus.result &&
    state.workspaceStatus.result.expected_context === setName;

  if (isWorkspaceMatch && "result" in state.workspaceStatus && state.workspaceStatus.result) {
    const result = state.workspaceStatus.result as Record<string, unknown>;
    result.status = "match";
    result.current_context = setName;
  }

  syncSnapshotState(state);
}

function applySharedProfile(state: MutableMarketingState, profile: string) {
  Object.keys(state.snapshot.profiles).forEach((tool) => {
    if (snapshotHasToolProfile(state.snapshot, tool, profile)) {
      setActiveProfile(state, tool, profile);
    }
  });
  syncSnapshotState(state);
}

function mutationResponse(state: MutableMarketingState, command: string) {
  return {
    command,
    snapshot: deepClone(state.snapshot),
  };
}

function marketingArgsRecord(args: unknown) {
  return asObject(args);
}

function marketingRequestRecord(args: unknown) {
  return asObject(marketingArgsRecord(args)?.request);
}

function marketingStringArg(args: unknown, key: string) {
  return asOptionalStringFieldOr(marketingArgsRecord(args), key, "");
}

function marketingRequestString(args: unknown, key: string) {
  return asOptionalStringFieldOr(marketingRequestRecord(args), key, "");
}

export function createMarketingDesktopMock(sceneName: MarketingSceneName) {
  const scene = buildMarketingScene(sceneName);
  const state: MutableMarketingState = {
    settings: deepClone(scene.settings),
    runtimeStatus: deepClone(scene.bootstrap.runtime_status),
    snapshot: deepClone(scene.snapshot),
    doctor: deepClone(scene.doctor),
    verify: deepClone(scene.verify),
    repair: deepClone(scene.repair),
    workspaceStatus: deepClone(scene.workspaceStatus),
    projectBindings: deepClone(scene.projectBindings),
    backups: deepClone(scene.backups),
  };

  syncSnapshotState(state);

  return async (command: string, args?: unknown) => {
    switch (command) {
      case "get_bootstrap":
        return {
          settings: deepClone(state.settings),
          runtime_status: deepClone(state.runtimeStatus),
          snapshot: deepClone(state.snapshot),
        } satisfies AppBootstrap;
      case "get_snapshot":
        return deepClone(state.snapshot);
      case "get_settings":
        return deepClone(state.settings);
      case "run_init":
        return {
          result: {
            live_accounts: [],
          },
        };
      case "run_doctor":
        return deepClone(state.doctor);
      case "run_verify":
        return deepClone(state.verify);
      case "run_repair":
        return deepClone(state.repair);
      case "get_workspace_status":
        return deepClone(state.workspaceStatus);
      case "get_project_bindings":
        return deepClone(state.projectBindings);
      case "list_backups":
        return deepClone(state.backups);
      case "export_diagnostic_bundle":
      case "export_activity_log":
        return {
          path: "/tmp/ai-switcher-marketing-export.json",
          filename: "ai-switcher-marketing-export.json",
          generated_at: "2026-07-16T11:25:00Z",
        };
      case "get_shell_guidance":
        return {
          detected_shell: "zsh",
          capabilities: [],
          note: "Shell hook guidance is not required for marketing captures.",
          manual_apply_examples: [],
          variants: [],
        };
      case "get_launch_at_login_status":
        return {
          supported: true,
          enabled: false,
          detail: "Disabled in the marketing fixture.",
        };
      case "set_launch_at_login":
      case "check_for_updates":
        return {
          supported: true,
          enabled: false,
          detail: "Disabled in the marketing fixture.",
        };
      case "install_update":
        return {
          configured: true,
          channel: "stable",
          current_version: "0.1.11",
          installed_version: "0.1.11",
          restart_requested: false,
          message: "AI Switcher is already current.",
        };
      case "update_settings": {
        const request = marketingRequestRecord(args) as Partial<DesktopSettings> | undefined;
        if (request) {
          state.settings = {
            ...state.settings,
            ...request,
          };
        }
        return deepClone(state.settings);
      }
      case "activate_profile_set": {
        const setName = marketingStringArg(args, "name");
        applySet(state, setName);
        return mutationResponse(state, command);
      }
      case "use_all_profiles": {
        const profile = marketingRequestString(args, "profile");
        applySharedProfile(state, profile);
        return mutationResponse(state, command);
      }
      case "use_profile": {
        const request = marketingRequestRecord(args);
        const tool = asOptionalString(request?.tool);
        const profile = asOptionalString(request?.profile);
        if (tool && profile) {
          setActiveProfile(state, tool, profile);
          syncSnapshotState(state);
        }
        return mutationResponse(state, command);
      }
      case "use_context": {
        const context = marketingRequestString(args, "context");
        applySet(state, context);
        return mutationResponse(state, command);
      }
      case "restore_backup":
      case "workspace_bind":
      case "workspace_unbind":
      case "workspace_guard":
      case "rename_profile":
      case "remove_profile":
      case "add_profile":
      case "add_profile_oauth":
        return mutationResponse(state, command);
      case "set_tray_visibility":
        return undefined;
      default:
        return undefined;
    }
  };
}

export function buildMarketingActivityStore(sceneName: MarketingSceneName) {
  return deepClone(buildMarketingScene(sceneName).activityStore);
}
