import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DESKTOP_QUERY_KEYS } from "../../lib/desktop-query-keys";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "../../lib/schemas";
import { makeRuntimeToolCapabilities } from "../../test-support/runtime-tool-capabilities";
import { makeToolStatus } from "../../test-support/runtime-tool-statuses";
import {
  buildDiagnosticsQuickFixCards,
  copyDiagnosticsBundlePath,
  refreshDiagnosticsData,
  runDiagnosticsQuickFixAction,
  type DiagnosticsQuickFixHandlers,
} from "./diagnostics-panel-actions";
import * as toolGuidance from "../../lib/tool-guidance";

function makeSnapshot(): AppSnapshot {
  return {
    statuses: [
      makeToolStatus("claude", {
        stored_profiles: 1,
        active_profile: "work",
        active_profile_applied: false,
        auth_method: "oauth",
        credential_backend: "file",
        state_mode: "isolated",
      }),
      makeToolStatus("codex", {
        binary_found: false,
      }),
    ],
    profiles: {
      claude: {
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: "Work" }],
      },
      codex: {
        active: null,
        profiles: [],
      },
    },
    contexts: [{ name: "expected", profiles: { claude: "work" } }],
    workspace_status: {
      result: {
        status: "mismatch",
        current_context: "current",
        expected_context: "expected",
        matched_binding: {
          scope: "path",
          path: "/tmp/project",
          context: "expected",
        },
      },
    },
    project_bindings: {},
  };
}

function makeSettings(overrides: Partial<DesktopSettings> = {}): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {},
    profile_sets: [],
    ...overrides,
  };
}

function makeToolCapabilities(): NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"] {
  return makeRuntimeToolCapabilities({
    claude: {
      auth_methods: ["from_live", "oauth"],
      credential_backends: ["file", "system_keyring"],
    },
    codex: {
      auth_methods: ["from_live", "oauth"],
      credential_backends: ["file", "system_keyring"],
    },
  });
}

function makeHandlers(): DiagnosticsQuickFixHandlers {
  return {
    useProfile: vi.fn(),
    activateWorkspaceTarget: vi.fn(),
    applyRepairFixes: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenContexts: vi.fn(),
    onOpenProfileSetup: vi.fn(),
  };
}

