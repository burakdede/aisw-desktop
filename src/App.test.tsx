import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { App } from "./App";
import { resetLastCommandResultsForTests } from "./features/shared/lastCommandResult";
import { useDesktopActions } from "./features/shared/useDesktopActions";
import { resetMutationQueueForTests } from "./features/shared/mutationQueue";
import type { DesktopSettings } from "./lib/schemas";

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
    resolved_path: "/Applications/AISW.app/Contents/Resources/aisw",
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
      bundled_path: "/Applications/AISW.app/Contents/Resources/aisw",
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

function getProfilesSection() {
  const kicker = screen.getByText("Provisioning");
  const section = kicker.closest("section");
  if (!section) {
    throw new Error("Profiles section not found.");
  }
  return within(section);
}

describe("App", () => {
  beforeEach(() => {
    vi.mocked(window.open).mockClear();
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
      get_workspace_status: { result: { status: "match" } },
      get_project_bindings: { result: { user_bindings: { guard_mode: "warn" } } },
      list_backups: [],
      get_settings: bootstrap.settings,
      get_shell_guidance: {
        detected_shell: "zsh",
        capabilities: [
          "Apply CLAUDE_CONFIG_DIR, CODEX_HOME, and GEMINI_API_KEY into the current shell session when you run `aisw use` or `aisw context use`.",
          "Enforce workspace guardrails before `claude`, `codex`, or `gemini` launch from that shell.",
        ],
        note: "Without the shell hook, `aisw use` still writes live credential files and updates `~/.aisw/config.json`. The hook is only required for current-shell exports and workspace checks.",
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
  });

  it("renders the overview from bootstrap data", async () => {
    await renderApp();
    await waitFor(() => {
      expect(screen.getByText("Control Center")).toBeInTheDocument();
    });
    expect(screen.getByText("Re-apply Work")).toBeInTheDocument();
    expect(screen.getByText("Active set: Work")).toBeInTheDocument();
    expect(screen.getByText("Runtime ready")).toBeInTheDocument();
    expect(screen.getByText("First-run setup")).toBeInTheDocument();
    expect(screen.getByText("Backend check")).toBeInTheDocument();
    expect(screen.getByText("Health check")).toBeInTheDocument();
    expect(screen.getByText("System aisw: /opt/homebrew/bin/aisw")).toBeInTheDocument();
  });

  it("shows compatibility blockers when runtime is not usable", async () => {
    window.__AISW_DESKTOP_MOCK__ = {
      get_bootstrap: {
        ...bootstrap,
        runtime_status: {
          ...bootstrap.runtime_status,
          compatible: false,
          issues: ["aisw does not advertise mutation_json support"],
        },
        snapshot: null,
      },
    };
    await renderApp();
    await waitFor(() => {
      expect(screen.getByText("Runtime compatibility")).toBeInTheDocument();
    });
    expect(
      screen.getByText("aisw does not advertise mutation_json support"),
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
      expect(screen.getByText("Gemini is not available on PATH, so AISW Desktop cannot switch or verify that tool yet.")).toBeInTheDocument();
    });
    expect(screen.getByText("npm install -g @google/gemini-cli")).toBeInTheDocument();
    expect(screen.getByText("gemini --version")).toBeInTheDocument();
    expect(screen.getByText("which gemini")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Open installation guide"));
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
    await waitFor(() => expect(screen.getByText("Control Center")).toBeInTheDocument());

    fireEvent.click(screen.getAllByText("Open details")[1]);

    await waitFor(() => {
      expect(screen.getByText("Provisioning")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Codex")).toBeInTheDocument();
      expect(screen.getByText("Diagnostic details")).toBeInTheDocument();
      expect(screen.getByText("No additional token or runtime warnings are currently reported for this tool.")).toBeInTheDocument();
    });
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
    fireEvent.change(screen.getByDisplayValue("Switch profile set or shared profile…"), {
      target: { value: "profile:work" },
    });
    fireEvent.click(screen.getByText("Switch all"));

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
    await waitFor(() => expect(screen.getByText("Control Center")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Re-apply Work"));

    await waitFor(() => {
      expect(screen.getByText("Last result: Switched claude to work.")).toBeInTheDocument();
    });
    expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
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
    await waitFor(() => expect(screen.getByText("Control Center")).toBeInTheDocument());
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
    fireEvent.click(screen.getByText("Confirm remove active"));

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

  it("shows profile diagnostic details from the current tool status", async () => {
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
                  remediation: "Unlock the system keychain and retry.",
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
                remediation: "Unlock the system keychain and retry.",
              },
            ],
          },
        ],
      },
    };

    await renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    fireEvent.click(screen.getByText("View diagnostic details"));

    await waitFor(() => {
      expect(screen.getByText("Diagnostic details")).toBeInTheDocument();
    });
    expect(screen.getByText("Credential backend: system_keyring")).toBeInTheDocument();
    expect(screen.getByText("Live match: yes")).toBeInTheDocument();
    expect(screen.getByText("Credentials present: no")).toBeInTheDocument();
    expect(screen.getByText("Permissions OK: no")).toBeInTheDocument();
    expect(
      screen.getByText("Token warning: Claude session expires soon Expires in 1 days."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Warning: Keyring access failed. Remediation: Unlock the system keychain and retry.",
      ),
    ).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "work" },
    });

    expect(
      screen.getByText(
        "Claude already has a profile named work. Choose a different name or rename the existing profile first.",
      ),
    ).toBeInTheDocument();
    expect(getProfilesSection().getByText("Add profile")).toBeDisabled();
    expect(calls.some((entry) => entry.command === "add_profile")).toBe(false);
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
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.click(getProfilesSection().getByText("Add profile"));

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
    fireEvent.change(screen.getByLabelText("rename personal"), {
      target: { value: "work" },
    });

    expect(
      screen.getByText(
        "Claude already has a profile named work. Choose a different name or rename the existing profile first.",
      ),
    ).toBeInTheDocument();
    const renameInput = screen.getByLabelText("rename personal");
    const renameRow = renameInput.closest(".list-row") as HTMLElement | null;
    if (!renameRow) {
      throw new Error("Rename row not found.");
    }
    expect(within(renameRow).getByText("Rename")).toBeDisabled();
    expect(calls.some((entry) => entry.command === "rename_profile")).toBe(false);
  });

  it("shows remediation text for profile command failures", async () => {
    window.__AISW_DESKTOP_MOCK__ = async (command) => {
      if (command === "add_profile") {
        throw {
          kind: "KeyringUnavailable",
          message: "keyring unavailable",
          remediation: "Unlock the system keychain and retry.",
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
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.click(getProfilesSection().getByText("Add profile"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "keyring unavailable Remediation: Unlock the system keychain and retry.",
        ),
      ).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Tool"), {
      target: { value: "codex" },
    });
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "ci" },
    });
    fireEvent.change(screen.getByLabelText("Import mode"), {
      target: { value: "from_env" },
    });

    expect(screen.getByText("OPENAI_API_KEY")).toBeInTheDocument();
    fireEvent.click(getProfilesSection().getByText("Add profile"));

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
          import_mode: {
            kind: "from_env",
          },
        },
      },
    });
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
    fireEvent.change(screen.getByLabelText("Tool"), {
      target: { value: "codex" },
    });
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.change(screen.getByLabelText("Import mode"), {
      target: { value: "api_key" },
    });

    const apiKeyInput = screen.getByLabelText("API key") as HTMLInputElement;
    fireEvent.change(apiKeyInput, {
      target: { value: "sk-live-secret" },
    });
    expect(apiKeyInput.value).toBe("sk-live-secret");

    fireEvent.click(getProfilesSection().getByText("Add profile"));

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
          import_mode: {
            kind: "api_key",
            value: "sk-live-secret",
          },
        },
      },
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
    await waitFor(() => expect(screen.getAllByText("Restore and activate")).toHaveLength(2));
    expect(screen.getByText(/Restore replays the saved files only/)).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText(/Affects codex \/ personal/)).toBeInTheDocument();
    expect(screen.getAllByText(/Created:/)).toHaveLength(2);
    const backupsSection = screen.getByRole("heading", { name: "Backups" }).closest(".section-card");
    const articles = backupsSection?.querySelectorAll(".list-row") ?? [];
    expect(articles[0]?.textContent).toContain("Personal");
    expect(articles[1]?.textContent).toContain("Work");
    fireEvent.click(screen.getAllByText("Copy backup ID")[0]);
    await waitFor(() => {
      expect(screen.getByText("Copied backup id 20260326T094012Z-codex-personal.")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText("Restore and activate")[0]);

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "restore_backup")).toBe(true);
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
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
    await waitFor(() => expect(screen.getByText("Open profile details")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Open profile details"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Profiles" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Claude")).toBeInTheDocument();
      expect(screen.getByText("Hide diagnostic details")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "personal" },
    });
    fireEvent.change(screen.getByLabelText("Import mode"), {
      target: { value: "oauth" },
    });
    fireEvent.click(screen.getByText("Start OAuth"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "add_profile_oauth")).toBe(true);
      expect(screen.getByText("OAuth progress")).toBeInTheDocument();
      expect(screen.getByText("0. Starting OAuth")).toBeInTheDocument();
      expect(screen.getByText("1. Starting upstream login")).toBeInTheDocument();
      expect(screen.getByText("2. Waiting for login completion")).toBeInTheDocument();
      expect(screen.getByText("3. Saving captured profile")).toBeInTheDocument();
      expect(screen.getByText("4. Profile saved")).toBeInTheDocument();
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

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "restore_backup")).toBe(true);
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
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
    await waitFor(() => expect(screen.getByText("Switch all")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("Switch profile set or shared profile…"), {
      target: { value: "profile:work" },
    });
    fireEvent.click(screen.getByText("Switch all"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(true);
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

    await renderApp();
    await waitFor(() => expect(screen.getByText("First-run setup")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("First switch profile"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByText("Switch now"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(true);
      expect(screen.getByText("Shell guidance")).toBeInTheDocument();
      expect(screen.getByText(/AISW runtime contract/)).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("Control Center")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("import claude current login"), {
      target: { value: "recovered" },
    });
    fireEvent.click(screen.getByText("Import current as new"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "add_profile")).toBe(true);
      expect(screen.getByText("Live credentials changed outside AISW. Re-apply the active profile or import the current login as a new profile.")).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("Workspaces")).toBeInTheDocument());
    await waitFor(() => {
      expect(screen.getByText("Workspace wants a different context")).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          element?.tagName === "P" && element.textContent?.trim() === "Expected profile set: client-acme",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          element?.tagName === "P" && element.textContent?.trim() === "Current context: work",
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Use expected context now")[0]);
    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(true);
    });
    expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
      title: "Workspace switch",
      body: "Switched to client-acme for /code/acme.",
    });

    fireEvent.click(screen.getByText("Workspaces"));
    await waitFor(() => {
      expect(screen.getByText(/Current context:\s*work/)).toBeInTheDocument();
      expect(screen.getByText(/Expected context:\s*client-acme/)).toBeInTheDocument();
      expect(screen.getByText(/Guard mode:\s*warn/)).toBeInTheDocument();
      expect(screen.getByText("path · /code/acme")).toBeInTheDocument();
      expect(screen.getByText("Workspace mismatch")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Keep current context"));
    await waitFor(() => {
      expect(screen.queryByText("Workspace mismatch")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Binding scope"), {
      target: { value: "path" },
    });
    fireEvent.change(screen.getByLabelText("Context"), {
      target: { value: "client-acme" },
    });
    fireEvent.change(screen.getByLabelText("Path"), {
      target: { value: "/code/next" },
    });
    fireEvent.click(screen.getByText("Save binding"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "workspace_bind")).toBe(true);
    });
    expect(screen.getByRole("option", { name: "Profile set: Client Acme" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Remove this binding"));
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
    fireEvent.click(screen.getByText("Apply safe repairs"));

    await waitFor(() => {
      expect(screen.getByText("Last applied repair")).toBeInTheDocument();
      expect(screen.getByText("1 actions applied")).toBeInTheDocument();
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
                detail: "System keyring is locked.",
                remediation: "Unlock the system keychain and retry.",
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
      expect(screen.getAllByText("System keyring is locked.").length).toBeGreaterThan(0);
      expect(screen.getAllByText("AISW cannot write the active config path.").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Upstream OAuth session timed out.").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Unlock the system keychain and retry.")).toBeInTheDocument();
    expect(screen.getByText("Grant write access to ~/.aisw")).toBeInTheDocument();
    expect(screen.getByText("Retry the switch")).toBeInTheDocument();
    expect(
      screen.getByText("Run the guided OAuth flow again and finish login before timeout."),
    ).toBeInTheDocument();
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
      expect(screen.getByText("Direct fixes")).toBeInTheDocument();
      expect(screen.getByText("codex is missing")).toBeInTheDocument();
      expect(screen.getByText("claude live mismatch")).toBeInTheDocument();
      expect(screen.getByText("Workspace context mismatch")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Open installation guide"));
    expect(window.open).toHaveBeenCalledWith(
      "https://www.npmjs.com/package/@openai/codex",
      "_blank",
      "noopener,noreferrer",
    );

    fireEvent.click(screen.getByText("Re-apply Work"));
    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
    });

    fireEvent.click(screen.getByText("Use expected context now"));
    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(true);
    });
    expect(window.__AISW_DESKTOP_NOTIFY__).toHaveBeenCalledWith({
      title: "Workspace switch",
      body: "Switched to client-acme for /code/acme.",
    });
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

    await waitFor(() => expect(screen.getByText("claude live mismatch")).toBeInTheDocument());
    const mismatchCard = screen.getByText("claude live mismatch").closest("article");
    expect(mismatchCard).not.toBeNull();
    fireEvent.click(within(mismatchCard!).getByText("Open profile details"));

    await waitFor(() =>
      expect(screen.getByText("Credential backend: system_keyring")).toBeInTheDocument(),
    );
    expect(screen.getByText("Diagnostic details")).toBeInTheDocument();
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
                detail: "System keyring is locked.",
                remediation: ["Unlock the system keychain and retry."],
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
  });

  it("reruns setup detection when Start setup is clicked", async () => {
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
        if (initCalls === 1) {
          return { result: { live_accounts: [] } };
        }
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
    await waitFor(() => expect(screen.getByText("First-run setup")).toBeInTheDocument());
    await waitFor(() => {
      expect(screen.getByText("Run the setup scan to detect live Claude, Codex, and Gemini accounts.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start setup"));

    await waitFor(() => {
      expect(screen.getByText("detected · oauth")).toBeInTheDocument();
      expect(initCalls).toBeGreaterThanOrEqual(2);
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
    await waitFor(() => expect(screen.getByText("First-run setup")).toBeInTheDocument());
    await waitFor(() => {
      expect(screen.getByText("No live credentials detected")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Add codex profile"));

    await waitFor(() => {
      expect(screen.getByText("Provisioning")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Codex")).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("First-run setup")).toBeInTheDocument());
    expect(screen.getAllByText("No live credentials detected").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Add codex profile")).toBeInTheDocument();
  });

  it("opens diagnostics when the tray requests it", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByText("Control Center")).toBeInTheDocument());

    const handlers = (window as typeof window & {
      __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
    }).__AISW_DESKTOP_EVENT_HANDLERS__;

    await act(async () => {
      handlers?.["tray-open-diagnostics"]?.({});
    });

    await waitFor(() => {
      expect(screen.getByText("Doctor · Verify · Repair")).toBeInTheDocument();
    });
  });

  it("records tray command results and shows a desktop notification", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByText("Control Center")).toBeInTheDocument());

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

  it("saves and activates a local profile set", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSettings: DesktopSettings = bootstrap.settings;
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
        currentSettings = {
          ...currentSettings,
          profile_sets: [
            {
              name: "client-acme",
              label: "Client Acme",
              profiles: { claude: "work", codex: "work", gemini: null },
            },
          ],
        };
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
    await waitFor(() => expect(screen.getByText("Contexts")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Contexts"));
    fireEvent.change(screen.getByLabelText("Profile set name"), {
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
    fireEvent.click(screen.getByText("Save profile set"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "update_settings")).toBe(true);
      expect(screen.getByText("Client Acme")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Activate set"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(true);
    });
  });

  it("prefers the native CLI context when a profile set matches it", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
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
    };

    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "activate_profile_set") {
        return { command, snapshot: contextSnapshot };
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
            snapshot: contextSnapshot,
          },
          get_snapshot: contextSnapshot,
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
    await waitFor(() => expect(screen.getByText("Contexts")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Contexts"));
    fireEvent.click(screen.getByText("Activate set"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "activate_profile_set")).toBe(true);
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
    await waitFor(() => expect(screen.getByText("Switch all")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("Switch profile set or shared profile…"), {
      target: { value: "set:client-acme" },
    });
    fireEvent.click(screen.getByText("Switch all"));

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
    await waitFor(() => expect(screen.getByText("Switch all")).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Shared profile: Office" })).toBeInTheDocument();
  });

  it("uses saved profile labels in onboarding first switch options and sidebar badge", async () => {
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
    await waitFor(() => expect(screen.getByText("First-run setup")).toBeInTheDocument());
    expect(screen.getByText("Active set: Office")).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("Contexts")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Contexts"));

    expect(screen.getByText("Client Acme")).toBeInTheDocument();
    expect(screen.getByText("client-acme")).toBeInTheDocument();
    expect(screen.getAllByText("claude: Office · codex: Code Work · gemini: none")).toHaveLength(2);
    expect(screen.getAllByRole("option", { name: "Office" }).length).toBeGreaterThanOrEqual(2);
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
    await waitFor(() => expect(screen.getByText("Settings")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Settings"));
    fireEvent.click(screen.getByText("Check for updates"));

    await waitFor(() => {
      expect(screen.getByText("Update available: 0.2.0")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Install update"));

    await waitFor(() => {
      expect(screen.getByText("Update installed. Restart has been requested.")).toBeInTheDocument();
      expect(calls.some((entry) => entry.command === "check_for_updates")).toBe(true);
      expect(calls.some((entry) => entry.command === "install_update")).toBe(true);
    });
  });

  it("shows explicit shell hook guidance in settings", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByText("Settings")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Settings"));

    await waitFor(() => {
      expect(screen.getByText("Shell hook")).toBeInTheDocument();
      expect(screen.getByText(/Detected shell:/)).toBeInTheDocument();
      expect(screen.getByText("Config file: ~/.zshrc")).toBeInTheDocument();
      expect(screen.getByText("echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc")).toBeInTheDocument();
      expect(screen.getByText("source ~/.zshrc")).toBeInTheDocument();
      expect(screen.getByText("echo \"$AISW_SHELL_HOOK\"")).toBeInTheDocument();
    });
  });

  it("shows runtime detection details in settings", async () => {
    await renderApp();
    await waitFor(() => expect(screen.getByText("Settings")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Settings"));

    await waitFor(() => {
      expect(screen.getByText("Runtime detection")).toBeInTheDocument();
      expect(
        screen.getByText("Current resolved path: /Applications/AISW.app/Contents/Resources/aisw"),
      ).toBeInTheDocument();
      expect(
        screen.getAllByText("Bundled aisw: /Applications/AISW.app/Contents/Resources/aisw").length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText("System aisw: /opt/homebrew/bin/aisw").length).toBeGreaterThan(0);
      expect(
        screen.getByText((_, element) => element?.textContent?.trim() === "Selected backend: Bundled"),
      ).toBeInTheDocument();
    });
  });
});
