import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { App } from "./App";
import { SetupPanel } from "./features/onboarding/components/SetupPanel";
import {
  recordCommandResult,
  resetLastCommandResultsForTests,
} from "./features/shared/lastCommandResult";
import { useDesktopActions } from "./features/shared/useDesktopActions";
import { enqueueMutation, resetMutationQueueForTests } from "./features/shared/mutationQueue";
import { SettingsPanel } from "./features/settings/components/SettingsPanel";
import { desktopSettingsSchema } from "./lib/schemas";
import type { AppBootstrap, AppSnapshot, DesktopSettings, InitReport } from "./lib/schemas";

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

Object.assign(window, {
  open: vi.fn(),
  __AISW_DESKTOP_NOTIFY__: vi.fn(),
});

const bootstrapSettings: DesktopSettings = {
  runtime_kind: "bundled",
  runtime_path: null,
  aisw_home: null,
  update_channel: "stable",
  profile_labels: {},
  profile_sets: [],
};

const bootstrap = {
  settings: bootstrapSettings,
  runtime_status: {
    resolved_path: "/Applications/AI Switch.app/Contents/Resources/aisw",
    version: {
      version: "0.3.7",
      cli_api_version: 1,
      json_schema_version: 1,
      progress_schema_version: 1,
    },
    capabilities: {
      features: {
        mutation_json: true,
      },
      tools: {},
    },
    inventory: {
      bundled_path: "/Applications/AI Switch.app/Contents/Resources/aisw",
      system_path: "/opt/homebrew/bin/aisw",
      configured_path: null,
    },
    compatible: true,
    issues: [],
  },
  snapshot: {
    statuses: [
      {
        tool: "claude",
        binary_found: true,
        stored_profiles: 2,
        active_profile: "work",
        auth_method: "oauth",
        credential_backend: "system_keyring",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
      },
    ],
    profiles: {
      claude: {
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: "Work" }],
      },
      codex: {
        active: "work",
        profiles: [{ name: "work", auth: "api_key", label: "Work" }],
      },
    },
    contexts: [
      {
        name: "client-acme",
        profiles: {
          claude: "work",
        },
      },
    ],
  },
};

async function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
}