describe("diagnostics-panel-actions", () => {
  const openExternalGuideSpy = vi.spyOn(toolGuidance, "openExternalGuide").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes diagnostics queries and refetchers together", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries,
    } as unknown as Parameters<typeof refreshDiagnosticsData>[0];
    const refetchDoctor = vi.fn().mockResolvedValue(undefined);
    const refetchVerify = vi.fn().mockResolvedValue(undefined);
    const refetchRepair = vi.fn().mockResolvedValue(undefined);

    await refreshDiagnosticsData(queryClient, refetchDoctor, refetchVerify, refetchRepair);

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: DESKTOP_QUERY_KEYS.bootstrap,
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: DESKTOP_QUERY_KEYS.snapshot,
    });
    expect(refetchDoctor).toHaveBeenCalledOnce();
    expect(refetchVerify).toHaveBeenCalledOnce();
    expect(refetchRepair).toHaveBeenCalledOnce();
  });

  it("copies diagnostics bundle paths with and without clipboard access", async () => {
    const setMessage = vi.fn();
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    await copyDiagnosticsBundlePath("/tmp/report.zip", setMessage, clipboard);
    expect(clipboard.writeText).toHaveBeenCalledWith("/tmp/report.zip");
    expect(setMessage).toHaveBeenCalledWith("Copied bundle path /tmp/report.zip.");

    setMessage.mockClear();
    await copyDiagnosticsBundlePath("/tmp/report.zip", setMessage, null);
    expect(setMessage).toHaveBeenCalledWith(
      "Clipboard access is unavailable. Copy the bundle path /tmp/report.zip manually.",
    );
  });

  it("runs each quick-fix action through the expected handler", () => {
    const handlers = makeHandlers();

    runDiagnosticsQuickFixAction(
      {
        kind: "repair_doctor_issue",
        title: "Permission issue",
        detail: "Permissions need review.",
        label: "Repair permissions",
        status: "warn",
        repairFix: "permissions",
      },
      handlers,
    );
    expect(handlers.applyRepairFixes).toHaveBeenCalledWith(["permissions"]);

    runDiagnosticsQuickFixAction(
      {
        kind: "open_settings",
        title: "Terminal integration not active",
        detail: "Shell hook missing.",
        label: "Open terminal setup",
        status: "warn",
        settingsSection: "shell",
      },
      handlers,
    );
    expect(handlers.onOpenSettings).toHaveBeenCalledWith("shell");

    runDiagnosticsQuickFixAction(
      {
        kind: "open_profile_setup",
        title: "Use file-backed storage",
        detail: "Switch backend.",
        label: "Use file-backed storage",
        status: "warn",
        setupMode: "from_live",
        credentialBackend: "file",
      },
      handlers,
    );
    expect(handlers.onOpenProfileSetup).toHaveBeenCalledWith({
      mode: "from_live",
      credentialBackend: "file",
    });

    runDiagnosticsQuickFixAction(
      {
        kind: "reapply_profile",
        title: "claude live mismatch",
        detail: "Mismatch",
        label: "Re-apply Work",
        status: "fail",
        profileTarget: { tool: "claude", profile: "work" },
        importTarget: { tool: "claude", stateMode: "isolated" },
      },
      handlers,
    );
    expect(handlers.useProfile).toHaveBeenCalledWith({
      tool: "claude",
      profile: "work",
      stateMode: "isolated",
      label: "Work",
    });

    runDiagnosticsQuickFixAction(
      {
        kind: "resolve_workspace",
        title: "Project set mismatch",
        detail: "Mismatch",
        label: "Use expected set now",
        status: "warn",
        workspaceActivationTarget: { kind: "context", name: "expected", stateMode: "isolated" },
        matchedWorkspaceTarget: "/tmp/project",
      },
      handlers,
    );
    expect(handlers.activateWorkspaceTarget).toHaveBeenCalledWith({
      kind: "context",
      name: "expected",
      stateMode: "isolated",
      matchedTarget: "/tmp/project",
    });

    runDiagnosticsQuickFixAction(
      {
        kind: "resolve_workspace",
        title: "Project set mismatch",
        detail: "Mismatch",
        label: "Open Sets",
        status: "warn",
      },
      handlers,
    );
    expect(handlers.onOpenContexts).toHaveBeenCalled();

    runDiagnosticsQuickFixAction(
      {
        kind: "open_installation_guide",
        title: "codex is missing",
        detail: "Install codex.",
        label: "Open installation guide",
        status: "warn",
        toolTarget: "codex",
      },
      handlers,
    );
    expect(openExternalGuideSpy).toHaveBeenCalledOnce();
  });

  it("builds quick-fix cards with executable primary and secondary actions", () => {
    const handlers = makeHandlers();
    const onRefreshDiagnostics = vi.fn();

    const cards = buildDiagnosticsQuickFixCards({
      snapshot: makeSnapshot(),
      doctor: {
        checks: [
          { name: "keyring", detail: "Keyring access failed.", status: "fail" },
          { name: "shell hook", detail: "Shell hook is not active in the current shell session.", status: "warn" },
          { name: "permission", detail: "Permissions need review.", status: "warn" },
        ],
      },
      repair: {
        result: {
          actions: [{ fix: "permissions" }, { fix: "keyring" }],
        },
      },
      settings: makeSettings(),
      toolCapabilities: makeToolCapabilities(),
      handlers,
      onRefreshDiagnostics,
    });

    const missingTool = cards.find((card) => card.kind === "open_installation_guide");
    expect(missingTool?.secondaryAction?.label).toBe("Refresh diagnostics");
    void missingTool?.secondaryAction?.action();
    expect(onRefreshDiagnostics).toHaveBeenCalledOnce();

    const liveMismatch = cards.find((card) => card.kind === "reapply_profile");
    liveMismatch?.action();
    expect(handlers.useProfile).toHaveBeenCalledWith({
      tool: "claude",
      profile: "work",
      stateMode: "isolated",
      label: "Work",
    });
  });
});
