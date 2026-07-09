import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { App } from "./App";
import { useDesktopActions } from "./features/shared/useDesktopActions";
import type { DesktopSettings } from "./lib/schemas";

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
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

function renderApp() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App", () => {
  beforeEach(() => {
    let oauthHandler: ((payload: unknown) => void) | undefined;
    window.__AISW_DESKTOP_LISTEN__ = async (event, handler) => {
      if (event === "oauth-progress") {
        oauthHandler = handler as (payload: unknown) => void;
      }
      return () => {
        oauthHandler = undefined;
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
  });

  afterEach(() => {
    delete window.__AISW_DESKTOP_MOCK__;
    delete window.__AISW_DESKTOP_LISTEN__;
  });

  it("renders the overview from bootstrap data", async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText("Control Center")).toBeInTheDocument();
    });
    expect(screen.getByText("Re-apply work")).toBeInTheDocument();
    expect(screen.getByText("Runtime ready")).toBeInTheDocument();
    expect(screen.getByText("First-run setup")).toBeInTheDocument();
    expect(screen.getByText("Backend check")).toBeInTheDocument();
    expect(screen.getByText("Health check")).toBeInTheDocument();
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
    renderApp();
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

    renderApp();
    await waitFor(() => {
      expect(screen.getByText("Gemini is not available on PATH, so AISW Desktop cannot switch or verify that tool yet.")).toBeInTheDocument();
    });
    expect(screen.getByText("npm install -g @google/gemini-cli")).toBeInTheDocument();
    expect(screen.getByText("gemini --version")).toBeInTheDocument();
    expect(screen.getByText("which gemini")).toBeInTheDocument();
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

    renderApp();
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

    renderApp();
    await waitFor(() => expect(screen.getAllByRole("heading", { name: "work" }).length).toBeGreaterThan(0));
    fireEvent.change(screen.getByDisplayValue("Switch all tools to…"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByText("Switch all"));

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "personal" }).length).toBeGreaterThan(0);
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

    renderApp();
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

    renderApp();
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

    renderApp();
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

    renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByText("Add profile"));

    await waitFor(() => {
      expect(screen.getByText("duplicate profile")).toBeInTheDocument();
    });
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

    renderApp();
    await waitFor(() => expect(screen.getByText("Profiles")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Profiles"));
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "ops" },
    });
    fireEvent.click(screen.getByText("Add profile"));

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

    renderApp();
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
    fireEvent.click(screen.getByText("Add profile"));

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

    renderApp();
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

    fireEvent.click(screen.getByText("Add profile"));

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
          ],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    renderApp();
    await waitFor(() => expect(screen.getByText("Backups")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Backups"));
    await waitFor(() => expect(screen.getByText("Restore and activate")).toBeInTheDocument());
    expect(screen.getByText(/Restore replays the saved files only/)).toBeInTheDocument();
    expect(screen.getByText(/Created:/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Copy backup ID"));
    await waitFor(() => {
      expect(screen.getByText("Copied backup id 20260325T114502Z-claude-work.")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Restore and activate"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "restore_backup")).toBe(true);
      expect(calls.some((entry) => entry.command === "use_profile")).toBe(true);
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

    renderApp();
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

    renderApp();
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

    renderApp();
    await waitFor(() => expect(screen.getByText("Switch all")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("Switch all tools to…"), {
      target: { value: "work" },
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

    renderApp();
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

    renderApp();
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
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "workspace_bind") {
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
          get_workspace_status: {
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
          },
          get_project_bindings: {
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
          },
          list_backups: [],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    renderApp();
    await waitFor(() => expect(screen.getByText("Workspaces")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Workspaces"));
    await waitFor(() => {
      expect(screen.getByText(/Current context:\s*work/)).toBeInTheDocument();
      expect(screen.getByText(/Expected context:\s*client-acme/)).toBeInTheDocument();
      expect(screen.getByText(/Guard mode:\s*warn/)).toBeInTheDocument();
      expect(screen.getByText("path · /code/acme")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Default context"), {
      target: { value: "path" },
    });
    fireEvent.change(screen.getByLabelText("Path"), {
      target: { value: "/code/next" },
    });
    fireEvent.click(screen.getByText("Save binding"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "workspace_bind")).toBe(true);
    });
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

    renderApp();
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

    renderApp();
    await waitFor(() => expect(screen.getByText("Diagnostics")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Diagnostics"));

    await waitFor(() => {
      expect(screen.getByText("System keyring is locked.")).toBeInTheDocument();
      expect(screen.getByText("AISW cannot write the active config path.")).toBeInTheDocument();
      expect(screen.getByText("Upstream OAuth session timed out.")).toBeInTheDocument();
    });
    expect(screen.getByText("Unlock the system keychain and retry.")).toBeInTheDocument();
    expect(screen.getByText("Grant write access to ~/.aisw")).toBeInTheDocument();
    expect(screen.getByText("Retry the switch")).toBeInTheDocument();
    expect(
      screen.getByText("Run the guided OAuth flow again and finish login before timeout."),
    ).toBeInTheDocument();
  });

  it("saves and activates a local profile set", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    let currentSettings: DesktopSettings = bootstrap.settings;
    window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
      calls.push({ command, args });
      if (command === "get_bootstrap") {
        return {
          ...bootstrap,
          settings: currentSettings,
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
      if (command === "use_all_profiles") {
        return { command, snapshot: bootstrap.snapshot };
      }
      return (
        {
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

    renderApp();
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
      expect(calls.some((entry) => entry.command === "use_all_profiles")).toBe(true);
    });
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

    renderApp();
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
    renderApp();
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
});