async function renderSettingsPanel(
  settings: DesktopSettings,
  initialSection?: "general" | "runtime" | "updates" | "shell" | "keyring" | "advanced",
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  let rendered: ReturnType<typeof render> | undefined;
  await act(async () => {
    rendered = render(
      <QueryClientProvider client={queryClient}>
        <SettingsPanel
          settings={settings}
          runtimeStatus={bootstrap.runtime_status}
          initialSection={initialSection ?? "runtime"}
        />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });

  if (!rendered) {
    throw new Error("Settings panel failed to render.");
  }

  return {
    ...rendered,
    queryClient,
  };
}

async function openSetsSection() {
  await waitFor(() => expect(document.querySelector(".sidebar")).not.toBeNull());
  const sidebar = document.querySelector(".sidebar");
  if (!(sidebar instanceof HTMLElement)) {
    throw new Error("Sidebar not found.");
  }
  fireEvent.click(within(sidebar).getByRole("button", { name: "Sets" }));
  await waitFor(() => expect(screen.getByLabelText("Sets sections")).toBeInTheDocument());
  const setsSections = screen.getByLabelText("Sets sections");
  fireEvent.click(within(setsSections).getByRole("button", { name: "Set Library" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Set Library" })).toBeInTheDocument());
}

async function openProjectRulesSection() {
  await openSetsSection();
  const setsSections = screen.getByLabelText("Sets sections");
  fireEvent.click(within(setsSections).getByRole("button", { name: "Project rules" }));
}

function selectOverviewTool(tool: string) {
  fireEvent.click(screen.getByRole("button", { name: `Inspect ${tool}` }));
}

function selectProfileInventory(tool: string, label: string) {
  fireEvent.click(screen.getByRole("button", { name: `Inspect ${tool} ${label}` }));
}

function selectDiagnosticFinding(title: string) {
  fireEvent.click(screen.getByRole("button", { name: `Inspect ${title}` }));
}

async function renderSetupPanel({
  initReport = undefined,
  bootstrapOverride,
  onOpenProfiles = vi.fn(),
  onOpenSettings = vi.fn(),
}: {
  initReport?: InitReport;
  bootstrapOverride?: AppBootstrap;
  onOpenProfiles?: (
    tool: string,
    options?: { mode?: "from_live" | "from_env" | "api_key" | "oauth" },
  ) => void;
  onOpenSettings?: (
    section?: "general" | "runtime" | "updates" | "shell" | "keyring" | "advanced",
  ) => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  let rendered: ReturnType<typeof render> | undefined;
  const setupBootstrap = (bootstrapOverride ?? bootstrap) as unknown as AppBootstrap;
  await act(async () => {
    rendered = render(
      <QueryClientProvider client={queryClient}>
        <SetupPanel
          bootstrap={setupBootstrap}
          snapshot={(setupBootstrap.snapshot ?? bootstrap.snapshot) as unknown as AppSnapshot}
          initReport={initReport}
          onOpenProfiles={onOpenProfiles}
          onOpenSettings={onOpenSettings}
        />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });

  if (!rendered) {
    throw new Error("Setup panel failed to render.");
  }

  return {
    ...rendered,
    queryClient,
  };
}

function getProfilesSection() {
  const kicker = screen.getByText("Saved profiles", { selector: ".section-kicker" });
  const section = kicker.closest("section");
  if (!section) {
    throw new Error("Profiles section not found.");
  }
  return within(section);
}

function getAddProfileDialog() {
  return within(screen.getByRole("dialog", { name: "Add Profile" }));
}

function getOnboardingImportDialog(tool = "Claude Code") {
  return within(screen.getByRole("dialog", { name: `Import ${tool} Profile` }));
}

function openSetupStep(label: "Welcome" | "Accounts" | "Runtime" | "First switch" | "Terminal") {
  const tabs = screen.getByLabelText("Setup steps");
  fireEvent.click(within(tabs).getByRole("tab", { name: label }));
}

async function openAddProfileDialog() {
  if (!screen.queryByRole("dialog", { name: "Add Profile" })) {
    fireEvent.click(getProfilesSection().getAllByRole("button", { name: "Add Profile" })[0]);
  }
  await waitFor(() => {
    expect(screen.getByRole("dialog", { name: "Add Profile" })).toBeInTheDocument();
  });
  return getAddProfileDialog();
}

function getQuickSwitchDialog() {
  return within(screen.getByRole("dialog", { name: "Quick Switch" }));
}

async function openQuickSwitchDialog() {
  if (!screen.queryByRole("dialog", { name: "Quick Switch" })) {
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Quick Switch" }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Quick Switch" })[0]);
  }
  await waitFor(() => {
    expect(screen.getByRole("dialog", { name: "Quick Switch" })).toBeInTheDocument();
  });
  return getQuickSwitchDialog();
}

describe("App", () => {
  beforeEach(() => {
    vi.mocked(window.open).mockClear();
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => (values.has(key) ? values.get(key)! : null),
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() {
        return values.size;
      },
    } as Storage;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    window.localStorage.clear();
    delete document.documentElement.dataset.appearance;
    document.documentElement.style.colorScheme = "";
    const notify = window.__AISW_DESKTOP_NOTIFY__;
    if (notify) {
      vi.mocked(notify).mockClear();
    }
    const eventHandlers: Record<string, ((payload: unknown) => void) | undefined> = {};
    window.__AISW_DESKTOP_LISTEN__ = async (event, handler) => {
      eventHandlers[event] = handler as (payload: unknown) => void;
      return () => {
        delete eventHandlers[event];
      };
    };
    window.__AISW_DESKTOP_MOCK__ = {
      get_bootstrap: bootstrap,
      get_snapshot: bootstrap.snapshot,
      run_doctor: { summary: { status: "pass" } },
      run_init: {
        result: {
          live_accounts: [
            { tool: "claude", outcome: "detected", auth_method: "oauth" },
          ],
        },
      },
      run_verify: { summary: { status: "pass" } },
      run_repair: { result: { mode: "dry_run" } },
      export_diagnostic_bundle: {
        path: "/tmp/ai-switch/ai-switch-diagnostics-123.json",
        filename: "ai-switch-diagnostics-123.json",
        generated_at: "unix:123",
      },
      export_activity_log: {
        path: "/tmp/ai-switch/activity-log-123.json",
        filename: "activity-log-123.json",
        generated_at: "unix:123",
      },
      get_workspace_status: { result: { status: "match" } },
      get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
      list_backups: [],
      get_settings: bootstrap.settings,
      get_launch_at_login_status: {
        supported: true,
        enabled: false,
        detail: "macOS login item target: /Applications/AI Switch.app",
      },
      get_shell_guidance: {
        detected_shell: "zsh",
        capabilities: [
          "Apply CLAUDE_CONFIG_DIR, CODEX_HOME, and GEMINI_API_KEY into the current shell session when you switch profiles from AI Switch.",
          "Enforce workspace guardrails before `claude`, `codex`, or `gemini` launch from that shell.",
        ],
        note: "Without terminal integration, AI Switch still updates local credential files and its managed configuration. Terminal integration is only required for current-shell exports and workspace checks.",
        manual_apply_examples: [
          'eval "$(aisw use claude work --emit-env)"',
          'eval "$(aisw context use client-acme --emit-env)"',
        ],
        variants: [
          {
            shell: "zsh",
            title: "Zsh",
            config_path: "~/.zshrc",
            alternate_config_path: null,
            install_command: "echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc",
            reload_command: "source ~/.zshrc",
            verify_command: "echo \"$AISW_SHELL_HOOK\"",
            verify_expected: "1",
          },
        ],
      },
    };
    Object.assign(window, { __AISW_DESKTOP_EVENT_HANDLERS__: eventHandlers });
  });

  afterEach(() => {
    resetLastCommandResultsForTests();
    resetMutationQueueForTests();
    delete (window as typeof window & { __AISW_DESKTOP_EVENT_HANDLERS__?: unknown }).__AISW_DESKTOP_EVENT_HANDLERS__;
    delete window.__AISW_DESKTOP_MOCK__;
    delete window.__AISW_DESKTOP_LISTEN__;
    delete window.__AISW_WINDOW_MOCK__;
  });

  it("renders the overview from bootstrap data", async () => {
    await renderApp();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    });
    expect(screen.getByText("Re-apply Work")).toBeInTheDocument();
    expect(screen.getAllByText("Current set").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Work").length).toBeGreaterThan(0);
    expect(
      screen.getByText((_, element) => element?.textContent?.trim() === "SwitchingReady"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Set Up AI Switch")).not.toBeInTheDocument();
    expect(screen.queryByText("Included runtime")).not.toBeInTheDocument();
    expect(screen.queryByText("Health check")).not.toBeInTheDocument();
    expect(screen.queryByText("Local-only by default")).not.toBeInTheDocument();
  });

  it("restores and persists the main window frame when the native window API is available", async () => {
    let resizeHandler: (() => void) | undefined;
    let moveHandler: (() => void) | undefined;
    const setSize = vi.fn().mockResolvedValue(undefined);
    const setPosition = vi.fn().mockResolvedValue(undefined);

    window.localStorage.setItem(
      "ai-switch.desktop.window-state",
      JSON.stringify({ width: 1040, height: 720, x: 64, y: 96 }),
    );

    window.__AISW_WINDOW_MOCK__ = {
      setSize,
      setPosition,
      innerSize: vi.fn().mockResolvedValue({ width: 1180, height: 760 }),
      outerPosition: vi.fn().mockResolvedValue({ x: 180, y: 144 }),
      isMaximized: vi.fn().mockResolvedValue(false),
      onResized: vi.fn(async (handler: () => void) => {
        resizeHandler = handler;
        return () => {
          resizeHandler = undefined;
        };
      }),
      onMoved: vi.fn(async (handler: () => void) => {
        moveHandler = handler;
        return () => {
          moveHandler = undefined;
        };
      }),
    };

    await renderApp();

    await waitFor(() => {
      expect(setSize).toHaveBeenCalled();
      expect(setPosition).toHaveBeenCalled();
    });

    expect(setSize.mock.calls[setSize.mock.calls.length - 1]?.[0]).toMatchObject({
      width: 1040,
      height: 720,
    });
    expect(setPosition.mock.calls[setPosition.mock.calls.length - 1]?.[0]).toMatchObject({
      x: 64,
      y: 96,
    });

    await act(async () => {
      resizeHandler?.();
      moveHandler?.();
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    });

    expect(window.localStorage.getItem("ai-switch.desktop.window-state")).toBe(
      JSON.stringify({ width: 1180, height: 760, x: 180, y: 144 }),
    );
  });

  it("supports arrow-key sidebar navigation", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const overviewButton = screen.getAllByRole("button", { name: "Overview" })[0];
    overviewButton.focus();
    expect(overviewButton).toHaveFocus();

    fireEvent.keyDown(overviewButton, { key: "ArrowDown" });

    await waitFor(() => {
      const profilesButton = screen.getAllByRole("button", { name: "Profiles" })[0];
      expect(profilesButton).toHaveFocus();
      expect(profilesButton).toHaveClass("nav-button-active");
      expect(profilesButton).toHaveAttribute("aria-current", "page");
    });

    const profilesButton = screen.getAllByRole("button", { name: "Profiles" })[0];
    fireEvent.keyDown(profilesButton, { key: "End" });

    await waitFor(() => {
      const settingsButton = screen.getAllByRole("button", { name: "Settings" })[0];
      expect(settingsButton).toHaveFocus();
      expect(settingsButton).toHaveClass("nav-button-active");
      expect(settingsButton).toHaveAttribute("aria-current", "page");
    });
  });

  it("shows activity in a timeline and inspector layout", async () => {
    const defaultMock = window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>;
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      return defaultMock[command];
    };

    recordCommandResult(
      { type: "global", id: "settings" },
      {
        label: "Saved settings",
        status: "success",
        message: "Updated the bundled runtime preference.",
      },
    );
    recordCommandResult(
      { type: "tool", tool: "claude" },
      {
        label: "Switched Claude Code",
        status: "error",
        message: "The selected profile needs attention before it can be applied.",
        remediation: "Open the profile and refresh credentials.",
      },
    );

    await renderApp();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Activity" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Activity" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inspect Switched Claude Code" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Inspect Saved settings" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Inspect Switched Claude Code" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Switched Claude Code" })).toBeInTheDocument();
      expect(
        screen.getAllByText("The selected profile needs attention before it can be applied.").length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByText("Command details were not recorded for this event."),
      ).toBeInTheDocument();
      expect(screen.getAllByText("Open the profile and refresh credentials.").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Export support report" })[0]);

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "export_diagnostic_bundle")).toBe(true);
      expect(screen.getByText("Support report ready")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Log File" }));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "export_activity_log")).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Inspect Saved settings" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Saved settings" })).toBeInTheDocument();
      expect(screen.getAllByText("Updated the bundled runtime preference.").length).toBeGreaterThan(0);
      expect(screen.getByText("Snapshot updated successfully.")).toBeInTheDocument();
      expect(
        screen.getByText("No extra recovery steps were recorded for this event."),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(screen.getAllByText("No recent activity").length).toBeGreaterThan(0);
      expect(screen.getByText("Cleared locally stored desktop activity.")).toBeInTheDocument();
    });
  });

  it("keeps a persisted activity timeline even when the same scope records multiple events", async () => {
    recordCommandResult(
      { type: "global", id: "settings" },
      {
        label: "Saved settings",
        status: "success",
        message: "Updated bundled runtime settings.",
      },
    );
    recordCommandResult(
      { type: "global", id: "settings" },
      {
        label: "Checked for updates",
        status: "error",
        message: "The update endpoint did not respond.",
        remediation: "Try again after verifying the selected update channel.",
      },
    );

    await renderApp();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Activity" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Activity" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inspect Saved settings" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Inspect Checked for updates" })).toBeInTheDocument();
      expect(screen.getByText("Recent events stay on this computer and persist across relaunches.")).toBeInTheDocument();
    });

    expect(window.localStorage.getItem("ai-switch.desktop.activity-log")).toContain(
      "Checked for updates",
    );
    expect(window.localStorage.getItem("ai-switch.desktop.activity-log")).toContain(
      "Saved settings",
    );
  });

  it("shows compatibility blockers when runtime is not usable", async () => {
    window.__AISW_DESKTOP_MOCK__ = {
      get_bootstrap: {
        ...bootstrap,
        settings: {
          ...bootstrap.settings,
          runtime_kind: "system",
        },
        runtime_status: {
          ...bootstrap.runtime_status,
          compatible: false,
          version: null,
          capabilities: null,
          issues: [
            "Engine version details are unavailable",
            "Engine capability details are unavailable",
          ],
        },
        snapshot: null,
      },
    };
    await renderApp();
    await waitFor(() => {
      expect(screen.getByText("Finish setup")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "AI Switch Desktop uses the included switching engine. A separate command-line install on this Mac cannot power the desktop app yet.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your saved profiles stay local. Switch back to the included desktop engine to continue, or open Engine Settings only if you intentionally manage another compatible engine.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Using now")).toBeInTheDocument();
    expect(screen.getByText("System engine")).toBeInTheDocument();
    expect(screen.getByText("Desktop app needs")).toBeInTheDocument();
    expect(screen.getByText("Included desktop engine")).toBeInTheDocument();
    expect(screen.getByText("Next step")).toBeInTheDocument();
    expect(
      screen.getByText("Why setup paused"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Included Engine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Engine Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Engine" })).not.toBeInTheDocument();
    expect(screen.queryByText("Runtime summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Get started")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("can open advanced runtime settings from the blocker screen", async () => {
    window.__AISW_DESKTOP_MOCK__ = {
      get_bootstrap: {
        ...bootstrap,
        settings: {
          ...bootstrap.settings,
          runtime_kind: "system",
        },
        runtime_status: {
          ...bootstrap.runtime_status,
          compatible: false,
          version: null,
          capabilities: null,
          issues: ["Engine capability details are unavailable"],
        },
        snapshot: null,
      },
    };

    await renderApp();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Engine Settings" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Engine Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Engine" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Engine summary")).toBeInTheDocument();
    });
  });

  it("switches back to the included runtime from the blocker screen", async () => {
    const calls: Array<{ command: string; args?: unknown }> = [];
    let currentSettings: DesktopSettings = {
      ...bootstrap.settings,
      runtime_kind: "system",
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "get_bootstrap") {
        return {
          ...bootstrap,
          settings: currentSettings,
          runtime_status: {
            ...bootstrap.runtime_status,
            compatible: currentSettings.runtime_kind === "bundled",
            version:
              currentSettings.runtime_kind === "bundled"
                ? bootstrap.runtime_status.version
                : null,
            capabilities:
              currentSettings.runtime_kind === "bundled"
                ? bootstrap.runtime_status.capabilities
                : null,
            issues:
              currentSettings.runtime_kind === "bundled"
                ? []
                : ["Engine capability details are unavailable"],
          },
          snapshot:
            currentSettings.runtime_kind === "bundled" ? bootstrap.snapshot : null,
        };
      }
      if (command === "get_snapshot") {
        return bootstrap.snapshot;
      }
      if (command === "update_settings") {
        currentSettings = {
          ...currentSettings,
          ...(args as { request: DesktopSettings }).request,
        };
        return currentSettings;
      }
      return (window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>)[command];
    };

    await renderApp();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use Included Engine" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Use Included Engine" }));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "update_settings")).toBe(true);
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    });

    expect(calls).toContainEqual({
      command: "update_settings",
      args: {
        request: {
          runtime_kind: "bundled",
          runtime_path: null,
          aisw_home: null,
          update_channel: "stable",
          profile_labels: {},
          profile_sets: [],
        },
      },
    });
  });

  it("shows bootstrap failure details and remediation", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "get_bootstrap") {
        throw {
          kind: "aisw_not_found",
          message: "AI Switch could not resolve a compatible runtime",
          remediation: "Select a valid bundled, system, or custom runtime.",
        };
      }
      return undefined;
    };

    await renderApp();
    await waitFor(() => {
      expect(screen.getByText("AI Switch could not open this window.")).toBeInTheDocument();
    });
    expect(screen.getByText("AI Switch could not resolve a compatible runtime")).toBeInTheDocument();
    expect(
      screen.getByText("Select a valid bundled, system, or custom runtime."),
    ).toBeInTheDocument();
  });

  it("shows install and PATH guidance when a tool binary is missing", async () => {
    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: {
        ...bootstrap,
        snapshot: {
          ...bootstrap.snapshot,
          statuses: [
            ...bootstrap.snapshot.statuses,
            {
              tool: "gemini",
              binary_found: false,
              stored_profiles: 0,
              active_profile: null,
              auth_method: null,
              credential_backend: null,
              state_mode: null,
              active_profile_applied: null,
              credentials_present: false,
              permissions_ok: true,
            },
          ],
        },
      },
      get_snapshot: {
        ...bootstrap.snapshot,
        statuses: [
          ...bootstrap.snapshot.statuses,
          {
            tool: "gemini",
            binary_found: false,
            stored_profiles: 0,
            active_profile: null,
            auth_method: null,
            credential_backend: null,
            state_mode: null,
            active_profile_applied: null,
            credentials_present: false,
            permissions_ok: true,
          },
        ],
      },
    };

    await renderApp();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inspect Gemini" })).toBeInTheDocument();
    });
    selectOverviewTool("Gemini");
    const overviewCard = screen
      .getByText("Gemini CLI is not available on PATH, so this computer cannot switch or verify that tool yet.")
      .closest(".tool-card");
    if (!(overviewCard instanceof HTMLElement)) {
      throw new Error("Missing Gemini overview card.");
    }
    const overview = within(overviewCard);
    expect(overview.getByText("Install command:")).toBeInTheDocument();
    expect(overview.getByText("npm install -g @google/gemini-cli")).toBeInTheDocument();
    expect(overview.getByText("Confirm installation:")).toBeInTheDocument();
    expect(overview.getByText("gemini --version")).toBeInTheDocument();
    expect(overview.getByText("Check terminal path:")).toBeInTheDocument();
    expect(overview.getByText("which gemini")).toBeInTheDocument();

    fireEvent.click(overview.getByText("Open installation guide"));
    expect(window.open).toHaveBeenCalledWith(
      "https://www.npmjs.com/package/@google/gemini-cli",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens the profiles screen from overview details actions", async () => {
    const codexStatus = {
      tool: "codex",
      binary_found: true,
      stored_profiles: 1,
      active_profile: "personal",
      auth_method: "api_key",
      credential_backend: "file",
      state_mode: "shared",
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: true,
      warnings: [],
    };

    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: {
        ...bootstrap,
        snapshot: {
          ...bootstrap.snapshot,
          statuses: [...bootstrap.snapshot.statuses, codexStatus],
          profiles: {
            ...bootstrap.snapshot.profiles,
            codex: {
              active: "personal",
              profiles: [{ name: "personal", auth: "api_key", label: "Personal" }],
            },
          },
        },
      },
      get_snapshot: {
        ...bootstrap.snapshot,
        statuses: [...bootstrap.snapshot.statuses, codexStatus],
        profiles: {
          ...bootstrap.snapshot.profiles,
          codex: {
            active: "personal",
            profiles: [{ name: "personal", auth: "api_key", label: "Personal" }],
          },
        },
      },
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    selectOverviewTool("Codex");
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));

    await waitFor(() => {
      expect(screen.getByText("Saved profiles", { selector: ".section-kicker" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Codex")).toBeInTheDocument();
      expect(screen.getByText("Health details")).toBeInTheDocument();
      expect(screen.getByText("No additional token or runtime warnings are currently reported for this tool.")).toBeInTheDocument();
      expect(screen.getByLabelText("Current tool")).toHaveValue("codex");
    });
  });

  it("filters the profile inventory by search query and tool segment", async () => {
    const codexStatus = {
      tool: "codex",
      binary_found: true,
      stored_profiles: 1,
      active_profile: "sandbox",
      auth_method: "api_key",
      credential_backend: "file",
      state_mode: "isolated",
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: true,
      warnings: [],
    };

    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: {
        ...bootstrap,
        snapshot: {
          ...bootstrap.snapshot,
          statuses: [...bootstrap.snapshot.statuses, codexStatus],
          profiles: {
            ...bootstrap.snapshot.profiles,
            codex: {
              active: "sandbox",
              profiles: [{ name: "sandbox", auth: "api_key", label: "Sandbox" }],
            },
          },
        },
      },
      get_snapshot: {
        ...bootstrap.snapshot,
        statuses: [...bootstrap.snapshot.statuses, codexStatus],
        profiles: {
          ...bootstrap.snapshot.profiles,
          codex: {
            active: "sandbox",
            profiles: [{ name: "sandbox", auth: "api_key", label: "Sandbox" }],
          },
        },
      },
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));

    expect(screen.getAllByText("Work").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sandbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(screen.getAllByText("Sandbox").length).toBeGreaterThan(0);
    expect(screen.queryByText("Work")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search Profiles"), {
      target: { value: "office" },
    });
    expect(screen.getByText("No matching profiles")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear Search Profiles" }));
    expect(screen.getByLabelText("Search Profiles")).toHaveValue("");
  });

  it("clears route-opened profile details when switching tools manually", async () => {
    const claudeStatus = {
      ...bootstrap.snapshot.statuses[0],
      stored_profiles: 2,
      active_profile: "personal",
      auth_method: "oauth",
      credential_backend: "system_keyring",
      state_mode: "isolated",
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: true,
      warnings: [],
    };
    const codexStatus = {
      tool: "codex",
      binary_found: true,
      stored_profiles: 2,
      active_profile: "personal",
      auth_method: "api_key",
      credential_backend: "file",
      state_mode: "shared",
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: true,
      warnings: [],
    };

    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: {
        ...bootstrap,
        snapshot: {
          ...bootstrap.snapshot,
          statuses: [claudeStatus, codexStatus],
          profiles: {
            claude: {
              active: "personal",
              profiles: [
                { name: "work", auth: "oauth", label: "Work" },
                { name: "personal", auth: "oauth", label: "Personal" },
              ],
            },
            codex: {
              active: "personal",
              profiles: [
                { name: "work", auth: "api_key", label: "Work" },
                { name: "personal", auth: "api_key", label: "Personal" },
              ],
            },
          },
        },
      },
      get_snapshot: {
        ...bootstrap.snapshot,
        statuses: [claudeStatus, codexStatus],
        profiles: {
          claude: {
            active: "personal",
            profiles: [
              { name: "work", auth: "oauth", label: "Work" },
              { name: "personal", auth: "oauth", label: "Personal" },
            ],
          },
          codex: {
            active: "personal",
            profiles: [
              { name: "work", auth: "api_key", label: "Work" },
              { name: "personal", auth: "api_key", label: "Personal" },
            ],
          },
        },
      },
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    selectOverviewTool("Codex");
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Codex")).toBeInTheDocument();
      expect(screen.getByText("Health details")).toBeInTheDocument();
      expect(screen.getByText("Auth method: api_key")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Current tool"), {
      target: { value: "claude" },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Claude")).toBeInTheDocument();
    });
    expect(screen.queryByText("Health details")).not.toBeInTheDocument();
  });

  it("clears routed profile details when reopening profiles from the sidebar", async () => {
    const codexStatus = {
      tool: "codex",
      binary_found: true,
      stored_profiles: 1,
      active_profile: "personal",
      auth_method: "api_key",
      credential_backend: "file",
      state_mode: "shared",
      active_profile_applied: true,
      credentials_present: true,
      permissions_ok: true,
      warnings: [],
    };

    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: {
        ...bootstrap,
        snapshot: {
          ...bootstrap.snapshot,
          statuses: [...bootstrap.snapshot.statuses, codexStatus],
          profiles: {
            ...bootstrap.snapshot.profiles,
            codex: {
              active: "personal",
              profiles: [{ name: "personal", auth: "api_key", label: "Personal" }],
            },
          },
        },
      },
      get_snapshot: {
        ...bootstrap.snapshot,
        statuses: [...bootstrap.snapshot.statuses, codexStatus],
        profiles: {
          ...bootstrap.snapshot.profiles,
          codex: {
            active: "personal",
            profiles: [{ name: "personal", auth: "api_key", label: "Personal" }],
          },
        },
      },
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    selectOverviewTool("Codex");
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Codex")).toBeInTheDocument();
      expect(screen.getByText("Health details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Profiles" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Claude")).toBeInTheDocument();
    });
    expect(screen.queryByText("Health details")).not.toBeInTheDocument();
  });

  it("clears routed settings sections when reopening settings from a fresh entry point", async () => {
    const firstRunSnapshot = {
      statuses: [
        {
          tool: "claude",
          binary_found: true,
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        claude: {
          active: null,
          profiles: [],
        },
      },
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: firstRunSnapshot,
          },
          get_snapshot: firstRunSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "",
            manual_apply_examples: [],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc",
                reload_command: "source ~/.zshrc",
                verify_command: "echo \"$AISW_SHELL_HOOK\"",
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0),
    );
    openSetupStep("Terminal");
    await waitFor(() => expect(screen.getByText("Open terminal setup")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Open terminal setup"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Terminal Integration" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Terminal Integration" })).toHaveAttribute("aria-pressed", "true");
    });

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-settings"]?.({});
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Engine summary")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Engine" })).toHaveAttribute("aria-pressed", "true");
    });
    expect(screen.getByRole("button", { name: "Terminal Integration" })).toHaveAttribute("aria-pressed", "false");
  });

  it("surfaces token warnings in the overview cards", async () => {
    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: {
        ...bootstrap,
        snapshot: {
          ...bootstrap.snapshot,
          statuses: [
            {
              ...bootstrap.snapshot.statuses[0],
              token_warning: {
                severity: "warn",
                summary: "Claude session expires soon",
                expires_in_days: 2,
              },
              warnings: [
                {
                  code: "token_expiry",
                  message: "Refresh Claude authentication soon.",
                  remediation: "Run the guided OAuth flow again.",
                },
              ],
            },
          ],
        },
      },
      get_snapshot: {
        ...bootstrap.snapshot,
        statuses: [
          {
            ...bootstrap.snapshot.statuses[0],
            token_warning: {
              severity: "warn",
              summary: "Claude session expires soon",
              expires_in_days: 2,
            },
            warnings: [
              {
                code: "token_expiry",
                message: "Refresh Claude authentication soon.",
                remediation: "Run the guided OAuth flow again.",
              },
            ],
          },
        ],
      },
    };

    await renderApp();
    await waitFor(() => {
      expect(screen.getByText("Token warning: Claude session expires soon Expires in 2 days.")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Warning: Refresh Claude authentication soon. Remediation: Run the guided OAuth flow again.",
      ),
    ).toBeInTheDocument();
  });

  it("refreshes snapshot state after a failed switch to show the rolled-back profile", async () => {
    const staleSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        {
          ...bootstrap.snapshot.statuses[0],
          tool: "claude",
          active_profile: "work",
        },
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 2,
          active_profile: "work",
          auth_method: "api_key",
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: true,
          credentials_present: true,
          permissions_ok: true,
        },
      ],
      profiles: {
        claude: {
          active: "work",
          profiles: [
            { name: "work", auth: "oauth", label: "Work" },
            { name: "personal", auth: "oauth", label: "Personal" },
          ],
        },
        codex: {
          active: "work",
          profiles: [
            { name: "work", auth: "api_key", label: "Work" },
            { name: "personal", auth: "api_key", label: "Personal" },
          ],
        },
      },
    };
    const rolledBackSnapshot = {
      ...staleSnapshot,
      statuses: staleSnapshot.statuses.map((entry) => ({
        ...entry,
        active_profile: "personal",
      })),
      profiles: {
        claude: {
          active: "personal",
          profiles: staleSnapshot.profiles.claude.profiles,
        },
        codex: {
          active: "personal",
          profiles: staleSnapshot.profiles.codex.profiles,
        },
      },
    };
    let snapshotReads = 0;

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "use_all_profiles") {
        throw new Error("switch failed");
      }
      if (command === "get_snapshot") {
        snapshotReads += 1;
        return snapshotReads === 1 ? staleSnapshot : rolledBackSnapshot;
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: staleSnapshot,
          },
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getAllByRole("heading", { name: "Work" }).length).toBeGreaterThan(0));
    const quickSwitchDialog = await openQuickSwitchDialog();
    fireEvent.click(quickSwitchDialog.getByRole("option", { name: /Work.*Across/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "Personal" }).length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Last bulk result: switch failed")).toBeInTheDocument();
  });

  it("shows the last successful tool command result on the overview card", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    fireEvent.click(screen.getByText("Re-apply Work"));

    await waitFor(() => {
      expect(screen.getByText("Last result: Switched Claude to Work.")).toBeInTheDocument();
    });
    expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
  });

  it("uses saved profile labels in overview switch results", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const settingsWithLabels: DesktopSettings = {
      ...bootstrap.settings,
      profile_labels: {
        codex: {
          work: "Code Work",
        },
      },
    };
    const codexSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        ...bootstrap.snapshot.statuses,
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "personal",
          auth_method: "api_key",
          credential_backend: "file",
          state_mode: "shared",
          active_profile_applied: true,
          credentials_present: true,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        ...bootstrap.snapshot.profiles,
        codex: {
          active: "personal",
          profiles: [
            { name: "work", auth: "api_key", label: "Work" },
            { name: "personal", auth: "api_key", label: "Personal" },
          ],
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_profile") {
        return { command, snapshot: codexSnapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithLabels,
            snapshot: codexSnapshot,
          },
          get_snapshot: codexSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithLabels,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    selectOverviewTool("Codex");
    fireEvent.change(screen.getByLabelText("Switch codex profile"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByText("Switch to Code Work"));

    await waitFor(() => {
      expect(screen.getByText("Last result: Switched Codex to Code Work.")).toBeInTheDocument();
    });
    expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
  });

  it("disables overview refresh actions while a mutation is in progress", async () => {
    let resolveUseProfile: ((value: unknown) => void) | undefined;
    const snapshotWithMissingTool = {
      ...bootstrap.snapshot,
      statuses: [
        ...bootstrap.snapshot.statuses,
        {
          tool: "gemini",
          binary_found: false,
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: null,
          state_mode: null,
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        ...bootstrap.snapshot.profiles,
        gemini: {
          active: null,
          profiles: [],
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "use_profile") {
        return await new Promise((resolve) => {
          resolveUseProfile = resolve;
        });
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: snapshotWithMissingTool,
          },
          get_snapshot: snapshotWithMissingTool,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    fireEvent.click(screen.getByText("Re-apply Work"));
    await waitFor(() => {
      expect(resolveUseProfile).toBeDefined();
    });

    expect(screen.getByRole("button", { name: "Refresh state" })).toBeDisabled();
    selectOverviewTool("Gemini");
    const geminiCard = screen
      .getByText("Gemini CLI is not available on PATH, so this computer cannot switch or verify that tool yet.")
      .closest(".tool-card");
    if (!(geminiCard instanceof HTMLElement)) {
      throw new Error("Missing Gemini tool card.");
    }
    expect(within(geminiCard).getByRole("button", { name: "Refresh" })).toBeDisabled();

    await act(async () => {
      resolveUseProfile?.({ command: "use_profile", snapshot: snapshotWithMissingTool });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh state" })).toBeEnabled();
      expect(within(geminiCard).getByRole("button", { name: "Refresh" })).toBeEnabled();
    });
  });

  it("switches a stored profile directly from the overview card", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const overviewSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        ...bootstrap.snapshot.statuses,
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 2,
          active_profile: "personal",
          auth_method: "api_key",
          credential_backend: "file",
          state_mode: "shared",
          active_profile_applied: true,
          credentials_present: true,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        ...bootstrap.snapshot.profiles,
        codex: {
          active: "personal",
          profiles: [
            { name: "work", auth: "api_key", label: "Work" },
            { name: "personal", auth: "api_key", label: "Personal" },
          ],
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_profile") {
        return { command, snapshot: overviewSnapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: overviewSnapshot,
          },
          get_snapshot: overviewSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    selectOverviewTool("Codex");
    fireEvent.change(screen.getByLabelText("Switch codex profile"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByText("Switch to Work"));

    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "use_profile" &&
            (entry.args as { request?: { tool?: string; profile?: string } })?.request?.tool === "codex" &&
            (entry.args as { request?: { tool?: string; profile?: string } })?.request?.profile === "work",
        ),
      ).toBe(true);
    });
  });

  it("renames and removes a profile through desktop commands", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "rename_profile" || command === "remove_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    fireEvent.change(screen.getByLabelText("rename work"), {
      target: { value: "client-acme" },
    });
    fireEvent.click(screen.getByText("Rename"));
    fireEvent.click(screen.getByText("Remove active…"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Remove Profile" })).getByRole("button", {
        name: "Remove active profile",
      }),
    );

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "rename_profile")).toBe(true);
      expect(calls.some((entry) => entry.command === "remove_profile")).toBe(true);
    });
  });

  it("stores a relabel override for an existing profile", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "update_settings") {
        return {
          ...bootstrap.settings,
          profile_labels: {
            claude: {
              work: "Acme Work",
            },
          },
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    fireEvent.change(screen.getByLabelText("label work"), {
      target: { value: "Acme Work" },
    });
    fireEvent.click(screen.getByText("Relabel"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "update_settings")).toBe(true);
    });

    expect(calls).toContainEqual({
      command: "update_settings",
      args: {
        request: {
          runtime_kind: "bundled",
          runtime_path: null,
          aisw_home: null,
          update_channel: "stable",
          profile_labels: {
            claude: {
              work: "Acme Work",
            },
          },
          profile_sets: [],
        },
      },
    });
  });

  it("shows active profile diagnostic details from the current tool status", async () => {
    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: {
        ...bootstrap,
        snapshot: {
          ...bootstrap.snapshot,
          statuses: [
            {
              ...bootstrap.snapshot.statuses[0],
              credentials_present: false,
              permissions_ok: false,
              token_warning: {
                summary: "Claude session expires soon",
                expires_in_days: 1,
              },
              warnings: [
                {
                  message: "Keyring access failed.",
                  remediation: "Unlock the local credential store and retry.",
                },
              ],
            },
          ],
        },
      },
      get_snapshot: {
        ...bootstrap.snapshot,
        statuses: [
          {
            ...bootstrap.snapshot.statuses[0],
            credentials_present: false,
            permissions_ok: false,
            token_warning: {
              summary: "Claude session expires soon",
              expires_in_days: 1,
            },
            warnings: [
              {
                message: "Keyring access failed.",
                remediation: "Unlock the local credential store and retry.",
              },
            ],
          },
        ],
      },
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    fireEvent.click(screen.getByText("Show health details"));

    await waitFor(() => {
      expect(screen.getByText("Health details")).toBeInTheDocument();
    });
    expect(screen.getByText("Credential backend: system_keyring")).toBeInTheDocument();
    expect(screen.getByText("Live match: yes")).toBeInTheDocument();
    expect(screen.getByText("Credentials present: no")).toBeInTheDocument();
    expect(screen.getByText("Local permissions: no")).toBeInTheDocument();
    expect(
      screen.getByText("Token warning: Claude session expires soon Expires in 1 days."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Warning: Keyring access failed. Remediation: Unlock the local credential store and retry.",
      ),
    ).toBeInTheDocument();
  });

  it("limits live runtime diagnostics to the active profile details", async () => {
    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: {
        ...bootstrap,
        snapshot: {
          ...bootstrap.snapshot,
          statuses: [
            {
              ...bootstrap.snapshot.statuses[0],
              credentials_present: false,
              permissions_ok: false,
              token_warning: {
                summary: "Claude session expires soon",
                expires_in_days: 1,
              },
              warnings: [
                {
                  message: "Keyring access failed.",
                  remediation: "Unlock the local credential store and retry.",
                },
              ],
            },
          ],
          profiles: {
            ...bootstrap.snapshot.profiles,
            claude: {
              active: "work",
              profiles: [
                { name: "work", auth: "oauth", label: "Work" },
                { name: "personal", auth: "oauth", label: "Personal" },
              ],
            },
          },
        },
      },
      get_snapshot: {
        ...bootstrap.snapshot,
        statuses: [
          {
            ...bootstrap.snapshot.statuses[0],
            credentials_present: false,
            permissions_ok: false,
            token_warning: {
              summary: "Claude session expires soon",
              expires_in_days: 1,
            },
            warnings: [
              {
                message: "Keyring access failed.",
                remediation: "Unlock the local credential store and retry.",
              },
            ],
          },
        ],
        profiles: {
          ...bootstrap.snapshot.profiles,
          claude: {
            active: "work",
            profiles: [
              { name: "work", auth: "oauth", label: "Work" },
              { name: "personal", auth: "oauth", label: "Personal" },
            ],
          },
        },
      },
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));

    selectProfileInventory("Claude", "Personal");
    fireEvent.click(screen.getByText("Show health details"));

    await waitFor(() => {
      expect(screen.getByText("Health details")).toBeInTheDocument();
    });
    expect(screen.getByText("Auth method: oauth")).toBeInTheDocument();
    expect(screen.getByText("Selected in AI Switch: no")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Live health details are only available for the active profile. Switch to this profile to inspect backend, live-match, token, and permission state.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Credential backend:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Live match:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Token warning:/)).not.toBeInTheDocument();
  });

  it("warns before adding a duplicate profile name", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "work" },
    });

    expect(
      screen.getByText(
        "Claude already has a profile named work. Choose a different name or rename the existing profile first.",
      ),
    ).toBeInTheDocument();
    expect(profileDialog.getByRole("button", { name: "Import" })).toBeDisabled();
    expect(calls.some((entry) => entry.command === "add_profile")).toBe(false);
  });

  it("keeps Gemini state mode non-configurable even when runtime capabilities advertise shared mode", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSnapshot: AppSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        ...bootstrap.snapshot.statuses.map((entry) => ({
          ...entry,
          warnings:
            "warnings" in entry && Array.isArray(entry.warnings) ? entry.warnings : [],
        })),
        {
          tool: "gemini",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "travel",
          auth_method: "oauth",
          credential_backend: "system_keyring",
          state_mode: null,
          active_profile_applied: true,
          credentials_present: true,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        ...bootstrap.snapshot.profiles,
        gemini: {
          active: "travel",
          profiles: [{ name: "travel", auth: "oauth", label: "Travel" }],
        },
      },
    };
    const geminiBootstrap = {
      ...bootstrap,
      runtime_status: {
        ...bootstrap.runtime_status,
        capabilities: {
          ...bootstrap.runtime_status.capabilities,
          tools: {
            gemini: {
              state_modes: ["isolated", "shared"],
              fail_closed_keyring_identity: false,
            },
          },
        },
      },
      snapshot: currentSnapshot,
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "add_profile") {
        currentSnapshot = {
          ...currentSnapshot,
          statuses: currentSnapshot.statuses.map((entry) =>
            entry.tool === "gemini"
              ? {
                  ...entry,
              stored_profiles: 2,
              active_profile: "travel-next",
              auth_method: "oauth",
              state_mode: null,
              warnings: [],
            }
              : entry,
          ),
          profiles: {
            ...currentSnapshot.profiles,
            gemini: {
              active: "travel-next",
              profiles: [
                ...currentSnapshot.profiles.gemini.profiles,
                { name: "travel-next", auth: "oauth", label: undefined },
              ],
            },
          },
        };
        return { command, snapshot: currentSnapshot };
      }
      if (command === "use_profile") {
        return { command, snapshot: currentSnapshot };
      }
      return (
        {
          get_bootstrap: {
            ...geminiBootstrap,
            snapshot: currentSnapshot,
          },
          get_snapshot: currentSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: geminiBootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Tool"), {
      target: { value: "gemini" },
    });

    expect(profileDialog.getByDisplayValue("Not configurable")).toBeDisabled();
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "travel-next" },
    });
    fireEvent.click(profileDialog.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "add_profile" &&
            (entry.args as { request?: { state_mode?: string | null } })?.request?.state_mode === null,
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByText("Overview"));

    selectOverviewTool("Gemini");
    const geminiCard = screen.getByText("Travel").closest(".tool-card");
    if (!(geminiCard instanceof HTMLElement)) {
      throw new Error("Missing Gemini overview card.");
    }
    const overview = within(geminiCard);
    expect(overview.getAllByRole("combobox")).toHaveLength(1);
    fireEvent.click(overview.getByRole("button", { name: "Re-apply Travel Next" }));

    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "use_profile" &&
            (entry.args as { request?: { tool?: string; state_mode?: string | null } })?.request?.tool === "gemini" &&
            (entry.args as { request?: { tool?: string; state_mode?: string | null } })?.request?.state_mode === null,
        ),
      ).toBe(true);
    });
  });

  it("surfaces duplicate profile failures in the profiles screen", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "add_profile") {
        throw new Error("duplicate profile");
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.click(profileDialog.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(screen.getByText("duplicate profile")).toBeInTheDocument();
    });
  });

  it("warns before renaming a profile to a duplicate name", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const duplicateSnapshot = {
      ...bootstrap.snapshot,
      profiles: {
        ...bootstrap.snapshot.profiles,
        claude: {
          active: "work",
          profiles: [
            { name: "work", auth: "oauth", label: "Work" },
            { name: "personal", auth: "oauth", label: "Personal" },
          ],
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: duplicateSnapshot,
          },
          get_snapshot: duplicateSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    selectProfileInventory("Claude", "Personal");
    fireEvent.change(screen.getByLabelText("rename personal"), {
      target: { value: "work" },
    });

    expect(
      screen.getByText(
        "Claude already has a profile named work. Choose a different name or rename the existing profile first.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
    expect(calls.some((entry) => entry.command === "rename_profile")).toBe(false);
  });

  it("shows remediation text for profile command failures", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "add_profile") {
        throw {
          kind: "KeyringUnavailable",
          message: "keyring unavailable",
          remediation: "Unlock the local credential store and retry.",
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.click(profileDialog.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "keyring unavailable Remediation: Unlock the local credential store and retry.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows missing-profile remediation when a stale profile is re-applied", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "use_profile") {
        throw {
          kind: "ProfileMissing",
          message: "profile work no longer exists",
          remediation: "Refresh profile state or recreate the missing profile before retrying.",
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    fireEvent.click(screen.getByText("Re-apply Work"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Last result: profile work no longer exists Remediation: Refresh profile state or recreate the missing profile before retrying.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("classifies non-interactive failures in diagnostics", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "add_profile") {
        throw {
          kind: "NonInteractiveMode",
          message: "interactive login required",
          remediation:
            "Rerun this flow in an interactive session or use a supported non-interactive import method.",
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          export_diagnostic_bundle: {
            path: "/tmp/ai-switch/ai-switch-diagnostics-123.json",
            filename: "ai-switch-diagnostics-123.json",
            generated_at: "unix:123",
          },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Without terminal integration, AI Switch still updates local credential files.",
            manual_apply_examples: [],
            variants: [],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.click(profileDialog.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(screen.getByText(/interactive login required/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Diagnostics"));

    await waitFor(() => {
      expect(screen.getAllByText("Non-interactive mode failure").length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          "Rerun this flow in an interactive session or use a supported non-interactive import method.",
        ).length,
      ).toBeGreaterThan(0);
    });
  });

  it("surfaces recent command failures in diagnostics", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "use_profile") {
        throw {
          kind: "ConfigLockTimeout",
          message: "config lock is busy",
          remediation: "Close other AI Switch windows or wait for the local config lock to clear, then retry.",
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    fireEvent.click(screen.getByText("Re-apply Work"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Last result: config lock is busy Remediation: Close other AI Switch windows or wait for the local config lock to clear, then retry.",
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Diagnostics"));

    let failureCard: HTMLElement;
    await waitFor(() => {
      const failureMatch = screen.getAllByText("Config lock timeout");
      failureCard = failureMatch[failureMatch.length - 1].closest("article") as HTMLElement;
      expect(failureCard).toBeInTheDocument();
      expect(within(failureCard).getByText("config lock is busy")).toBeInTheDocument();
      expect(
        within(failureCard).getByText(
          "Close other AI Switch windows or wait for the local config lock to clear, then retry.",
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(within(failureCard!).getByText("Open profile"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Health details" })).toBeInTheDocument();
    });
  });

  it("captures a profile from environment variables with the expected env hint", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "add_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Tool"), {
      target: { value: "codex" },
    });
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "ci" },
    });
    fireEvent.change(profileDialog.getByLabelText("Import mode"), {
      target: { value: "from_env" },
    });
    fireEvent.change(profileDialog.getByLabelText("Credential backend"), {
      target: { value: "system-keyring" },
    });

    expect(profileDialog.getByText("OPENAI_API_KEY")).toBeInTheDocument();
    fireEvent.click(profileDialog.getByRole("button", { name: "Save Profile" }));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "add_profile")).toBe(true);
    });

    expect(calls).toContainEqual({
      command: "add_profile",
      args: {
        request: {
          tool: "codex",
          profile: "ci",
          label: null,
          state_mode: "isolated",
          credential_backend: "system-keyring",
          import_mode: {
            kind: "from_env",
          },
        },
      },
    });
  });

  it("derives profile setup modes and backends from runtime capabilities", async () => {
    const capabilityBootstrap = {
      ...bootstrap,
      runtime_status: {
        ...bootstrap.runtime_status,
        capabilities: {
          features: {
            mutation_json: true,
          },
          tools: {
            claude: {
              auth_methods: ["from_env", "api_key"],
              state_modes: ["isolated", "shared"],
              credential_backends: ["file"],
              fail_closed_keyring_identity: false,
            },
          },
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = {
      get_bootstrap: capabilityBootstrap,
      get_snapshot: capabilityBootstrap.snapshot,
      run_init: { result: { live_accounts: [] } },
      run_doctor: { summary: { status: "pass" } },
      run_verify: { summary: { status: "pass" } },
      run_repair: { result: { mode: "dry_run" } },
      get_workspace_status: { result: { status: "match" } },
      get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
      list_backups: [],
      get_settings: capabilityBootstrap.settings,
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();

    const importModeSelect = profileDialog.getByLabelText("Import mode");
    expect(within(importModeSelect).getByRole("option", { name: "Read from environment" })).toBeInTheDocument();
    expect(within(importModeSelect).getByRole("option", { name: "Paste API key" })).toBeInTheDocument();
    expect(
      within(importModeSelect).queryByRole("option", { name: "Import current login" }),
    ).not.toBeInTheDocument();
    expect(
      within(importModeSelect).queryByRole("option", { name: "Sign in with OAuth" }),
    ).not.toBeInTheDocument();

    const backendSelect = profileDialog.getByLabelText("Credential backend");
    expect(backendSelect).toBeDisabled();
    expect(backendSelect).toHaveValue("file");
    expect(
      profileDialog.getByText("Claude profiles are always stored with file-backed credentials."),
    ).toBeInTheDocument();
  });

  it("falls back to legacy profile setup options when capability metadata is absent", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Tool"), {
      target: { value: "codex" },
    });

    const importModeSelect = profileDialog.getByLabelText("Import mode");
    expect(within(importModeSelect).getByRole("option", { name: "Import current login" })).toBeInTheDocument();
    expect(within(importModeSelect).getByRole("option", { name: "Read from environment" })).toBeInTheDocument();
    expect(within(importModeSelect).getByRole("option", { name: "Paste API key" })).toBeInTheDocument();
    expect(within(importModeSelect).getByRole("option", { name: "Sign in with OAuth" })).toBeInTheDocument();

    const backendSelect = profileDialog.getByLabelText("Credential backend");
    expect(backendSelect).not.toBeDisabled();
    expect(within(backendSelect).getByRole("option", { name: "Automatic" })).toBeInTheDocument();
    expect(within(backendSelect).getByRole("option", { name: "System keyring" })).toBeInTheDocument();
    expect(within(backendSelect).getByRole("option", { name: "File-backed" })).toBeInTheDocument();
  });

  it("routes onboarding live-account imports into supported profile setup when live import is unavailable", async () => {
    const onOpenProfiles = vi.fn();
    const capabilityBootstrap = {
      ...bootstrap,
      runtime_status: {
        ...bootstrap.runtime_status,
        capabilities: {
          features: {
            mutation_json: true,
          },
          tools: {
            claude: {
              auth_methods: ["from_env", "api_key"],
              state_modes: ["isolated", "shared"],
              credential_backends: ["file"],
              fail_closed_keyring_identity: false,
            },
          },
        },
      },
    };
    await renderSetupPanel({
      bootstrapOverride: capabilityBootstrap as unknown as AppBootstrap,
      initReport: {
        result: {
          live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
        },
      } as InitReport,
      onOpenProfiles,
    });

    expect(
      screen.getByText(
        "This release cannot save the current Claude Code login directly. Choose another sign-in method instead.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Choose sign-in method" }));

    expect(onOpenProfiles).toHaveBeenCalledWith("claude", { mode: "from_env" });
  });

  it("uses a focused sheet for onboarding live-account imports", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "add_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: {
            result: {
              live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
            },
          },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderSetupPanel({
      initReport: {
        result: {
          live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
        },
      } as InitReport,
    });
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0),
    );

    fireEvent.click(screen.getByRole("button", { name: "Import as profile" }));

    const dialog = getOnboardingImportDialog();
    expect(dialog.getByLabelText("Profile name")).toHaveValue("");

    fireEvent.change(dialog.getByLabelText("Profile name"), {
      target: { value: "work" },
    });

    await waitFor(() => {
      expect(dialog.getByLabelText("Label")).toHaveValue("Work account");
    });

    fireEvent.click(dialog.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      const addProfileCall = calls.find((entry) => entry.command === "add_profile");
      expect(addProfileCall).toBeDefined();
      expect(addProfileCall?.args).toMatchObject({
        request: expect.objectContaining({
          tool: "claude",
          profile: "work",
          label: "Work account",
        }),
      });
    });
  });

  it("opens supported profile setup instead of submitting unsupported live imports", async () => {
    const capabilityBootstrap = {
      ...bootstrap,
      runtime_status: {
        ...bootstrap.runtime_status,
        capabilities: {
          features: {
            mutation_json: true,
          },
          tools: {
            claude: {
              auth_methods: ["from_env", "api_key"],
              state_modes: ["isolated", "shared"],
              credential_backends: ["file"],
              fail_closed_keyring_identity: false,
            },
          },
        },
      },
      snapshot: {
        ...bootstrap.snapshot,
        statuses: [
          {
            ...bootstrap.snapshot.statuses[0],
            active_profile_applied: false,
          },
        ],
      },
    };
    window.__AISW_DESKTOP_MOCK__ = {
      ...window.__AISW_DESKTOP_MOCK__,
      get_bootstrap: capabilityBootstrap,
      get_snapshot: capabilityBootstrap.snapshot,
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open account setup" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open account setup" }));

    await waitFor(() => expect(getAddProfileDialog().getByLabelText("Tool")).toHaveValue("claude"));
    expect(getAddProfileDialog().getByLabelText("Tool")).toHaveValue("claude");
    expect(getAddProfileDialog().getByLabelText("Import mode")).toHaveValue("from_env");
    expect(getAddProfileDialog().queryByText("Sign in with OAuth")).not.toBeInTheDocument();
  });

  it("submits API keys via stdin payload and clears the field after save", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "add_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Tool"), {
      target: { value: "codex" },
    });
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.change(profileDialog.getByLabelText("Import mode"), {
      target: { value: "api_key" },
    });
    fireEvent.change(profileDialog.getByLabelText("Credential backend"), {
      target: { value: "file" },
    });

    const apiKeyInput = profileDialog.getByLabelText("API key") as HTMLInputElement;
    fireEvent.change(apiKeyInput, {
      target: { value: "sk-live-secret" },
    });
    expect(apiKeyInput.value).toBe("sk-live-secret");

    fireEvent.click(profileDialog.getByRole("button", { name: "Save Profile" }));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "add_profile")).toBe(true);
    });

    expect(calls).toContainEqual({
      command: "add_profile",
      args: {
        request: {
          tool: "codex",
          profile: "ops",
          label: null,
          state_mode: "isolated",
          credential_backend: "file",
          import_mode: {
            kind: "api_key",
            value: "sk-live-secret",
          },
        },
      },
    });
    expect(apiKeyInput.value).toBe("");
  });

  it("clears API keys from the field even when save fails", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "add_profile") {
        throw {
          kind: "keyring_unavailable",
          message: "keyring unavailable",
          remediation: "Unlock the local credential store and retry.",
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Tool"), {
      target: { value: "codex" },
    });
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.change(profileDialog.getByLabelText("Import mode"), {
      target: { value: "api_key" },
    });

    const apiKeyInput = profileDialog.getByLabelText("API key") as HTMLInputElement;
    fireEvent.change(apiKeyInput, {
      target: { value: "sk-live-secret" },
    });
    expect(apiKeyInput.value).toBe("sk-live-secret");

    fireEvent.click(profileDialog.getByRole("button", { name: "Save Profile" }));

    await waitFor(() => {
      expect(
        screen.getByText("keyring unavailable Remediation: Unlock the local credential store and retry."),
      ).toBeInTheDocument();
    });
    expect(apiKeyInput.value).toBe("");
  });

  it("does not store API keys in react-query mutation variables", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "add_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDesktopActions(), { wrapper });
    await act(async () => {
      await result.current.apiKeyProfileAction.submit({
        tool: "codex",
        profile: "ops",
        label: null,
        stateMode: "isolated",
        importMode: { kind: "api_key", value: "sk-live-secret" },
      });
    });

    expect(result.current.addProfileMutation.variables).toBeUndefined();
  });

  it("serializes desktop mutations through a shared queue", async () => {
    const calls: string[] = [];
    let resolveUseProfile: ((value: unknown) => void) | undefined;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "use_profile") {
        calls.push(command);
        return await new Promise((resolve) => {
          resolveUseProfile = resolve;
        });
      }
      if (command === "rename_profile") {
        calls.push(command);
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDesktopActions(), { wrapper });

    let firstMutation: Promise<unknown> | undefined;
    let secondMutation: Promise<unknown> | undefined;
    await act(async () => {
      firstMutation = result.current.useProfileMutation.mutateAsync({
        tool: "claude",
        profile: "work",
        stateMode: "isolated",
      });
      secondMutation = result.current.renameProfileMutation.mutateAsync({
        tool: "claude",
        oldName: "work",
        newName: "client-acme",
      });
      await Promise.resolve();
    });

    expect(calls).toEqual(["use_profile"]);
    expect(result.current.mutationLock.isBusy).toBe(true);

    await act(async () => {
      resolveUseProfile?.({ command: "use_profile", snapshot: bootstrap.snapshot });
      await firstMutation;
      await secondMutation;
    });

    expect(calls).toEqual(["use_profile", "rename_profile"]);
    expect(result.current.mutationLock.isBusy).toBe(false);
  });

  it("restores and re-activates a backup through desktop commands", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const settingsWithLabels: DesktopSettings = {
      ...bootstrap.settings,
      profile_labels: {
        codex: {
          personal: "Sandbox",
        },
      },
    };
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "restore_backup" || command === "use_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithLabels,
          },
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260325T114502Z-claude-work",
              tool: "claude",
              profile: "claude/work",
            },
            {
              backup_id: "20260326T094012Z-codex-personal",
              tool: "codex",
              profile: "codex/personal",
            },
          ],
          get_settings: settingsWithLabels,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Backups")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Backups"));
    await waitFor(() => expect(screen.getByText("Restore and activate")).toBeInTheDocument());
    expect(screen.getAllByText("Files first").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sandbox").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Affects Codex / Sandbox. Restore files only unless you explicitly re-activate this profile.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("20260326T094012Z-codex-personal")).toBeInTheDocument();
    const backupsSection = screen.getAllByRole("heading", { name: "Backups" })[1]?.closest(".section-card");
    const articles = backupsSection?.querySelectorAll(".list-row") ?? [];
    expect(articles[0]?.textContent).toContain("Sandbox");
    expect(articles[1]?.textContent).toContain("Work");
    fireEvent.click(screen.getByText("Copy backup ID"));
    await waitFor(() => {
      expect(screen.getByText("Copied backup id 20260326T094012Z-codex-personal.")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore and activate" }));
    const restoreDialog = screen.getByRole("dialog", { name: "Restore Backup" });
    expect(
      within(restoreDialog).getByText(
        "It will also switch the live profile again after the restore completes.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(restoreDialog).getByRole("button", { name: "Restore and activate" }));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "restore_backup")).toBe(true);
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
    });
  });

  it("preserves the tool state mode when a backup restore re-activates a profile", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const sharedModeBootstrap = {
      ...bootstrap,
      runtime_status: {
        ...bootstrap.runtime_status,
        capabilities: {
          ...bootstrap.runtime_status.capabilities,
          tools: {
            codex: {
              state_modes: ["shared", "isolated"],
              fail_closed_keyring_identity: false,
            },
          },
        },
      },
      snapshot: {
        ...bootstrap.snapshot,
        statuses: [
          ...bootstrap.snapshot.statuses,
          {
            tool: "codex",
            binary_found: true,
            stored_profiles: 2,
            active_profile: "work",
            auth_method: "api_key",
            credential_backend: "file",
            state_mode: "shared",
            active_profile_applied: true,
            credentials_present: true,
            permissions_ok: true,
            warnings: [],
          },
        ],
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "restore_backup" || command === "use_profile") {
        return { command, snapshot: sharedModeBootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: sharedModeBootstrap,
          get_snapshot: sharedModeBootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260326T094012Z-codex-personal",
              tool: "codex",
              profile: "codex/personal",
            },
          ],
          get_settings: sharedModeBootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Backups")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Backups"));
    await waitFor(() => expect(screen.getByText("Restore and activate")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Restore and activate" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Restore Backup" })).getByRole("button", {
        name: "Restore and activate",
      }),
    );

    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "use_profile" &&
            (entry.args as { request?: { tool?: string; profile?: string; state_mode?: string | null } })
              ?.request?.tool === "codex" &&
            (entry.args as { request?: { tool?: string; profile?: string; state_mode?: string | null } })
              ?.request?.profile === "personal" &&
            (entry.args as { request?: { tool?: string; profile?: string; state_mode?: string | null } })
              ?.request?.state_mode === "shared",
        ),
      ).toBe(true);
    });
  });

  it("uses backup created_at metadata for ordering and display", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "legacy-codex-personal",
              tool: "codex",
              profile: "codex/personal",
              created_at: "2026-03-26T09:40:12Z",
            },
            {
              backup_id: "legacy-claude-work",
              tool: "claude",
              profile: "claude/work",
              created_at: "2026-03-25T11:45:02Z",
            },
          ],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await waitFor(() => expect(screen.getByText("Backups")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Backups"));
    await waitFor(() => expect(screen.getByText("Copy backup ID")).toBeInTheDocument());

    const backupsSection = screen.getAllByRole("heading", { name: "Backups" })[1]?.closest(".section-card");
    const articles = backupsSection?.querySelectorAll(".list-row") ?? [];
    expect(articles[0]?.textContent).toContain("Personal");
    expect(articles[1]?.textContent).toContain("Work");
    expect(screen.queryByText("Created: Unknown")).not.toBeInTheDocument();
  });

  it("warns before restoring backup files without activating the profile", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "restore_backup") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260326T094012Z-codex-personal",
              tool: "codex",
              profile: "codex/personal",
            },
          ],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Backups")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Backups"));
    await waitFor(() => expect(screen.getByText("Restore files only")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Restore files only" }));
    const restoreDialog = screen.getByRole("dialog", { name: "Restore Backup" });
    expect(
      within(restoreDialog).getByText(
        "It will not change the active account until you activate it later.",
      ),
    ).toBeInTheDocument();
    expect(calls.some((entry) => entry.command === "restore_backup")).toBe(false);

    fireEvent.click(within(restoreDialog).getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "restore_backup")).toBe(true);
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(false);
    });
  });

  it("opens profile details directly from a backup row", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260325T114502Z-claude-work",
              tool: "claude",
              profile: "claude/work",
            },
          ],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await waitFor(() => expect(screen.getByText("Backups")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Backups"));
    await waitFor(() => expect(screen.getByText(/Open profile details/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Open profile details/i));

    await waitFor(() => {
      expect(screen.getByLabelText("Current tool")).toHaveValue("claude");
      expect(screen.getByDisplayValue("Claude")).toBeInTheDocument();
      expect(screen.getByText("Hide health details")).toBeInTheDocument();
    });
  });

  it("runs guided OAuth capture from the profiles screen", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let oauthHandler: ((payload: unknown) => void) | undefined;
    window.__AISW_DESKTOP_LISTEN__ = async (event, handler) => {
      if (event === "oauth-progress") {
        oauthHandler = handler as (payload: unknown) => void;
      }
      return () => {
        oauthHandler = undefined;
      };
    };
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "add_profile_oauth") {
        oauthHandler?.({
          type: "started",
          seq: 1,
          command: "add",
          tool: "claude",
          profile: "personal",
        });
        oauthHandler?.({
          type: "info",
          seq: 2,
          command: "add",
          tool: "claude",
          profile: "personal",
          phase: "starting_upstream_auth",
          message: "Launching Claude login",
        });
        oauthHandler?.({
          type: "waiting_for_user",
          seq: 3,
          command: "add",
          tool: "claude",
          profile: "personal",
          phase: "waiting_for_user",
          safe_to_cancel: true,
          message: "Complete login in the browser or terminal",
        });
        oauthHandler?.({
          type: "info",
          seq: 4,
          command: "add",
          tool: "claude",
          profile: "personal",
          phase: "applying_changes",
          message: "Saving captured credentials",
        });
        oauthHandler?.({
          type: "result",
          seq: 5,
          command: "add",
          tool: "claude",
          profile: "personal",
          ok: true,
          result: {
            tool: "claude",
            profile: "personal",
            auth_method: "oauth",
          },
        });
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    const profileDialog = await openAddProfileDialog();
    fireEvent.change(profileDialog.getByLabelText("Profile name"), {
      target: { value: "personal" },
    });
    fireEvent.change(profileDialog.getByLabelText("Import mode"), {
      target: { value: "oauth" },
    });
    fireEvent.click(profileDialog.getByText("Start Sign In"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "add_profile_oauth")).toBe(true);
      expect(screen.getByText("OAuth progress")).toBeInTheDocument();
      expect(screen.getByText("1. Starting Claude login")).toBeInTheDocument();
      expect(screen.getByText("2. Browser opens")).toBeInTheDocument();
      expect(screen.getByText("3. Complete login in browser")).toBeInTheDocument();
      expect(screen.getByText("4. Waiting for credential capture")).toBeInTheDocument();
      expect(screen.getByText("5. Profile saved")).toBeInTheDocument();
      expect(screen.getByText("Preparing the native login flow.")).toBeInTheDocument();
      expect(screen.getByText("Launching Claude login")).toBeInTheDocument();
      expect(screen.getByText("Complete login in the browser or terminal")).toBeInTheDocument();
      expect(screen.getByText("Saving captured credentials")).toBeInTheDocument();
    });
  });

  it("restores the latest backup directly from a profile row", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "restore_backup" || command === "use_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260325T114502Z-claude-work",
              tool: "claude",
              profile: "claude/work",
            },
          ],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    await waitFor(() => expect(screen.getByText("Restore latest + activate")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Restore latest + activate"));
    expect(
      within(screen.getByRole("dialog", { name: "Restore Latest Backup" })).getByText(
        "It will also switch the live profile again after the restore completes.",
      ),
    ).toBeInTheDocument();
    expect(calls.some((entry) => entry.command === "restore_backup")).toBe(false);
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Restore Latest Backup" })).getByRole("button", {
        name: "Restore latest + activate",
      }),
    );

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "restore_backup")).toBe(true);
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
    });
  });

  it("opens profile row actions and routes remove through the confirmation sheet", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));

    fireEvent.click(screen.getByRole("button", { name: "Open actions for Claude Work" }));

    await waitFor(() => {
      expect(screen.getByRole("menu", { name: "Profile row actions" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Remove…" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Remove Profile" })).toBeInTheDocument();
      expect(screen.getByText("Claude / Work")).toBeInTheDocument();
    });
  });

  it("focuses the rename field when rename is chosen from a profile row menu", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));

    fireEvent.click(screen.getByRole("button", { name: "Open actions for Claude Work" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Rename…" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));

    await waitFor(() => {
      expect(screen.getByLabelText("rename work")).toHaveFocus();
    });
  });

  it("uses saved labels in latest profile backup confirmations", async () => {
    const labeledSettings: DesktopSettings = {
      ...bootstrap.settings,
      profile_labels: {
        claude: {
          work: "Office",
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: labeledSettings,
          },
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260325T114502Z-claude-work",
              tool: "claude",
              profile: "claude/work",
            },
          ],
          get_settings: labeledSettings,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    await waitFor(() => expect(screen.getByText("Restore latest + activate")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Restore latest + activate"));
    expect(
      within(screen.getByRole("dialog", { name: "Restore Latest Backup" })).getByText(
        "This restores the latest saved files for Claude / Office.",
      ),
    ).toBeInTheDocument();
  });

  it("chooses the newest matching backup when restoring latest from a profile row", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "restore_backup" || command === "use_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260325T114502Z-claude-work",
              tool: "claude",
              profile: "claude/work",
            },
            {
              backup_id: "20260327T121500Z-claude-work",
              tool: "claude",
              profile: "claude/work",
            },
          ],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    await waitFor(() => expect(screen.getByText("Restore latest + activate")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Restore latest + activate"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Restore Latest Backup" })).getByRole("button", {
        name: "Restore latest + activate",
      }),
    );

    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "restore_backup" &&
            (entry.args as { backup_id?: string })?.backup_id === "20260327T121500Z-claude-work",
        ),
      ).toBe(true);
    });
  });

  it("uses the selected state mode when restoring and re-activating from profiles", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const sharedModeBootstrap = {
      ...bootstrap,
      runtime_status: {
        ...bootstrap.runtime_status,
        capabilities: {
          ...bootstrap.runtime_status.capabilities,
          tools: {
            codex: {
              state_modes: ["isolated", "shared"],
              fail_closed_keyring_identity: false,
            },
          },
        },
      },
      snapshot: {
        ...bootstrap.snapshot,
        statuses: [
          ...bootstrap.snapshot.statuses,
          {
            tool: "codex",
            binary_found: true,
            stored_profiles: 2,
            active_profile: "work",
            auth_method: "api_key",
            credential_backend: "file",
            state_mode: "isolated",
            active_profile_applied: true,
            credentials_present: true,
            permissions_ok: true,
            warnings: [],
          },
        ],
        profiles: {
          ...bootstrap.snapshot.profiles,
          codex: {
            active: "work",
            profiles: [
              { name: "work", auth: "api_key", label: "Work" },
              { name: "personal", auth: "api_key", label: "Personal" },
            ],
          },
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "restore_backup" || command === "use_profile") {
        return { command, snapshot: sharedModeBootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: sharedModeBootstrap,
          get_snapshot: sharedModeBootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260325T114502Z-codex-work",
              tool: "codex",
              profile: "codex/work",
            },
          ],
          get_settings: sharedModeBootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    fireEvent.change(getProfilesSection().getByLabelText("Current tool"), {
      target: { value: "codex" },
    });
    fireEvent.click(getProfilesSection().getByRole("radio", { name: "Shared" }));
    await waitFor(() => expect(screen.getByText("Restore latest + activate")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Restore latest + activate"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Restore Latest Backup" })).getByRole("button", {
        name: "Restore latest + activate",
      }),
    );

    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "use_profile" &&
            (entry.args as { request?: { tool?: string; profile?: string; state_mode?: string | null } })
              ?.request?.tool === "codex" &&
            (entry.args as { request?: { tool?: string; profile?: string; state_mode?: string | null } })
              ?.request?.profile === "work" &&
            (entry.args as { request?: { tool?: string; profile?: string; state_mode?: string | null } })
              ?.request?.state_mode === "shared",
        ),
      ).toBe(true);
    });
  });

  it("warns before restoring the latest profile backup without re-activating", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "restore_backup") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [
            {
              backup_id: "20260325T114502Z-claude-work",
              tool: "claude",
              profile: "claude/work",
            },
          ],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    await waitFor(() => expect(screen.getByText("Restore latest")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Restore latest"));
    expect(
      within(screen.getByRole("dialog", { name: "Restore Latest Backup" })).getByText(
        "It will not activate this profile again until you switch to it explicitly.",
      ),
    ).toBeInTheDocument();
    expect(calls.some((entry) => entry.command === "restore_backup")).toBe(false);

    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Restore Latest Backup" })).getByRole("button", {
        name: "Restore",
      }),
    );

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "restore_backup")).toBe(true);
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(false);
    });
  });

  it("switches all tools to a shared profile", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_all_profiles") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    const quickSwitchDialog = await openQuickSwitchDialog();
    fireEvent.click(quickSwitchDialog.getByRole("option", { name: /Work.*Across/i }));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(true);
    });
  });

  it("supports Command-Enter in quick switch for matching profiles", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_all_profiles") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    const quickSwitchDialog = await openQuickSwitchDialog();
    const matchingProfileButton = quickSwitchDialog.getByRole("option", { name: /Work.*Across/i });
    fireEvent.mouseEnter(matchingProfileButton);
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(true);
    });
  });

  it("preserves shared state mode when switching all tools from overview", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const sharedBootstrap = {
      ...bootstrap,
      snapshot: {
        ...bootstrap.snapshot,
        statuses: [
          {
            ...bootstrap.snapshot.statuses[0],
            state_mode: "shared",
          },
          {
            tool: "codex",
            binary_found: true,
            stored_profiles: 1,
            active_profile: "work",
            auth_method: "api_key",
            credential_backend: "file",
            state_mode: "shared",
            active_profile_applied: true,
            credentials_present: true,
            permissions_ok: true,
            warnings: [],
          },
        ],
        profiles: {
          ...bootstrap.snapshot.profiles,
          codex: {
            active: "work",
            profiles: [{ name: "work", auth: "api_key", label: "Work" }],
          },
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_all_profiles") {
        return { command, snapshot: sharedBootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: sharedBootstrap,
          get_snapshot: sharedBootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: sharedBootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    const quickSwitchDialog = await openQuickSwitchDialog();
    fireEvent.click(quickSwitchDialog.getByRole("option", { name: /Work.*Across/i }));

    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "use_all_profiles" &&
            (entry.args as { request?: { state_mode?: string | null } })?.request?.state_mode ===
              "shared",
        ),
      ).toBe(true);
    });
  });

  it("runs the onboarding first switch flow", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_all_profiles") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: {
            result: {
              live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
            },
          },
          run_doctor: {
            checks: [{ name: "aisw home", status: "pass", detail: "ready" }],
          },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderSetupPanel({
      initReport: {
        result: {
          live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
        },
      },
    });

    expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0);
    openSetupStep("First switch");
    fireEvent.change(screen.getByLabelText("First switch profile"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByText("Switch now"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(true);
      expect(screen.getAllByText(/desktop engine/i).length).toBeGreaterThan(0);
    });
  });

  it("switches back to the AI Switch runtime from onboarding", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSettings: DesktopSettings = {
      ...bootstrap.settings,
      runtime_kind: "system",
      runtime_path: "/opt/homebrew/bin/aisw",
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "update_settings") {
        currentSettings = desktopSettingsSchema.parse((args as { request?: unknown }).request);
        return currentSettings;
      }
      return (
        {
          run_doctor: { checks: [], summary: { status: "pass" } },
          get_shell_guidance: { detected_shell: "zsh", capabilities: [], note: "", manual_apply_examples: [], variants: [] },
        } as Record<string, unknown>
      )[command];
    };

    await renderSetupPanel({
      bootstrapOverride: {
        ...bootstrap,
        settings: currentSettings,
        runtime_status: {
          ...bootstrap.runtime_status,
          compatible: false,
          issues: ["Engine capability details are unavailable"],
        },
      } as unknown as AppBootstrap,
      initReport: {
        result: {
          live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
        },
      },
    });

    openSetupStep("Welcome");
    fireEvent.click(screen.getByRole("button", { name: "Use Included Engine" }));

    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "update_settings" &&
            (entry.args as { request?: { runtime_kind?: string } })?.request?.runtime_kind === "bundled",
        ),
      ).toBe(true);
    });
  });

  it("imports the current login from a live mismatch card", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "add_profile") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: {
              ...bootstrap.snapshot,
              statuses: [
                {
                  ...bootstrap.snapshot.statuses[0],
                  active_profile_applied: false,
                },
              ],
            },
          },
          get_snapshot: {
            ...bootstrap.snapshot,
            statuses: [
              {
                ...bootstrap.snapshot.statuses[0],
                active_profile_applied: false,
              },
            ],
          },
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("import claude current login"), {
      target: { value: "recovered" },
    });
    fireEvent.click(screen.getByText("Import current as new"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "add_profile")).toBe(true);
      expect(screen.getByText("Live credentials changed outside the app. Re-apply the active profile or import the current login as a new profile.")).toBeInTheDocument();
    });
  });

  it("renders structured workspace details and saves bindings", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const settingsWithSet: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };
    const workspaceStatus = {
      result: {
        status: "mismatch",
        current_context: "work",
        expected_context: "client-acme",
        matched_binding: {
          scope: "path",
          path: "/code/acme",
          context: "client-acme",
        },
      },
    };
    const projectBindings = {
      result: {
        user_bindings: {
          guard_mode: "warn",
          default_context: "work",
          items: [
            {
              scope: "path",
              path: "/code/acme",
              context: "client-acme",
            },
          ],
        },
      },
    };
    const workspaceSnapshot = {
      ...bootstrap.snapshot,
      workspace_status: workspaceStatus.result,
      project_bindings: projectBindings.result,
    };
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (
        command === "workspace_bind" ||
        command === "workspace_unbind" ||
        command === "activate_profile_set"
      ) {
        return { command, snapshot: workspaceSnapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithSet,
            snapshot: workspaceSnapshot,
          },
          get_snapshot: workspaceSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: workspaceStatus,
          get_project_bindings: projectBindings,
          list_backups: [],
          get_settings: settingsWithSet,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openProjectRulesSection();
    await waitFor(() => {
      expect(screen.getByText("Project mismatch")).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          element?.tagName === "P" && element.textContent?.trim() === "Expected set: Client Acme",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          element?.tagName === "P" && element.textContent?.trim() === "Current set: work",
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Use expected set now")[0]);
    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(true);
    });
    expect(
      screen.getByText("Last project-rule result: Switched to Client Acme for /code/acme."),
    ).toBeInTheDocument();
    expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
      title: "Project switch",
      body: "Switched to Client Acme for /code/acme.",
    });

    await openProjectRulesSection();
    await waitFor(() => {
      expect(screen.getByText(/Current set:\s*work/)).toBeInTheDocument();
      expect(screen.getByText(/Expected set:\s*Client Acme/)).toBeInTheDocument();
      expect(screen.getByText(/Guard mode:\s*warn/)).toBeInTheDocument();
      expect(screen.getByText(/Default set:\s*work/)).toBeInTheDocument();
      expect(screen.getByText("path · /code/acme")).toBeInTheDocument();
      expect(screen.getByText("Matched rule ✓")).toBeInTheDocument();
      expect(screen.getAllByText("Client Acme").length).toBeGreaterThan(0);
      expect(screen.getByText("Project mismatch")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Keep current set"));
    await waitFor(() => {
      expect(screen.queryByText("Project mismatch")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Rule Editor" }));
    fireEvent.change(screen.getByLabelText("Rule scope"), {
      target: { value: "path" },
    });
    fireEvent.change(screen.getByLabelText("Set"), {
      target: { value: "client-acme" },
    });
    fireEvent.change(screen.getByLabelText("Path"), {
      target: { value: "/code/next" },
    });
    fireEvent.click(screen.getByText("Save rule"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "workspace_bind")).toBe(true);
    });
    expect(screen.getByText("Last project-rule result: Saved project rule for Client Acme.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Rule Editor" }));
    expect(screen.getByRole("option", { name: "Saved set: Client Acme" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Remove this rule"));
    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "workspace_unbind")).toBe(true);
    });
    expect(
      calls.some(
        (entry) =>
          entry.command === "workspace_unbind" &&
          (entry.args as { target?: { scope?: string; path?: string } })?.target?.scope === "path" &&
          (entry.args as { target?: { scope?: string; path?: string } })?.target?.path === "/code/acme",
      ),
    ).toBe(true);
  });

  it("uses saved profile labels for workspace default context", async () => {
    const settingsWithSet = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };
    const workspaceStatus = {
      result: {
        status: "match",
        current_context: "client-acme",
        expected_context: "client-acme",
        matched_binding: {
          scope: "default",
          context: "client-acme",
        },
      },
    };
    const projectBindings = {
      result: {
        user_bindings: {
          guard_mode: "warn",
          default_context: "client-acme",
          items: [],
        },
      },
    };
    const workspaceSnapshot = {
      ...bootstrap.snapshot,
      workspace_status: workspaceStatus.result,
      project_bindings: projectBindings.result,
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithSet,
            snapshot: workspaceSnapshot,
          },
          get_snapshot: workspaceSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: workspaceStatus,
          get_project_bindings: projectBindings,
          list_backups: [],
          get_settings: settingsWithSet,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await openProjectRulesSection();
    await waitFor(() => {
      expect(screen.getByText(/Default set:\s*Client Acme/)).toBeInTheDocument();
      expect(screen.getByText(/Current set:\s*Client Acme/)).toBeInTheDocument();
      expect(screen.getByText(/Expected set:\s*Client Acme/)).toBeInTheDocument();
    });
  });

  it("labels workspace context targets correctly in overview and activates the native CLI context", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentContext = "work";
    const workspaceSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        {
          ...bootstrap.snapshot.statuses[0],
          state_mode: "shared",
        },
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "work",
          auth_method: "api_key",
          credential_backend: "file",
          state_mode: "shared",
          active_profile_applied: true,
          credentials_present: true,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        ...bootstrap.snapshot.profiles,
        codex: {
          active: "work",
          profiles: [{ name: "work", auth: "api_key", label: "Work" }],
        },
      },
      contexts: [
        {
          name: "client-acme",
          profiles: {
            claude: "work",
            codex: "work",
          },
        },
      ],
      workspace_status: {
        status: "mismatch",
        current_context: currentContext,
        expected_context: "client-acme",
        matched_binding: {
          scope: "path",
          path: "/code/acme",
          context: "client-acme",
        },
      },
      project_bindings: {
        user_bindings: {
          guard_mode: "warn",
          default_context: "none",
          items: [{ scope: "path", path: "/code/acme", context: "client-acme" }],
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_context") {
        currentContext = "client-acme";
        return { command, snapshot: workspaceSnapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: bootstrap.settings,
            snapshot: workspaceSnapshot,
          },
          get_snapshot: workspaceSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: {
            result: {
              status: currentContext === "client-acme" ? "match" : "mismatch",
              current_context: currentContext,
              expected_context: "client-acme",
              matched_binding: {
                scope: "path",
                path: "/code/acme",
                context: "client-acme",
              },
            },
          },
          get_project_bindings: {
            result: {
              user_bindings: {
                guard_mode: "warn",
                default_context: "none",
                items: [{ scope: "path", path: "/code/acme", context: "client-acme" }],
              },
            },
          },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    await waitFor(() => {
      const projectCard = screen.getByText("Expected set").closest(".overview-project-card");
      if (!(projectCard instanceof HTMLElement)) {
        throw new Error("Missing overview project card.");
      }
      expect(within(projectCard).getByText("client-acme")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Use expected set now")[0]);

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_context")).toBe(true);
    });
    expect(
      calls.some(
        (entry) =>
          entry.command === "use_context" &&
          (entry.args as { request?: { state_mode?: string | null } })?.request?.state_mode ===
            "shared",
      ),
    ).toBe(true);
    expect(
      screen.getByText("Last project result: Switched to client-acme for /code/acme."),
    ).toBeInTheDocument();
  });

  it("routes stale workspace recovery from overview into contexts management", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const staleWorkspaceSnapshot = {
      ...bootstrap.snapshot,
      contexts: [],
      workspace_status: {
        status: "mismatch",
        current_context: "work",
        expected_context: "client-acme",
        matched_binding: {
          scope: "path",
          path: "/code/acme",
          context: "client-acme",
        },
      },
      project_bindings: {
        user_bindings: {
          guard_mode: "warn",
          default_context: "none",
          items: [{ scope: "path", path: "/code/acme", context: "client-acme" }],
        },
      },
    };
    const settingsWithEmptyMatch: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: null, codex: null, gemini: null },
        },
      ],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithEmptyMatch,
            snapshot: staleWorkspaceSnapshot,
          },
          get_snapshot: staleWorkspaceSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: staleWorkspaceSnapshot.workspace_status },
          get_project_bindings: { result: staleWorkspaceSnapshot.project_bindings },
          list_backups: [],
          get_settings: settingsWithEmptyMatch,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getByText("Expected set")).toBeInTheDocument();
      expect(screen.getAllByText("Client Acme").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Open Sets").length).toBeGreaterThan(0);
    });

    const openSetsButtons = screen.getAllByText("Open Sets");
    fireEvent.click(openSetsButtons[openSetsButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Set Library" })).toBeInTheDocument();
    });
    expect(calls.some((entry) => entry.command === "use_context")).toBe(false);
    expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(false);
  });

  it("uses saved profile-set labels in CLI context activation results", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const settingsWithSet: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };
    let currentContext = "work";
    const contextSnapshot = {
      ...bootstrap.snapshot,
      contexts: [
        {
          name: "client-acme",
          profiles: {
            claude: "work",
            codex: "work",
          },
        },
      ],
      workspace_status: {
        status: "mismatch",
        current_context: currentContext,
        expected_context: "client-acme",
        matched_binding: {
          scope: "path",
          path: "/code/acme",
          context: "client-acme",
        },
      },
      project_bindings: {
        user_bindings: {
          guard_mode: "warn",
          default_context: "none",
          items: [{ scope: "path", path: "/code/acme", context: "client-acme" }],
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_context") {
        currentContext = "client-acme";
        return { command, snapshot: contextSnapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithSet,
            snapshot: contextSnapshot,
          },
          get_snapshot: contextSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: {
            result: {
              status: currentContext === "client-acme" ? "match" : "mismatch",
              current_context: currentContext,
              expected_context: "client-acme",
              matched_binding: {
                scope: "path",
                path: "/code/acme",
                context: "client-acme",
              },
            },
          },
          get_project_bindings: {
            result: {
              user_bindings: {
                guard_mode: "warn",
                default_context: "none",
                items: [{ scope: "path", path: "/code/acme", context: "client-acme" }],
              },
            },
          },
          list_backups: [],
          get_settings: settingsWithSet,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openSetsSection();
    fireEvent.click(screen.getByText("Use this set"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_context")).toBe(true);
    });
    expect(screen.getByText("Last set result: Activated set Client Acme.")).toBeInTheDocument();
  });

  it("marks the active CLI context in contexts and disables reactivation", async () => {
    const settingsWithSet: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithSet,
            snapshot: {
              ...bootstrap.snapshot,
              workspace_status: {
                status: "match",
                current_context: "client-acme",
                expected_context: "client-acme",
              },
            },
          },
          get_snapshot: {
            ...bootstrap.snapshot,
            contexts: [
              {
                name: "client-acme",
                profiles: { claude: "work", codex: "work", gemini: null },
              },
            ],
            workspace_status: {
              status: "match",
              current_context: "client-acme",
              expected_context: "client-acme",
            },
          },
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: {
            result: {
              status: "match",
              current_context: "client-acme",
              expected_context: "client-acme",
            },
          },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithSet,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await openSetsSection();

    const activeContextButton = screen.getByRole("button", { name: "Current set" });
    expect(activeContextButton).toBeDisabled();
    expect(screen.getByText("Client Acme ✓")).toBeInTheDocument();
  });

  it("excludes duplicate CLI workspace bindings when a matching profile set already exists", async () => {
    const settingsWithSet: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };
    const workspaceSnapshot = {
      ...bootstrap.snapshot,
      contexts: [
        {
          name: "client-acme",
          profiles: {
            claude: "work",
            codex: "work",
          },
        },
      ],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithSet,
            snapshot: workspaceSnapshot,
          },
          get_snapshot: workspaceSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match", current_context: "client-acme" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithSet,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await openProjectRulesSection();

    fireEvent.click(screen.getByRole("button", { name: "Open Rule Editor" }));
    expect(screen.getByRole("option", { name: "Saved set: Client Acme" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Detected set: client-acme" })).not.toBeInTheDocument();
  });

  it("blocks unsupported workspace binding submits until a context and target are available", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const emptyWorkspaceSnapshot = {
      ...bootstrap.snapshot,
      contexts: [],
      workspace_status: { status: "match", current_context: "none" },
      project_bindings: { user_bindings: { guard_mode: "warn", default_context: "none", items: [] } },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: emptyWorkspaceSnapshot,
          },
          get_snapshot: emptyWorkspaceSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: emptyWorkspaceSnapshot.workspace_status },
          get_project_bindings: { result: emptyWorkspaceSnapshot.project_bindings },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openProjectRulesSection();

    fireEvent.click(screen.getByRole("button", { name: "Open Rule Editor" }));
    expect(
      screen.getByText(
        "No sets are available yet. Create one before saving a project rule.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Save rule")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Rule scope"), {
      target: { value: "path" },
    });

    expect(
      screen.getByText("Enter a path prefix before saving or removing this rule."),
    ).toBeInTheDocument();
    expect(screen.getByText("Save rule")).toBeDisabled();
    expect(screen.getByText("Remove rule")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Path"), {
      target: { value: "   " },
    });
    expect(screen.getByText("Save rule")).toBeDisabled();

    expect(calls.some((entry) => entry.command === "workspace_bind")).toBe(false);
    expect(calls.some((entry) => entry.command === "workspace_unbind")).toBe(false);
  });

  it("applies safe repairs from diagnostics", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "run_repair") {
        const request = (args as { request?: { apply?: boolean } })?.request;
        if (request?.apply) {
          return {
            result: {
              summary: {
                status: "pass",
                actions_planned: 1,
                actions_applied: 1,
                issues_remaining: 0,
              },
              actions: [],
            },
          };
        }
        return {
          result: {
            summary: {
              status: "warn",
              actions_planned: 1,
              actions_applied: 0,
              issues_remaining: 1,
            },
            actions: [
              {
                kind: "create_dir",
                fix: "home",
                path: "/tmp/aisw",
                detail: "create AISW_HOME directory",
                status: "planned",
              },
            ],
          },
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: {
            checks: [{ name: "tool/codex", status: "warn", detail: "codex not found on PATH" }],
          },
          run_verify: {
            summary: { status: "warn", passed: 1, warnings: 1, failed: 0 },
            tools: [
              {
                tool: "codex",
                status: "warn",
                issues: ["tool binary not found on PATH"],
                remediation: ["Install codex or run 'aisw doctor --json'"],
              },
            ],
          },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));
    await waitFor(() => expect(screen.getByText("1 actions planned")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Review Repair Plan"));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Apply Safe Repairs" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Apply Safe Repairs" }));

    await waitFor(() => {
      expect(screen.getByText("Last repair run")).toBeInTheDocument();
      expect(screen.getByText("1 actions applied")).toBeInTheDocument();
    });
  });

  it("shows explicit no-action states when diagnostics are healthy", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));

    await waitFor(() => {
      expect(screen.getAllByText("Everything looks good").length).toBeGreaterThan(0);
      expect(
        screen.getByText("No direct recovery actions are available from the current diagnostics state."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("No safe automatic repairs are currently planned."),
      ).toBeInTheDocument();
    });
  });

  it("shows doctor remediations for keyring, permission, and OAuth failures", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: {
            checks: [
              {
                name: "keyring",
                status: "fail",
                detail: "Local credential store is locked.",
                remediation: "Unlock the local credential store and retry.",
              },
              {
                name: "permissions",
                status: "warn",
                detail: "AISW cannot write the active config path.",
                remediation: ["Grant write access to ~/.aisw", "Retry the switch"],
              },
              {
                name: "oauth",
                status: "fail",
                detail: "Upstream OAuth session timed out.",
                remediation: "Run the guided OAuth flow again and finish login before timeout.",
              },
            ],
          },
          run_verify: { summary: { status: "warn", passed: 0, warnings: 1, failed: 0 }, tools: [] },
          run_repair: { result: { summary: { status: "warn", actions_planned: 0, actions_applied: 0, issues_remaining: 3 }, actions: [] } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));

    await waitFor(() => {
      expect(screen.getAllByText("Local credential store is locked.").length).toBeGreaterThan(0);
      expect(screen.getAllByText("AI Switch cannot write the active config path.").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Upstream OAuth session timed out.").length).toBeGreaterThan(0);
    });

    selectDiagnosticFinding("keyring");
    expect(screen.getAllByText("Unlock the local credential store and retry.").length).toBeGreaterThan(0);

    selectDiagnosticFinding("permissions");
    expect(screen.getAllByText("Grant write access to ~/.aisw").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Retry the switch").length).toBeGreaterThan(0);

    selectDiagnosticFinding("oauth");
    expect(
      screen.getAllByText("Run the guided OAuth flow again and finish login before timeout.").length,
    ).toBeGreaterThan(0);
  });

  it("exports a redacted support report from diagnostics", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { checks: [], summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { summary: { status: "pass", actions_planned: 0, actions_applied: 0, issues_remaining: 0 }, actions: [] } },
          export_diagnostic_bundle: {
            path: "/tmp/ai-switch/ai-switch-diagnostics-456.json",
            filename: "ai-switch-diagnostics-456.json",
            generated_at: "unix:456",
          },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [
              "Apply CLAUDE_CONFIG_DIR, CODEX_HOME, and GEMINI_API_KEY into the current shell session when you switch profiles from AI Switch.",
            ],
            note: "Without terminal integration, AI Switch still updates local credential files and its managed configuration.",
            manual_apply_examples: ['eval "$(aisw use claude work --emit-env)"'],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc",
                reload_command: "source ~/.zshrc",
                verify_command: "echo \"$AISW_SHELL_HOOK\"",
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));
    fireEvent.click(screen.getByText("Export Report"));

    await waitFor(() => {
      expect(screen.getByText("Support report ready")).toBeInTheDocument();
      expect(screen.getByText("/tmp/ai-switch/ai-switch-diagnostics-456.json")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Copy report path"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "/tmp/ai-switch/ai-switch-diagnostics-456.json",
      );
    });
    expect(calls.some((entry) => entry.command === "export_diagnostic_bundle")).toBe(true);
  });

  it("opens shell setup from diagnostics when doctor reports the shell hook is inactive", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: {
            checks: [
              {
                name: "shell_hook",
                status: "warn",
                detail: "Terminal integration is not active in the current shell session.",
                remediation: ["Install terminal integration and reload the shell."],
              },
            ],
          },
          run_verify: { summary: { status: "warn", passed: 0, warnings: 1, failed: 0 }, tools: [] },
          run_repair: {
            result: {
              summary: { status: "warn", actions_planned: 0, actions_applied: 0, issues_remaining: 1 },
              actions: [],
            },
          },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));

    let shellHookFix: HTMLElement;
    await waitFor(() => {
      const shellHookMatches = screen.getAllByText("Terminal integration not active");
      shellHookFix = shellHookMatches[shellHookMatches.length - 1].closest("article") as HTMLElement;
      expect(shellHookFix).toBeInTheDocument();
      expect(within(shellHookFix).getByText("Open terminal setup")).toBeInTheDocument();
    });

    fireEvent.click(within(shellHookFix!).getByText("Open terminal setup"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Terminal Integration" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Terminal Integration" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("offers direct diagnostic fixes for missing tools, live mismatch, and workspace mismatch", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const settingsWithSet: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };
    const diagnosticsSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        {
          tool: "claude",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "work",
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
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: null,
          state_mode: "isolated",
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
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
      contexts: [],
      workspace_status: {
        result: {
          status: "mismatch",
          current_context: "work",
          expected_context: "client-acme",
          matched_binding: {
            scope: "path",
            target: "/code/acme",
            context: "client-acme",
          },
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "activate_profile_set") {
        return { command, snapshot: diagnosticsSnapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithSet,
            snapshot: diagnosticsSnapshot,
          },
          get_snapshot: diagnosticsSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: {
            checks: [{ name: "tool/codex", status: "warn", detail: "codex not found on PATH" }],
          },
          run_verify: {
            summary: { status: "fail", passed: 0, warnings: 1, failed: 2 },
            tools: [
              {
                tool: "claude",
                status: "fail",
                issues: ["live credentials changed outside AISW"],
                remediation: ["Re-apply the active profile"],
              },
              {
                tool: "codex",
                status: "warn",
                issues: ["tool binary not found on PATH"],
                remediation: ["Install codex"],
              },
            ],
          },
          run_repair: {
            result: {
              summary: { status: "warn", actions_planned: 0, actions_applied: 0, issues_remaining: 3 },
              actions: [],
            },
          },
          get_workspace_status: diagnosticsSnapshot.workspace_status,
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithSet,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));

    await waitFor(() => {
      expect(screen.getByText("Recommended fixes")).toBeInTheDocument();
      expect(screen.getAllByText("codex is missing").length).toBeGreaterThan(0);
      expect(screen.getAllByText("claude live mismatch").length).toBeGreaterThan(0);
      expect(screen.getByText("Project set mismatch")).toBeInTheDocument();
    });

    const workspaceMismatchCard = screen.getByText("Project set mismatch").closest(".diagnostic-card");
    if (!(workspaceMismatchCard instanceof HTMLElement)) {
      throw new Error("Missing workspace mismatch diagnostic card.");
    }
    expect(within(workspaceMismatchCard).getByText("Open Sets")).toBeInTheDocument();
    expect(within(workspaceMismatchCard).queryByText("Use expected set now")).not.toBeInTheDocument();

    const missingToolMatches = screen.getAllByText("codex is missing");
    const missingToolCard = missingToolMatches[missingToolMatches.length - 1].closest(".diagnostic-card");
    if (!(missingToolCard instanceof HTMLElement)) {
      throw new Error("Missing diagnostics tool card.");
    }
    fireEvent.click(within(missingToolCard).getByText("Open installation guide"));
    expect(window.open).toHaveBeenCalledWith(
      "https://www.npmjs.com/package/@openai/codex",
      "_blank",
      "noopener,noreferrer",
    );
    const doctorRunsBeforeRefresh = calls.filter((entry) => entry.command === "run_doctor").length;
    const snapshotReadsBeforeRefresh = calls.filter((entry) => entry.command === "get_snapshot").length;
    fireEvent.click(within(missingToolCard).getByText("Refresh diagnostics"));
    await waitFor(() => {
      expect(calls.filter((entry) => entry.command === "run_doctor").length).toBeGreaterThan(
        doctorRunsBeforeRefresh,
      );
      expect(calls.filter((entry) => entry.command === "get_snapshot").length).toBeGreaterThan(
        snapshotReadsBeforeRefresh,
      );
    });

    fireEvent.change(screen.getByLabelText("import claude current login from diagnostics"), {
      target: { value: "incident" },
    });
    fireEvent.click(screen.getByText("Import current as new"));
    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "add_profile")).toBe(true);
    });

    fireEvent.click(screen.getByText("Re-apply Work"));
    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
    });

    fireEvent.click(screen.getByText("Open Sets"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Set Library" })).toBeInTheDocument();
    });
    expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(false);
  });

  it("opens matching profile diagnostics from a diagnostics quick fix", async () => {
    const diagnosticsSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        {
          tool: "claude",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "work",
          auth_method: "oauth",
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: false,
          credentials_present: true,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        claude: {
          active: "work",
          profiles: [{ name: "work", auth: "oauth", label: "Work" }],
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: diagnosticsSnapshot,
          },
          get_snapshot: diagnosticsSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { checks: [] },
          run_verify: {
            summary: { status: "fail", passed: 0, warnings: 0, failed: 1 },
            tools: [
              {
                tool: "claude",
                status: "fail",
                issues: ["live credentials changed outside AISW"],
                remediation: ["Re-apply the active profile"],
              },
            ],
          },
          run_repair: {
            result: {
              summary: { status: "warn", actions_planned: 0, actions_applied: 0, issues_remaining: 1 },
              actions: [],
            },
          },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));

    await waitFor(() => expect(screen.getAllByText("claude live mismatch").length).toBeGreaterThan(0));
    const mismatchMatches = screen.getAllByText("claude live mismatch");
    const mismatchCard = mismatchMatches[mismatchMatches.length - 1].closest("article");
    expect(mismatchCard).not.toBeNull();
    fireEvent.click(within(mismatchCard!).getByText("Open profile"));

    await waitFor(() =>
      expect(screen.getByText("Credential backend: system_keyring")).toBeInTheDocument(),
    );
    expect(screen.getByText("Health details")).toBeInTheDocument();
    expect(screen.getByText("Credential backend: system_keyring")).toBeInTheDocument();
    expect(screen.getByText("Live match: no")).toBeInTheDocument();
  });

  it("runs targeted diagnostic repairs for keyring, permissions, and OAuth failures", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "run_repair") {
        const request = (args as { request?: { apply?: boolean; fixes?: string[] } })?.request;
        if (request?.apply) {
          return {
            result: {
              summary: {
                status: "pass",
                actions_planned: request.fixes?.length ?? 0,
                actions_applied: request.fixes?.length ?? 0,
                issues_remaining: 0,
              },
              actions: (request.fixes ?? []).map((fix) => ({
                kind: "repair",
                fix,
                path: "~/.aisw",
                detail: `applied ${fix}`,
                status: "applied",
              })),
            },
          };
        }
        return {
          result: {
            summary: {
              status: "warn",
              actions_planned: 3,
              actions_applied: 0,
              issues_remaining: 3,
            },
            actions: [
              {
                kind: "repair",
                fix: "keyring",
                path: "~/.aisw",
                detail: "unlock the system keyring integration",
                status: "planned",
              },
              {
                kind: "repair",
                fix: "permissions",
                path: "~/.aisw",
                detail: "repair config path permissions",
                status: "planned",
              },
              {
                kind: "repair",
                fix: "oauth",
                path: "~/.aisw",
                detail: "retry the OAuth recovery flow",
                status: "planned",
              },
            ],
          },
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: {
            checks: [
              {
                name: "keyring",
                status: "fail",
                detail: "Local credential store is locked.",
                remediation: ["Unlock the local credential store and retry."],
              },
              {
                name: "permissions",
                status: "warn",
                detail: "AISW cannot write the active config path.",
                remediation: ["Grant write access to ~/.aisw", "Retry the switch"],
              },
              {
                name: "oauth",
                status: "fail",
                detail: "Upstream OAuth session timed out.",
                remediation: "Run the guided OAuth flow again and finish login before timeout.",
              },
            ],
          },
          run_verify: { summary: { status: "warn", passed: 0, warnings: 0, failed: 0 }, tools: [] },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));

    await waitFor(() => {
      expect(screen.getByText("Apply keyring repair")).toBeInTheDocument();
      expect(screen.getByText("Repair permissions")).toBeInTheDocument();
      expect(screen.getByText("Retry OAuth repair")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use file-backed storage" })).toBeInTheDocument();
      expect(screen.getByText("Show keyring setup")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Apply keyring repair"));
    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "run_repair" &&
            (entry.args as { request?: { apply?: boolean; fixes?: string[] } })?.request?.apply === true &&
            (entry.args as { request?: { fixes?: string[] } })?.request?.fixes?.includes("keyring"),
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByText("Repair permissions"));
    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "run_repair" &&
            (entry.args as { request?: { apply?: boolean; fixes?: string[] } })?.request?.apply === true &&
            (entry.args as { request?: { fixes?: string[] } })?.request?.fixes?.includes("permissions"),
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByText("Retry OAuth repair"));
    await waitFor(() => {
      expect(
        calls.some(
          (entry) =>
            entry.command === "run_repair" &&
            (entry.args as { request?: { apply?: boolean; fixes?: string[] } })?.request?.apply === true &&
            (entry.args as { request?: { fixes?: string[] } })?.request?.fixes?.includes("oauth"),
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Use file-backed storage" }));
    await waitFor(() => {
      expect(getAddProfileDialog().getByLabelText("Tool")).toBeInTheDocument();
      expect(getAddProfileDialog().getByLabelText("Import mode")).toHaveValue("from_live");
      expect(getAddProfileDialog().getByLabelText("Credential backend")).toHaveValue("file");
    });

    fireEvent.click(screen.getByText("Diagnostics"));
    fireEvent.click(screen.getByText("Show keyring setup"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
      expect(screen.getByText("Linux Secret Service")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Security" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("reruns setup detection when Check This Mac is clicked", async () => {
    let initCalls = 0;
    const firstRunSnapshot = {
      ...bootstrap.snapshot,
      statuses: [],
      profiles: {
        claude: {
          active: null,
          profiles: [],
        },
        codex: {
          active: null,
          profiles: [],
        },
      },
      contexts: [],
    };
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "run_init") {
        initCalls += 1;
        return {
          result: {
            live_accounts: [{ tool: "codex", outcome: "detected", auth_method: "oauth" }],
          },
        };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: firstRunSnapshot,
          },
          get_snapshot: firstRunSnapshot,
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0),
    );
    openSetupStep("Accounts");
    await waitFor(() => {
      expect(screen.getByText("Run the setup scan to detect live Claude, Codex, and Gemini accounts.")).toBeInTheDocument();
    });
    expect(initCalls).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));

    await waitFor(() => {
      expect(screen.getByText("detected · oauth")).toBeInTheDocument();
      expect(initCalls).toBe(1);
    });
  });

  it("opens profiles from onboarding when an installed tool has no live credentials", async () => {
    const firstRunSnapshot = {
      statuses: [
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        codex: {
          active: null,
          profiles: [],
        },
      },
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: firstRunSnapshot,
          },
          get_snapshot: firstRunSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0),
    );
    await waitFor(() => {
      expect(screen.getByText("Installed, but no saved profile yet")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add codex profile"));

    await waitFor(() => {
      expect(screen.getByText("Saved profiles", { selector: ".section-kicker" })).toBeInTheDocument();
      expect(screen.getByLabelText("Current tool")).toHaveValue("codex");
      expect(getAddProfileDialog().getByLabelText("Tool")).toHaveValue("codex");
    });
  });

  it("keeps setup visible while another installed tool still has no profile", async () => {
    const partialSetupSnapshot = {
      statuses: [
        {
          tool: "claude",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "work",
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
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
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
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: partialSetupSnapshot,
          },
          get_snapshot: partialSetupSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("Installed, but no saved profile yet").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Add codex profile")).toBeInTheDocument();
  });

  it("shows missing-tool install guidance during onboarding", async () => {
    const firstRunSnapshot = {
      statuses: [
        {
          tool: "claude",
          binary_found: true,
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
        {
          tool: "gemini",
          binary_found: false,
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: null,
          state_mode: null,
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        claude: {
          active: null,
          profiles: [],
        },
        gemini: {
          active: null,
          profiles: [],
        },
      },
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: firstRunSnapshot,
          },
          get_snapshot: firstRunSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0),
    );
    const setupHeading = screen
      .getAllByRole("heading", { name: "Get started" })
      .find((element) => element.closest(".section-card"));
    const setupSection = setupHeading?.closest(".section-card");
    if (!(setupSection instanceof HTMLElement)) {
      throw new Error("Missing onboarding section.");
    }
    const setup = within(setupSection);
    expect(setup.getByText("Gemini CLI is not installed")).toBeInTheDocument();
    expect(setup.getByText("Optional for now")).toBeInTheDocument();
    expect(
      setup.getByText((_, element) =>
        element?.textContent?.trim() ===
        "You can finish setup without Gemini CLI. Install the gemini tool later when you want to manage that provider here.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(setup.getByText("Open installation guide"));
    expect(window.open).toHaveBeenCalledWith(
      "https://www.npmjs.com/package/@google/gemini-cli",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens full shell setup guidance from onboarding", async () => {
    const firstRunSnapshot = {
      statuses: [
        {
          tool: "claude",
          binary_found: true,
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
      ],
      profiles: {
        claude: {
          active: null,
          profiles: [],
        },
      },
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: firstRunSnapshot,
          },
          get_snapshot: firstRunSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0),
    );
    openSetupStep("Terminal");

    fireEvent.click(screen.getByText("Open terminal setup"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Terminal Integration" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Terminal Integration" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("opens profiles from onboarding when first-switch options are missing", async () => {
    const partialSetupSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        {
          ...bootstrap.snapshot.statuses[0],
          active_profile: "work",
        },
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
          warnings: [],
        },
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
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            snapshot: partialSetupSnapshot,
          },
          get_snapshot: partialSetupSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0),
    );
    openSetupStep("First switch");
    fireEvent.click(screen.getByText("Open Profiles"));

    await waitFor(() => {
      expect(getAddProfileDialog().getByLabelText("Tool")).toHaveValue("claude");
    });
  });

  it("opens diagnostics when the tray requests it", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-open-diagnostics"]?.({});
    });

    await waitFor(() => {
      expect(screen.getByText("Checks and recovery")).toBeInTheDocument();
    });
  });

  it("reruns diagnostics when the tray requests a diagnostics run", async () => {
    let doctorRuns = 0;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "run_doctor") {
        doctorRuns += 1;
        return doctorRuns === 1
          ? { checks: [], summary: { status: "pass" } }
          : {
              checks: [
                {
                  name: "shell_hook",
                  status: "warn",
                  detail: "Terminal integration is not active in the current shell session.",
                  remediation: ["Install terminal integration and reload the shell."],
                },
              ],
              summary: { status: "warn" },
            };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    expect(doctorRuns).toBe(0);

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-run-diagnostics"]?.({});
    });

    await waitFor(() => {
      expect(screen.getByText("Checks and recovery")).toBeInTheDocument();
      expect(doctorRuns).toBe(1);
    });

    await act(async () => {
      handlers?.["tray-run-diagnostics"]?.({});
    });

    await waitFor(() => {
      expect(screen.getAllByText("Terminal integration is not active in the current shell session.").length).toBeGreaterThan(0);
    });
  });

  it("reruns diagnostics from the global verify toolbar action", async () => {
    let doctorRuns = 0;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "run_doctor") {
        doctorRuns += 1;
        return doctorRuns === 1
          ? { checks: [], summary: { status: "pass" } }
          : {
              checks: [
                {
                  name: "shell_hook",
                  status: "warn",
                  detail: "Terminal integration is not active in the current shell session.",
                  remediation: ["Install terminal integration and reload the shell."],
                },
              ],
              summary: { status: "warn" },
            };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    expect(doctorRuns).toBe(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Verify" })[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Diagnostics" })).toHaveClass("nav-button-active");
      expect(doctorRuns).toBe(1);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Verify" })[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Terminal integration is not active in the current shell session.").length).toBeGreaterThan(0);
    });
  });

  it("opens the updates settings section when the app menu requests it", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-settings-updates"]?.({});
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Updates" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Check for Updates" })).toBeInTheDocument();
    });
  });

  it("opens quick switch when the app menu requests switch set", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-quick-switch"]?.({});
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Quick Switch" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search Quick Switch")).toBeInTheDocument();
    });
  });

  it("opens quick switch when the app menu requests it", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-quick-switch"]?.({});
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Quick Switch" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search Quick Switch")).toBeInTheDocument();
    });
  });

  it("opens settings from the keyboard shortcut", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    fireEvent.keyDown(window, { key: ",", metaKey: true });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Settings" })[0]).toHaveClass("nav-button-active");
      expect(screen.getByLabelText("Settings sections")).toBeInTheDocument();
    });
  });

  it("switches primary sections from keyboard shortcuts", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    fireEvent.keyDown(window, { key: "2", metaKey: true });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Profiles" })[0]).toHaveClass("nav-button-active");
      expect(screen.getByLabelText("Search Profiles")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "6", metaKey: true });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Activity" })[0]).toHaveClass("nav-button-active");
      expect(screen.getByRole("button", { name: "Open Log File" })).toBeInTheDocument();
    });
  });

  it("re-applies the active shared profile when the app menu requests it", async () => {
    const calls: Array<{ command: string; args?: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "use_all_profiles") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_doctor: { summary: { status: "pass" } },
          run_init: { result: { live_accounts: [] } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          export_diagnostic_bundle: {
            path: "/tmp/ai-switch/diagnostics-123.json",
            filename: "diagnostics-123.json",
            generated_at: "unix:123",
          },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance remains informational.",
            manual_apply_examples: [],
            variants: [],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-reapply-active-profile"]?.({});
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(true);
      expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
        title: "Re-apply active profile",
        body: "Re-applied shared profile Work.",
      });
    });
  });

  it("exports diagnostics when the app menu requests it", async () => {
    const calls: string[] = [];
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      calls.push(command);
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_doctor: { summary: { status: "pass" } },
          run_init: { result: { live_accounts: [] } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          export_diagnostic_bundle: {
            path: "/tmp/ai-switch/diagnostics-123.json",
            filename: "diagnostics-123.json",
            generated_at: "unix:123",
          },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance remains informational.",
            manual_apply_examples: [],
            variants: [],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-export-diagnostics"]?.({});
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(calls).toContain("export_diagnostic_bundle");
      expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
        title: "Diagnostic report exported",
        body: "Saved diagnostics-123.json.",
      });
    });
  });

  it("opens troubleshooting from the app menu", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-troubleshooting"]?.({});
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Diagnostics" })).toHaveClass("nav-button-active");
      expect(screen.getByText("Checks and recovery")).toBeInTheDocument();
    });
  });

  it("opens local documentation from the app menu when the reference file is available", async () => {
    const calls: string[] = [];
    const defaultMock = window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      calls.push(command);
      return (
        {
          open_reference_document: "/Users/burakdede/Projects/aisw-desktop/README.md",
        } as Record<string, unknown>
      )[command] ?? defaultMock[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-help"]?.({});
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(calls).toContain("open_reference_document");
      expect(screen.queryByRole("dialog", { name: "Using AI Switch" })).not.toBeInTheDocument();
    });
  });

  it("opens AI Switch help from the app menu", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-help"]?.({});
    });

    const dialog = await screen.findByRole("dialog", { name: "Using AI Switch" });
    expect(within(dialog).getByText("Using AI Switch")).toBeInTheDocument();
    expect(within(dialog).getByText("Local profile switching")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Open Diagnostics" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Diagnostics" })).toHaveClass("nav-button-active");
      expect(screen.queryByRole("dialog", { name: "Using AI Switch" })).not.toBeInTheDocument();
    });
  });

  it("opens the issue tracker from the app menu", async () => {
    const calls: string[] = [];
    const defaultMock = window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      calls.push(command);
      return (
        {
          open_issue_tracker: "https://github.com/example/ai-switch/issues",
        } as Record<string, unknown>
      )[command] ?? defaultMock[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-issues"]?.({});
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(calls).toContain("open_issue_tracker");
      expect(calls).not.toContain("export_diagnostic_bundle");
    });
  });

  it("falls back to diagnostic export when opening the issue tracker fails", async () => {
    const calls: string[] = [];
    const defaultMock = window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      calls.push(command);
      if (command === "open_issue_tracker") {
        throw new Error("Issue tracker unavailable");
      }
      return (
        {
          export_diagnostic_bundle: {
            path: "/tmp/ai-switch/ai-switch-diagnostics-123.json",
            filename: "ai-switch-diagnostics-123.json",
            generated_at: "unix:123",
          },
        } as Record<string, unknown>
      )[command] ?? defaultMock[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-issues"]?.({});
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(calls).toContain("open_issue_tracker");
      expect(calls).toContain("export_diagnostic_bundle");
      expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
        title: "Support report exported",
        body: "Saved ai-switch-diagnostics-123.json.",
      });
    });
  });

  it("opens import current login from the app menu in the profiles flow", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-import-current-login"]?.({});
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Profiles" })).toHaveClass("nav-button-active");
      expect(screen.getByText("Import current login")).toBeInTheDocument();
    });
  });

  it("opens troubleshooting from the app menu in diagnostics", async () => {
    let doctorRuns = 0;
    let verifyRuns = 0;
    const defaultMock = window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>;

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "run_doctor") {
        doctorRuns += 1;
        return { checks: [], summary: { status: "pass" } };
      }
      if (command === "run_verify") {
        verifyRuns += 1;
        return { summary: { status: "pass" }, tools: [] };
      }
      return defaultMock[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["menu-open-troubleshooting"]?.({});
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Diagnostics" })).toHaveClass("nav-button-active");
      expect(doctorRuns).toBeGreaterThan(0);
      expect(verifyRuns).toBeGreaterThan(0);
    });
  });

  it("defers diagnostics refetches until an active mutation completes", async () => {
    let doctorRuns = 0;
    let verifyRuns = 0;
    let repairRuns = 0;
    let resolveUseProfile: ((value: unknown) => void) | undefined;

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "use_profile") {
        return await new Promise((resolve) => {
          resolveUseProfile = resolve;
        });
      }
      if (command === "run_doctor") {
        doctorRuns += 1;
        return { checks: [], summary: { status: "pass" } };
      }
      if (command === "run_verify") {
        verifyRuns += 1;
        return { summary: { status: "pass" }, tools: [] };
      }
      if (command === "run_repair") {
        repairRuns += 1;
        return {
          result: {
            summary: {
              status: "pass",
              actions_planned: 0,
              actions_applied: 0,
              issues_remaining: 0,
            },
            actions: [],
          },
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Without terminal integration, AI Switch still updates local credential files.",
            manual_apply_examples: [],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc",
                reload_command: "source ~/.zshrc",
                verify_command: 'echo \"$AISW_SHELL_HOOK\"',
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());
    expect(doctorRuns).toBe(0);

    fireEvent.click(screen.getByText("Re-apply Work"));
    await waitFor(() => {
      expect(resolveUseProfile).toBeDefined();
    });

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-run-diagnostics"]?.({});
    });

    await waitFor(() => expect(screen.getByText("Checks and recovery")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Verify Again" })).toBeDisabled();
    expect(doctorRuns).toBe(0);
    expect(verifyRuns).toBe(0);
    expect(repairRuns).toBe(0);

    await act(async () => {
      resolveUseProfile?.({ command: "use_profile", snapshot: bootstrap.snapshot });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(doctorRuns).toBeGreaterThan(0);
      expect(verifyRuns).toBeGreaterThan(0);
      expect(repairRuns).toBeGreaterThan(0);
    });
    expect(screen.getByRole("button", { name: "Verify Again" })).toBeEnabled();
  });

  it("records tray command results and shows a desktop notification", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-command-result"]?.({
        scope: "tool",
        tool: "claude",
        label: "Switch profile",
        status: "success",
        message: "Switched claude to work.",
      });
      await Promise.resolve();
    });

    expect(screen.getByText("Last result: Switched claude to work.")).toBeInTheDocument();
    expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
      title: "Switch profile",
      body: "Switched claude to work.",
    });
  });

  it("refreshes overview state after a successful tray profile switch", async () => {
    const refreshedSnapshot = {
      ...bootstrap.snapshot,
      statuses: bootstrap.snapshot.statuses.map((status) =>
        status.tool === "claude" ? { ...status, active_profile: "personal" } : status,
      ),
      profiles: {
        ...bootstrap.snapshot.profiles,
        claude: {
          active: "personal",
          profiles: [
            { name: "work", auth: "oauth", label: "Work" },
            { name: "personal", auth: "oauth", label: "Personal" },
          ],
        },
      },
    };
    let snapshotReads = 0;

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "get_snapshot") {
        snapshotReads += 1;
        return snapshotReads > 1 ? refreshedSnapshot : bootstrap.snapshot;
      }
      return (
        {
          get_bootstrap: bootstrap,
          run_doctor: { summary: { status: "pass" } },
          run_init: {
            result: {
              live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
            },
          },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [
              "Apply CLAUDE_CONFIG_DIR, CODEX_HOME, and GEMINI_API_KEY into the current shell session when you switch profiles from AI Switch.",
            ],
            note: "Shell hook guidance remains informational.",
            manual_apply_examples: ['eval "$(aisw use claude work --emit-env)"'],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc",
                reload_command: "source ~/.zshrc",
                verify_command: "echo \"$AISW_SHELL_HOOK\"",
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getAllByRole("heading", { name: "Work" }).length).toBeGreaterThan(0));

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-command-result"]?.({
        scope: "tool",
        tool: "claude",
        label: "Switch profile",
        status: "success",
        message: "Switched claude to personal.",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "Personal" }).length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Last result: Switched claude to personal.")).toBeInTheDocument();
  });

  it("refreshes workspace status and bindings after a tray context switch", async () => {
    const refreshedSnapshot = {
      ...bootstrap.snapshot,
      contexts: [
        {
          name: "client-acme",
          profiles: {
            claude: "work",
            codex: "work",
          },
        },
      ],
    };
    let snapshotReads = 0;
    let workspaceStatusReads = 0;
    let projectBindingsReads = 0;

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "get_snapshot") {
        snapshotReads += 1;
        return snapshotReads > 1 ? refreshedSnapshot : bootstrap.snapshot;
      }
      if (command === "get_workspace_status") {
        workspaceStatusReads += 1;
        return workspaceStatusReads > 1
          ? {
              result: {
                status: "match",
                scope: "default",
                target: "default",
                expected_context: "client-acme",
                current_context: "client-acme",
              },
            }
          : {
              result: {
                status: "mismatch",
                scope: "default",
                target: "default",
                expected_context: "client-acme",
                current_context: "none",
              },
            };
      }
      if (command === "get_project_bindings") {
        projectBindingsReads += 1;
        return projectBindingsReads > 1
          ? {
              result: {
                user_bindings: {
                  guard_mode: "strict",
                  default_context: "client-acme",
                  rules: [],
                },
              },
            }
          : {
              result: {
                user_bindings: {
                  guard_mode: "warn",
                  default_context: "none",
                  rules: [],
                },
              },
            };
      }
      return (
        {
          get_bootstrap: bootstrap,
          run_doctor: { summary: { status: "pass" } },
          run_init: { result: { live_accounts: [] } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance remains informational.",
            manual_apply_examples: [],
            variants: [],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openProjectRulesSection();
    await waitFor(() => {
      expect(screen.getByText("Project mismatch")).toBeInTheDocument();
      expect(screen.getByText("Guard mode: warn")).toBeInTheDocument();
    });

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-command-result"]?.({
        scope: "global",
        id: "context",
        label: "Use set",
        status: "success",
        message: "Activated set client-acme.",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByText("Project mismatch")).not.toBeInTheDocument();
      expect(screen.getByText("Guard mode: strict")).toBeInTheDocument();
    });
  });

  it("refreshes the backups list after a successful tray profile switch", async () => {
    let backupReads = 0;

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "list_backups") {
        backupReads += 1;
        return backupReads > 1
          ? [
              {
                backup_id: "20260326T120000Z-claude-work",
                tool: "claude",
                profile: "claude/work",
              },
            ]
          : [];
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_doctor: { summary: { status: "pass" } },
          run_init: { result: { live_accounts: [] } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance remains informational.",
            manual_apply_examples: [],
            variants: [],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Backups")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Backups"));
    await waitFor(() => expect(screen.getByText("No backups found.")).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-command-result"]?.({
        scope: "tool",
        tool: "claude",
        label: "Switch profile",
        status: "success",
        message: "Switched claude to work.",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("20260326T120000Z-claude-work")).toBeInTheDocument();
      expect(screen.getAllByText("Work").length).toBeGreaterThan(0);
    });
  });

  it("records tray context failures with remediation and shows a desktop notification", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-command-result"]?.({
        scope: "global",
        id: "context",
        label: "Use set",
        status: "error",
        message: "Set switch failed.",
        remediation: "Re-open AI Switch and verify the saved set.",
      });
      await Promise.resolve();
    });

    expect(
      screen.getByText(
        "Last set result: Set switch failed. Remediation: Re-open AI Switch and verify the saved set.",
      ),
    ).toBeInTheDocument();
    expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
      title: "Use set",
      body: "Set switch failed. Re-open AI Switch and verify the saved set.",
    });
  });

  it("classifies tray profile failures in diagnostics", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-command-result"]?.({
        scope: "tool",
        tool: "claude",
        label: "Switch profile",
        status: "error",
        kind: "ProfileMissing",
        message: "profile work no longer exists",
        remediation: "Refresh profile state or recreate the missing profile before retrying.",
      });
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText("Diagnostics"));

    await waitFor(() => {
      expect(screen.getAllByText("Claude profile missing").length).toBeGreaterThan(0);
      expect(screen.getAllByText("profile work no longer exists").length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          "Refresh profile state or recreate the missing profile before retrying.",
        ).length,
      ).toBeGreaterThan(0);
    });
  });

  it("saves and activates a local profile set", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSettings: DesktopSettings = bootstrap.settings;
    const snapshotWithoutCliContexts = {
      ...bootstrap.snapshot,
      statuses: [
        ...bootstrap.snapshot.statuses,
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "work",
          auth_method: "api_key",
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: true,
          credentials_present: true,
          permissions_ok: true,
        },
      ],
      contexts: [],
    };
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "get_bootstrap") {
        return {
          ...bootstrap,
          settings: currentSettings,
          snapshot: snapshotWithoutCliContexts,
        };
      }
      if (command === "update_settings") {
        const request = (args as { request?: DesktopSettings })?.request;
        currentSettings = request ?? currentSettings;
        return currentSettings;
      }
      if (command === "activate_profile_set") {
        return { command, snapshot: snapshotWithoutCliContexts };
      }
      return (
        {
          get_snapshot: snapshotWithoutCliContexts,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openSetsSection();
    fireEvent.click(screen.getByRole("button", { name: "New Set" }));
    expect(screen.getByRole("dialog", { name: "New Set" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Set name"), {
      target: { value: "client-acme" },
    });
    fireEvent.change(screen.getByLabelText("Label"), {
      target: { value: "Client Acme" },
    });
    fireEvent.change(screen.getByLabelText("Claude"), {
      target: { value: "work" },
    });
    fireEvent.change(screen.getByLabelText("Codex"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Set" }));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "update_settings")).toBe(true);
      expect(screen.getAllByText(/Client Acme/).length).toBeGreaterThan(0);
      expect(screen.getByText("Saved set Client Acme.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Current set" })).toBeDisabled();
    });
  });

  it("deletes a local profile set and reports the result", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSettings: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };
    const snapshotWithoutCliContexts = {
      ...bootstrap.snapshot,
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "get_bootstrap") {
        return {
          ...bootstrap,
          settings: currentSettings,
          snapshot: snapshotWithoutCliContexts,
        };
      }
      if (command === "update_settings") {
        const request = (args as { request?: DesktopSettings })?.request;
        currentSettings = request ?? currentSettings;
        return currentSettings;
      }
      return (
        {
          get_snapshot: snapshotWithoutCliContexts,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: currentSettings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openSetsSection();
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "update_settings")).toBe(true);
      expect(screen.getByText("Deleted set Client Acme.")).toBeInTheDocument();
    });
    expect(screen.queryByText("Client Acme")).not.toBeInTheDocument();
  });

  it("renames a local profile set through edit mode and replaces the original entry", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSettings: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };
    const snapshotWithoutCliContexts = {
      ...bootstrap.snapshot,
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "get_bootstrap") {
        return {
          ...bootstrap,
          settings: currentSettings,
          snapshot: snapshotWithoutCliContexts,
        };
      }
      if (command === "update_settings") {
        const request = (args as { request?: DesktopSettings })?.request;
        currentSettings = request ?? currentSettings;
        return currentSettings;
      }
      return (
        {
          get_snapshot: snapshotWithoutCliContexts,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: currentSettings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openSetsSection();
    fireEvent.click(screen.getByText("Edit"));

    expect(screen.getByDisplayValue("client-acme")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Client Acme")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit Set" })).toBeInTheDocument();
    expect(screen.getByText("Update Set")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Set name"), {
      target: { value: "client-acme-prime" },
    });
    fireEvent.change(screen.getByLabelText("Label"), {
      target: { value: "Client Acme Prime" },
    });
    fireEvent.click(screen.getByText("Update Set"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "update_settings")).toBe(true);
      expect(screen.getAllByText("Client Acme Prime").length).toBeGreaterThan(0);
      expect(screen.getByText("Updated set Client Acme Prime.")).toBeInTheDocument();
    });
    expect(screen.queryAllByText("Client Acme")).toHaveLength(0);
    expect(
      currentSettings.profile_sets.map((set) => ({ name: set.name, label: set.label })),
    ).toEqual([{ name: "client-acme-prime", label: "Client Acme Prime" }]);
  });

  it("blocks renaming a profile set to an existing saved name", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSettings: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
        {
          name: "focus-mode",
          label: "Focus Mode",
          profiles: { claude: "work", codex: null, gemini: null },
        },
      ],
    };
    const snapshotWithoutCliContexts = {
      ...bootstrap.snapshot,
      contexts: [],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "get_bootstrap") {
        return {
          ...bootstrap,
          settings: currentSettings,
          snapshot: snapshotWithoutCliContexts,
        };
      }
      if (command === "update_settings") {
        const request = (args as { request?: DesktopSettings })?.request;
        currentSettings = request ?? currentSettings;
        return currentSettings;
      }
      return (
        {
          get_snapshot: snapshotWithoutCliContexts,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: currentSettings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openSetsSection();
    const clientRow = screen
      .getAllByText("Client Acme")
      .map((node) => node.closest(".list-row"))
      .find((node): node is HTMLElement => node instanceof HTMLElement);
    if (!(clientRow instanceof HTMLElement)) {
      throw new Error("Missing client profile set row.");
    }
    fireEvent.click(within(clientRow).getByText("Edit"));

    fireEvent.change(screen.getByLabelText("Set name"), {
      target: { value: "focus-mode" },
    });

    expect(
      screen.getByText(
        "A set named focus-mode already exists. Rename the existing set or choose a different name.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Update Set")).toBeDisabled();
    expect(calls.some((entry) => entry.command === "update_settings")).toBe(false);
  });

  it("keeps empty profile sets out of activation surfaces", async () => {
    const settingsWithEmptySet: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "empty-set",
          label: "Empty Set",
          profiles: { claude: null, codex: null, gemini: null },
        },
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithEmptySet,
            snapshot: bootstrap.snapshot,
          },
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithEmptySet,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await openSetsSection();

    const emptySetRow = screen
      .getAllByText("Empty Set")
      .map((node) => node.closest(".list-row"))
      .find((node): node is HTMLElement => node instanceof HTMLElement);
    if (!(emptySetRow instanceof HTMLElement)) {
      throw new Error("Missing empty profile set row.");
    }
    expect(within(emptySetRow).getByText("Switch to set")).toBeDisabled();
    expect(
      within(emptySetRow).getByText(
        "Add at least one mapped profile before using this set in Overview, the menu bar, or project rules.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Overview"));
    const quickSwitchDialog = await openQuickSwitchDialog();
    expect(quickSwitchDialog.queryByText("Empty Set")).not.toBeInTheDocument();
    expect(quickSwitchDialog.getAllByRole("option", { name: /Client Acme/ }).length).toBeGreaterThan(0);
    fireEvent.click(quickSwitchDialog.getByRole("button", { name: "Close" }));

    await openProjectRulesSection();
    expect(screen.queryByRole("option", { name: "Set: Empty Set" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Rule Editor" }));
    expect(screen.getByRole("option", { name: "Saved set: Client Acme" })).toBeInTheDocument();

    await openSetsSection();
    fireEvent.click(screen.getByRole("button", { name: "New Set" }));
    fireEvent.change(screen.getByLabelText("Set name"), {
      target: { value: "empty-next" },
    });
    expect(screen.getByText("Create Set")).toBeDisabled();
    expect(
      screen.getByText("Select at least one tool profile before saving this set."),
    ).toBeInTheDocument();
  });

  it("keeps stale profile sets out of activation surfaces and explains missing mappings", async () => {
    const settingsWithStaleSet: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "missing", gemini: null },
        },
      ],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithStaleSet,
            snapshot: bootstrap.snapshot,
          },
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithStaleSet,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await openSetsSection();

    const staleSetRow = screen
      .getByText(
        "Refresh or repair the missing mapped profiles before using this set. Missing: codex: missing",
      )
      .closest(".list-row");
    if (!(staleSetRow instanceof HTMLElement)) {
      throw new Error("Missing stale profile set row.");
    }
    expect(within(staleSetRow).getByText("Switch to set")).toBeDisabled();
    expect(
      within(staleSetRow).getByText(
        "Refresh or repair the missing mapped profiles before using this set. Missing: codex: missing",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Overview"));
    expect(screen.queryByRole("option", { name: "Saved set: Client Acme" })).not.toBeInTheDocument();

    await openProjectRulesSection();
    expect(screen.queryByRole("option", { name: "Saved set: Client Acme" })).not.toBeInTheDocument();
  });

  it("prefers the native CLI context when a profile set matches it", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const contextSnapshot = {
      ...bootstrap.snapshot,
      statuses: [
        {
          ...bootstrap.snapshot.statuses[0],
          active_profile: "personal",
        },
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 2,
          active_profile: "personal",
          auth_method: "api_key",
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: true,
          credentials_present: true,
          permissions_ok: true,
        },
      ],
      profiles: {
        ...bootstrap.snapshot.profiles,
        claude: {
          active: "personal",
          profiles: [
            { name: "work", auth: "oauth", label: "Work" },
            { name: "personal", auth: "oauth", label: "Personal" },
          ],
        },
        codex: {
          active: "personal",
          profiles: [
            { name: "work", auth: "api_key", label: "Work" },
            { name: "personal", auth: "api_key", label: "Personal" },
          ],
        },
      },
      contexts: [
        {
          name: "client-acme",
          profiles: {
            claude: "work",
            codex: "work",
          },
        },
      ],
    };
    const activatedSnapshot = {
      ...contextSnapshot,
      statuses: contextSnapshot.statuses.map((status) =>
        status.tool === "claude" || status.tool === "codex"
          ? { ...status, active_profile: "work" }
          : status,
      ),
      profiles: {
        ...contextSnapshot.profiles,
        claude: {
          ...contextSnapshot.profiles.claude,
          active: "work",
        },
        codex: {
          ...contextSnapshot.profiles.codex,
          active: "work",
        },
      },
    };
    let currentSnapshot = contextSnapshot;

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "activate_profile_set") {
        currentSnapshot = activatedSnapshot;
        return { command, snapshot: activatedSnapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: {
              ...bootstrap.settings,
              profile_sets: [
                {
                  name: "client-acme",
                  label: "Client Acme",
                  profiles: { claude: "work", codex: "work", gemini: null },
                },
              ],
            },
            snapshot: currentSnapshot,
          },
          get_snapshot: currentSnapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: {
            ...bootstrap.settings,
            profile_sets: [
              {
                name: "client-acme",
                label: "Client Acme",
                profiles: { claude: "work", codex: "work", gemini: null },
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await openSetsSection();
    fireEvent.click(screen.getByText("Switch to set"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(true);
      expect(screen.getByRole("button", { name: "Current set" })).toBeDisabled();
    });
    expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(false);
    expect(calls.some((entry) => entry.command === "use_profile")).toBe(false);
  });

  it("activates a local profile set directly from overview quick switch", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const settingsWithSet: DesktopSettings = {
      ...bootstrap.settings,
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "activate_profile_set") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithSet,
          },
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithSet,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    const quickSwitchDialog = await openQuickSwitchDialog();
    fireEvent.click(quickSwitchDialog.getAllByRole("option", { name: /Client Acme/ })[0]);

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(true);
    });
    expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(false);
  });

  it("uses saved profile labels in overview shared quick switch", async () => {
    const settingsWithOverride: DesktopSettings = {
      ...bootstrap.settings,
      profile_labels: {
        claude: {
          work: "Office",
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithOverride,
          },
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithOverride,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    const quickSwitchDialog = await openQuickSwitchDialog();
    expect(quickSwitchDialog.getByRole("option", { name: /Office.*Across/i })).toBeInTheDocument();
  });

  it("groups quick switch tool profiles under full tool names", async () => {
    await renderApp();
    const quickSwitchDialog = await openQuickSwitchDialog();

    expect(quickSwitchDialog.getByText("Claude Code")).toBeInTheDocument();
    expect(quickSwitchDialog.getByText("Codex CLI")).toBeInTheDocument();
  });

  it("exposes quick switch as a keyboard listbox with an active descendant", async () => {
    await renderApp();
    const quickSwitchDialog = await openQuickSwitchDialog();

    expect(quickSwitchDialog.getByRole("listbox", { name: "Quick Switch results" })).toBeInTheDocument();

    const search = quickSwitchDialog.getByLabelText("Search Quick Switch");
    expect(search).toHaveAttribute("aria-controls", "quick-switch-results-listbox");
    expect(search.getAttribute("aria-activedescendant")).toMatch(/^quick-switch-option-/);

    const currentOptionId = search.getAttribute("aria-activedescendant");
    expect(currentOptionId).not.toBeNull();
    expect(document.getElementById(currentOptionId!)).toHaveAttribute("aria-selected", "true");
  });

  it("returns focus to the quick switch trigger when the dialog closes", async () => {
    await renderApp();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Quick Switch" }).length).toBeGreaterThan(0);
    });

    const trigger = screen.getAllByRole("button", { name: "Quick Switch" })[0];
    trigger.focus();
    fireEvent.click(trigger);

    const quickSwitchDialog = await openQuickSwitchDialog();
    const search = quickSwitchDialog.getByLabelText("Search Quick Switch");

    await waitFor(() => {
      expect(search).toHaveFocus();
    });

    fireEvent.keyDown(search, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Quick Switch" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("clears the quick switch query from the native search field", async () => {
    await renderApp();
    const quickSwitchDialog = await openQuickSwitchDialog();

    const search = quickSwitchDialog.getByLabelText("Search Quick Switch");
    fireEvent.change(search, { target: { value: "office" } });
    expect(search).toHaveValue("office");

    fireEvent.click(quickSwitchDialog.getByRole("button", { name: "Clear Search Quick Switch" }));
    expect(search).toHaveValue("");
  });

  it("uses saved profile labels in onboarding first switch options and sidebar badge", async () => {
    const settingsWithOverride: DesktopSettings = {
      ...bootstrap.settings,
      profile_labels: {
        claude: {
          work: "Office",
        },
      },
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };
    const snapshotWithMatchingSet = {
      ...bootstrap.snapshot,
      statuses: [
        ...bootstrap.snapshot.statuses,
        {
          tool: "codex",
          binary_found: true,
          stored_profiles: 1,
          active_profile: "work",
          auth_method: "api_key",
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: true,
          credentials_present: true,
          permissions_ok: true,
        },
      ],
      profiles: {
        ...bootstrap.snapshot.profiles,
        codex: {
          active: "work",
          profiles: [{ name: "work", auth: "api_key", label: "Work" }],
        },
      },
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithOverride,
            snapshot: snapshotWithMatchingSet,
          },
          get_snapshot: snapshotWithMatchingSet,
          run_init: {
            result: {
              live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
            },
          },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithOverride,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await waitFor(() => {
      expect(screen.getAllByText("Current set").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Client Acme").length).toBeGreaterThan(0);
    });

    await renderSetupPanel({
      bootstrapOverride: {
        ...bootstrap,
        settings: settingsWithOverride,
        snapshot: snapshotWithMatchingSet,
      } as unknown as AppBootstrap,
      initReport: {
        result: {
          live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
        },
      },
    });

    openSetupStep("First switch");
    const firstSwitchSelect = screen.getByLabelText("First switch profile");
    expect(within(firstSwitchSelect).getByRole("option", { name: "Office" })).toBeInTheDocument();
  });

  it("uses profile labels in context profile-set editing and summaries", async () => {
    const settingsWithOverride: DesktopSettings = {
      ...bootstrap.settings,
      profile_labels: {
        claude: {
          work: "Office",
        },
        codex: {
          work: "Code Work",
        },
      },
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) =>
      (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: settingsWithOverride,
          },
          get_snapshot: {
            ...bootstrap.snapshot,
            contexts: [
              {
                name: "client-acme",
                profiles: { claude: "work", codex: "work", gemini: null },
              },
            ],
          },
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: settingsWithOverride,
        } as Record<string, unknown>
      )[command];

    await renderApp();
    await openSetsSection();

    expect(screen.getAllByText("Client Acme").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Set ID: client-acme")).toBeInTheDocument();
    expect(screen.getAllByText("claude: Office · codex: Code Work · gemini: none")).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { name: "New Set" })[0]);
    expect(screen.getAllByRole("option", { name: "Office" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("option", { name: "Code Work" })).toBeInTheDocument();
  });

  it("checks and installs a signed desktop update", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "check_for_updates") {
        return {
          configured: true,
          channel: "stable",
          current_version: "0.1.0",
          endpoint: "https://updates.example.com/stable.json",
          update: {
            version: "0.2.0",
            current_version: "0.1.0",
            target: "darwin-aarch64",
            notes: "Faster switching and signed updater artifacts.",
          },
          message: null,
        };
      }
      if (command === "install_update") {
        return {
          configured: true,
          channel: "stable",
          current_version: "0.1.0",
          installed_version: "0.2.0",
          restart_requested: true,
          message: "Update installed. Restart has been requested.",
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Updates" }));
    fireEvent.click(screen.getByText("Check for Updates"));

    await waitFor(() => {
      expect(screen.getByText("Update available: 0.2.0")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Install Update"));

    await waitFor(() => {
      expect(screen.getByText("Update installed. Restart has been requested.")).toBeInTheDocument();
      expect(calls.some((entry) => entry.command === "check_for_updates")).toBe(true);
      expect(calls.some((entry) => entry.command === "install_update")).toBe(true);
    });
  });

  it("shows updater remediation when update checks fail", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "check_for_updates") {
        throw {
          message: "Desktop update failed: invalid endpoint",
          remediation: "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Updates" }));
    fireEvent.click(screen.getByText("Check for Updates"));

    await waitFor(() => {
      expect(screen.getByText("Update check failed")).toBeInTheDocument();
      expect(screen.getByText("Desktop update failed: invalid endpoint")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows updater remediation when install fails", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "check_for_updates") {
        return {
          configured: true,
          channel: "stable",
          current_version: "0.1.0",
          endpoint: "https://updates.example.com/stable.json",
          update: {
            version: "0.2.0",
            current_version: "0.1.0",
            target: "darwin-aarch64",
            notes: "Faster switching and signed updater artifacts.",
          },
          message: null,
        };
      }
      if (command === "install_update") {
        throw {
          message: "Desktop update failed: signature mismatch",
          remediation: "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
        };
      }
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Updates" }));
    fireEvent.click(screen.getByText("Check for Updates"));

    await waitFor(() => {
      expect(screen.getByText("Update available: 0.2.0")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Install Update"));

    await waitFor(() => {
      expect(screen.getByText("Update install failed")).toBeInTheDocument();
      expect(screen.getByText("Desktop update failed: signature mismatch")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows desktop-first terminal guidance in settings", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminal Integration" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Terminal Integration" })).toBeInTheDocument();
      expect(screen.getAllByText(/Detected shell:/).length).toBeGreaterThan(0);
      expect(screen.getByText("Config file: ~/.zshrc")).toBeInTheDocument();
      expect(screen.getByText("1. Add the AI Switch line to your shell config.")).toBeInTheDocument();
      expect(screen.getByText("2. Reload the shell config.")).toBeInTheDocument();
      expect(screen.getByText("3. Verify that terminal integration is active.")).toBeInTheDocument();
      expect(screen.getByText("Show advanced terminal commands")).toBeInTheDocument();
    });
  });

  it("pauses shell guidance reads in settings until the mutation queue is idle", async () => {
    const calls: string[] = [];
    let releaseMutation: () => void = () => {
      throw new Error("Expected mutation release handle.");
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      calls.push(command);
      return (
        {
          run_doctor: { summary: { status: "pass" }, checks: [] },
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance",
            manual_apply_examples: [],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo install",
                reload_command: "source ~/.zshrc",
                verify_command: 'echo "$AISW_SHELL_HOOK"',
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    const mutation = enqueueMutation(
      "Hold mutation lock",
      () =>
        new Promise<void>((resolve) => {
          releaseMutation = resolve;
        }),
    );

    await renderSettingsPanel(bootstrap.settings, "shell");

    await waitFor(() => {
      expect(screen.getByText("Shell guidance is unavailable.")).toBeInTheDocument();
    });
    expect(calls).toEqual([]);

    releaseMutation();
    await act(async () => {
      await mutation;
    });

    await waitFor(() => {
      expect(calls).toContain("run_doctor");
      expect(calls).toContain("get_shell_guidance");
      expect(screen.getByText("Config file: ~/.zshrc")).toBeInTheDocument();
    });
  });

  it("pauses onboarding shell guidance reads until the mutation queue is idle", async () => {
    const calls: string[] = [];
    let releaseMutation: () => void = () => {
      throw new Error("Expected mutation release handle.");
    };

    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      calls.push(command);
      return (
        {
          get_bootstrap: bootstrap,
          get_snapshot: bootstrap.snapshot,
          run_doctor: { summary: { status: "pass" }, checks: [] },
          run_init: {
            result: {
              live_accounts: [
                { tool: "claude", outcome: "detected", auth_method: "oauth" },
              ],
            },
          },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          export_diagnostic_bundle: {
            path: "/tmp/ai-switch/ai-switch-diagnostics-123.json",
            filename: "ai-switch-diagnostics-123.json",
            generated_at: "unix:123",
          },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: bootstrap.settings,
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance",
            manual_apply_examples: [],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo install",
                reload_command: "source ~/.zshrc",
                verify_command: 'echo "$AISW_SHELL_HOOK"',
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    const mutation = enqueueMutation(
      "Hold mutation lock",
      () =>
        new Promise<void>((resolve) => {
          releaseMutation = resolve;
        }),
    );

    await renderSetupPanel({
      initReport: {
        result: {
          live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
        },
      },
    });

    expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0);
    expect(calls).not.toContain("run_doctor");
    expect(calls).not.toContain("get_shell_guidance");

    releaseMutation();
    await act(async () => {
      await mutation;
    });

  await waitFor(() => {
      expect(calls).toContain("run_doctor");
      expect(calls).toContain("get_shell_guidance");
      expect(screen.getByText("Refresh Setup")).toBeInTheDocument();
    });
  });

  it("guides onboarding with step footer navigation", async () => {
    await renderSetupPanel({
      initReport: {
        result: {
          live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
        },
      },
    });

    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to First switch" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue to First switch" }));

    expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Try one safe switch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Detected tools" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue to First switch" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Terminal" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Done" }));

    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "You're ready" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Setup completion status")).getByText("Claude Code")).toBeInTheDocument();
  });

  it("shows cross-platform keyring setup guidance in settings", async () => {
    await renderSettingsPanel(bootstrap.settings, "keyring");

    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByText("macOS Keychain")).toBeInTheDocument();
    expect(screen.getByText("Windows Credential Manager")).toBeInTheDocument();
    expect(screen.getByText("Linux Secret Service")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Start a Secret Service provider such as gnome-keyring or KeePassXC with Secret Service enabled.",
      ),
    ).toBeInTheDocument();
  });

  it("exports a redacted diagnostic report from security settings", async () => {
    const calls: string[] = [];
    const defaultMock = window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      calls.push(command);
      return (
        {
          export_diagnostic_bundle: {
            path: "/tmp/ai-switch/ai-switch-diagnostics-123.json",
            filename: "ai-switch-diagnostics-123.json",
            generated_at: "unix:123",
          },
          run_doctor: { summary: { status: "pass" }, checks: [] },
        } as Record<string, unknown>
      )[command] ?? defaultMock[command];
    };

    await renderSettingsPanel(bootstrap.settings, "keyring");
    fireEvent.click(screen.getByRole("button", { name: "Export Redacted Diagnostic Report" }));

    await waitFor(() => {
      expect(calls).toContain("export_diagnostic_bundle");
      expect(screen.getByText("Saved ai-switch-diagnostics-123.json.")).toBeInTheDocument();
      expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
        title: "Diagnostic report exported",
        body: "Saved ai-switch-diagnostics-123.json.",
      });
    });
  });

  it("opens the app data folder from advanced settings", async () => {
    const calls: string[] = [];
    const defaultMock = window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      calls.push(command);
      return (
        {
          open_app_data_folder: "/tmp/ai-switch-desktop",
          run_doctor: { summary: { status: "pass" }, checks: [] },
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance",
            manual_apply_examples: [],
            variants: [],
          },
        } as Record<string, unknown>
      )[command] ?? defaultMock[command];
    };

    await renderSettingsPanel(bootstrap.settings, "advanced");
    fireEvent.click(screen.getByRole("button", { name: "Open App Data Folder" }));

    await waitFor(() => {
      expect(calls).toContain("open_app_data_folder");
      expect(screen.getByText("Opened /tmp/ai-switch-desktop.")).toBeInTheDocument();
      expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
        title: "App data folder opened",
        body: "/tmp/ai-switch-desktop",
      });
    });
  });

  it("saves general desktop preferences from settings", async () => {
    const commands: string[] = [];
    let launchAtLoginEnabled = false;
    const defaultMock = window.__AISW_DESKTOP_MOCK__ as Record<string, unknown>;
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      commands.push(command);
      if (command === "get_launch_at_login_status") {
        return {
          supported: true,
          enabled: launchAtLoginEnabled,
          detail: "macOS login item target: /Applications/AI Switch.app",
        };
      }
      if (command === "set_launch_at_login") {
        launchAtLoginEnabled = Boolean((args as { enabled?: boolean } | undefined)?.enabled);
        return {
          supported: true,
          enabled: launchAtLoginEnabled,
          detail: "macOS login item target: /Applications/AI Switch.app",
        };
      }
      return defaultMock[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByLabelText("Launch at login")).not.toBeChecked();
    expect(screen.getByLabelText("Show menu bar icon")).toBeChecked();
    await waitFor(() => {
      expect(
        screen.getByText(
          "Open AI Switch automatically after you sign in to this computer.",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Reopen Setup Assistant" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Launch at login"));

    fireEvent.change(screen.getByLabelText("Appearance"), {
      target: { value: "dark" },
    });
    fireEvent.click(screen.getByLabelText("Show menu bar icon"));
    fireEvent.change(screen.getByLabelText("Default section"), {
      target: { value: "profiles" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save General Settings" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Launch at login")).toBeChecked();
      expect(window.localStorage.getItem("ai-switch.desktop.appearance")).toBe("dark");
      expect(window.localStorage.getItem("ai-switch.desktop.default-section")).toBe("profiles");
      expect(window.localStorage.getItem("ai-switch.desktop.show-menu-bar-icon")).toBe("false");
      expect(window.localStorage.getItem("ai-switch.desktop.reopen-setup-assistant")).toBe("false");
      expect(document.documentElement.dataset.appearance).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(commands).toContain("set_launch_at_login");
      expect(commands).toContain("set_tray_visibility");
      expect(screen.getByText("Launch at login enabled.")).toBeInTheDocument();
      expect(
        screen.getByText(
          (_, element) =>
            element?.textContent?.trim() ===
            "Next launch opens on Profiles whenever the app can resume normally.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("can reopen and close the setup assistant from settings", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen Setup Assistant" }));

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0);
      expect(window.localStorage.getItem("ai-switch.desktop.reopen-setup-assistant")).toBe("true");
    });

    fireEvent.click(screen.getByRole("button", { name: "Close setup" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
      expect(window.localStorage.getItem("ai-switch.desktop.reopen-setup-assistant")).toBe("false");
    });
  });

  it("can reset onboarding from advanced settings", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Default section"), {
      target: { value: "profiles" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save General Settings" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("ai-switch.desktop.default-section")).toBe("profiles");
    });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset Onboarding" }));

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "Get started" }).length).toBeGreaterThan(0);
      expect(window.localStorage.getItem("ai-switch.desktop.default-section")).toBe("overview");
      expect(window.localStorage.getItem("ai-switch.desktop.reopen-setup-assistant")).toBe("true");
    });
  });

  it("supports arrow-key navigation in settings sections", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    const generalButton = screen.getByRole("button", { name: "General" });
    generalButton.focus();
    expect(generalButton).toHaveFocus();

    fireEvent.keyDown(generalButton, { key: "ArrowDown" });

    await waitFor(() => {
      const runtimeButton = screen.getByRole("button", { name: "Engine" });
      expect(runtimeButton).toHaveFocus();
      expect(runtimeButton).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("heading", { name: "Desktop engine selection" })).toBeInTheDocument();
    });

    const runtimeButton = screen.getByRole("button", { name: "Engine" });
    fireEvent.keyDown(runtimeButton, { key: "End" });

    await waitFor(() => {
      const advancedButton = screen.getByRole("button", { name: "Advanced" });
      expect(advancedButton).toHaveFocus();
      expect(advancedButton).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("heading", { name: "App data folder" })).toBeInTheDocument();
    });
  });

  it("shows runtime detection details in settings", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Engine" }));

    await waitFor(() => {
      expect(screen.getByText("Engine summary")).toBeInTheDocument();
      expect(screen.getAllByText(/Engine version:/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    await waitFor(() => {
      expect(screen.getByText("Engine details")).toBeInTheDocument();
      expect(
        screen.getByText(
          (_, element) => element?.textContent?.trim() === "Data folder: Managed automatically",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, element) => element?.textContent?.trim() === "Release track: Stable"),
      ).toBeInTheDocument();
      expect(screen.getByText("Engine API 1 · JSON schema 1 · Progress schema 1")).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          element?.textContent?.trim() === "Selected engine source: Included with this app",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          element?.textContent?.trim() === "Included engine: Available in this build",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, element) => element?.textContent?.trim() === "System engine: Found on this computer"),
      ).toBeInTheDocument();
    });
  });

  it("resyncs settings inputs when persisted settings change", async () => {
    window.__AISW_DESKTOP_MOCK__ = {
      run_doctor: { summary: { status: "pass" }, checks: [] },
      get_shell_guidance: {
        detected_shell: "zsh",
        capabilities: [],
        note: "Shell hook guidance",
        manual_apply_examples: [],
        variants: [
          {
            shell: "zsh",
            title: "Zsh",
            config_path: "~/.zshrc",
            alternate_config_path: null,
            install_command: "echo install",
            reload_command: "source ~/.zshrc",
            verify_command: 'echo "$AISW_SHELL_HOOK"',
            verify_expected: "1",
          },
        ],
      },
    };

    const firstSettings: DesktopSettings = {
      ...bootstrap.settings,
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
    };
    const nextSettings: DesktopSettings = {
      ...bootstrap.settings,
      runtime_kind: "custom",
      runtime_path: "/opt/aisw/bin/aisw",
      aisw_home: "/tmp/aisw-home",
      update_channel: "beta",
    };

    const rendered = await renderSettingsPanel(firstSettings);
    await waitFor(() => {
      expect(screen.getByLabelText("Settings sections")).toBeInTheDocument();
    });

    expect(screen.getByText("Show manual engine options")).toBeInTheDocument();

    await act(async () => {
      rendered.rerender(
        <QueryClientProvider client={rendered.queryClient}>
          <SettingsPanel
            settings={nextSettings}
            runtimeStatus={bootstrap.runtime_status}
            initialSection="runtime"
          />
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Custom path")).toBeInTheDocument();
      expect(screen.getByDisplayValue("/opt/aisw/bin/aisw")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("/tmp/aisw-home")).toBeInTheDocument();
    });
  });

  it("uses the saved default section on launch", async () => {
    window.localStorage.setItem("ai-switch.desktop.default-section", "profiles");

    await renderApp();

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "Profiles" }).length).toBeGreaterThan(0);
    });
  });

  it("drops the saved custom engine path when switching back to the bundled engine", async () => {
    const updateRequests: DesktopSettings[] = [];
    let currentSettings: DesktopSettings = {
      ...bootstrap.settings,
      runtime_kind: "custom",
      runtime_path: "/opt/aisw/bin/aisw",
      aisw_home: null,
      update_channel: "stable",
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      const requestArgs = args as { request: DesktopSettings } | undefined;
      if (command === "update_settings") {
        updateRequests.push(requestArgs?.request as DesktopSettings);
        currentSettings = requestArgs?.request as DesktopSettings;
        return currentSettings;
      }
      return (
        {
          get_settings: currentSettings,
          run_doctor: { summary: { status: "pass" }, checks: [] },
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance",
            manual_apply_examples: [],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo install",
                reload_command: "source ~/.zshrc",
                verify_command: 'echo "$AISW_SHELL_HOOK"',
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    const rendered = await renderSettingsPanel(currentSettings);
    await waitFor(() => expect(screen.getByLabelText("Settings sections")).toBeInTheDocument());

    expect(screen.getByDisplayValue("/opt/aisw/bin/aisw")).toBeEnabled();

    fireEvent.change(screen.getByDisplayValue("Custom path"), {
      target: { value: "bundled" },
    });

    const runtimePathInput = screen.getByDisplayValue("/opt/aisw/bin/aisw");
    expect(runtimePathInput).toBeDisabled();

    fireEvent.click(screen.getByText("Save Engine Settings"));

    await waitFor(() => {
      expect(updateRequests).toEqual([
        expect.objectContaining({
          runtime_kind: "bundled",
          runtime_path: null,
        }),
      ]);
    });

    await act(async () => {
      rendered.rerender(
        <QueryClientProvider client={rendered.queryClient}>
          <SettingsPanel
            settings={currentSettings}
            runtimeStatus={bootstrap.runtime_status}
            initialSection="runtime"
          />
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByLabelText("Runtime path")).not.toBeInTheDocument();
      expect(screen.getByText("Show manual engine options")).toBeInTheDocument();
    });
  });

  it("drops the saved custom engine path when switching to the system engine", async () => {
    const updateRequests: DesktopSettings[] = [];
    let currentSettings: DesktopSettings = {
      ...bootstrap.settings,
      runtime_kind: "custom",
      runtime_path: "/opt/aisw/bin/aisw",
      aisw_home: null,
      update_channel: "stable",
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      const requestArgs = args as { request: DesktopSettings } | undefined;
      if (command === "update_settings") {
        updateRequests.push(requestArgs?.request as DesktopSettings);
        currentSettings = requestArgs?.request as DesktopSettings;
        return currentSettings;
      }
      return (
        {
          get_settings: currentSettings,
          run_doctor: { summary: { status: "pass" }, checks: [] },
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance",
            manual_apply_examples: [],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo install",
                reload_command: "source ~/.zshrc",
                verify_command: 'echo "$AISW_SHELL_HOOK"',
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    const rendered = await renderSettingsPanel(currentSettings);
    await waitFor(() => expect(screen.getByLabelText("Settings sections")).toBeInTheDocument());

    expect(screen.getByDisplayValue("/opt/aisw/bin/aisw")).toBeEnabled();

    fireEvent.change(screen.getByDisplayValue("Custom path"), {
      target: { value: "system" },
    });

    const runtimePathInput = screen.getByDisplayValue("/opt/aisw/bin/aisw");
    expect(runtimePathInput).toBeDisabled();

    fireEvent.click(screen.getByText("Save Engine Settings"));

    await waitFor(() => {
      expect(updateRequests).toEqual([
        expect.objectContaining({
          runtime_kind: "system",
          runtime_path: null,
        }),
      ]);
    });

    await act(async () => {
      rendered.rerender(
        <QueryClientProvider client={rendered.queryClient}>
          <SettingsPanel
            settings={currentSettings}
            runtimeStatus={bootstrap.runtime_status}
            initialSection="runtime"
          />
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("System engine")).toBeInTheDocument();
      expect(screen.getByLabelText("Engine path")).toHaveValue("");
    });
  });

  it("requires saving settings before updater actions use a changed channel", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSettings: DesktopSettings = bootstrap.settings;
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "update_settings") {
        currentSettings = {
          ...currentSettings,
          ...(args as { request?: DesktopSettings }).request,
        };
        return currentSettings;
      }
      if (command === "check_for_updates") {
        return {
          configured: true,
          channel: currentSettings.update_channel,
          current_version: "0.1.0",
          endpoint: `https://updates.example.com/${currentSettings.update_channel}.json`,
          update: null,
          message: "No update is currently available.",
        };
      }
      return (
        {
          get_bootstrap: {
            ...bootstrap,
            settings: currentSettings,
          },
          get_snapshot: bootstrap.snapshot,
          run_init: { result: { live_accounts: [] } },
          run_doctor: { summary: { status: "pass" } },
          run_verify: { summary: { status: "pass" } },
          run_repair: { result: { mode: "dry_run" } },
          get_workspace_status: { result: { status: "match" } },
          get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
          list_backups: [],
          get_settings: currentSettings,
        } as Record<string, unknown>
      )[command];
    };

    await renderApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Updates" }));
    fireEvent.change(screen.getByDisplayValue("Stable"), {
      target: { value: "beta" },
    });

    expect(
      screen.getByText("Check for a signed desktop release on the selected beta channel."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Save settings before checking for updates so the runtime and channel selection match the persisted desktop configuration.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Check for Updates")).toBeDisabled();

    fireEvent.click(screen.getByText("Save Update Settings"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "update_settings")).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.queryByText(
          "Save settings before checking for updates so the runtime and channel selection match the persisted desktop configuration.",
        ),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Check for Updates")).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText("Check for Updates"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "check_for_updates")).toBe(true);
      expect(screen.getByText("Channel: beta")).toBeInTheDocument();
    });
  });

  it("clears stale update results when settings change and requires a fresh check", async () => {
    let currentSettings: DesktopSettings = bootstrap.settings;
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "check_for_updates") {
        return {
          configured: true,
          channel: currentSettings.update_channel,
          current_version: "0.1.0",
          endpoint: `https://updates.example.com/${currentSettings.update_channel}.json`,
          update: {
            version: currentSettings.update_channel === "beta" ? "0.3.0-beta.1" : "0.2.0",
            current_version: "0.1.0",
            target: "darwin-aarch64",
            notes:
              currentSettings.update_channel === "beta"
                ? "Preview release candidate."
                : "Faster switching and signed updater artifacts.",
          },
          message: null,
        };
      }
      return (
        {
          run_doctor: { summary: { status: "pass" } },
          get_shell_guidance: {
            detected_shell: "zsh",
            capabilities: [],
            note: "Shell hook guidance",
            manual_apply_examples: [],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo install",
                reload_command: "source ~/.zshrc",
                verify_command: 'echo "$AISW_SHELL_HOOK"',
                verify_expected: "1",
              },
            ],
          },
        } as Record<string, unknown>
      )[command];
    };

    const rendered = await renderSettingsPanel(currentSettings, "updates");
    await waitFor(() => expect(screen.getByLabelText("Settings sections")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Check for Updates"));

    await waitFor(() => {
      expect(screen.getByText("Update available: 0.2.0")).toBeInTheDocument();
      expect(screen.getByText("Endpoint: https://updates.example.com/stable.json")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Stable"), {
      target: { value: "beta" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Update available: 0.2.0")).not.toBeInTheDocument();
      expect(screen.queryByText("Endpoint: https://updates.example.com/stable.json")).not.toBeInTheDocument();
    });

    currentSettings = {
      ...currentSettings,
      update_channel: "beta",
    };
    await act(async () => {
      rendered.rerender(
        <QueryClientProvider client={rendered.queryClient}>
          <SettingsPanel
            settings={currentSettings}
            runtimeStatus={bootstrap.runtime_status}
            initialSection="updates"
          />
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText("Check for Updates"));

    await waitFor(() => {
      expect(screen.getByText("Update available: 0.3.0-beta.1")).toBeInTheDocument();
      expect(screen.getByText("Endpoint: https://updates.example.com/beta.json")).toBeInTheDocument();
    });
  });
});
