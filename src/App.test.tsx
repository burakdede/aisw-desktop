import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";

const bootstrap = {
  settings: {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
  },
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
    };
  });

  afterEach(() => {
    delete window.__AISW_DESKTOP_MOCK__;
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
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(calls.some((entry) => entry.command === "rename_profile")).toBe(true);
      expect(calls.some((entry) => entry.command === "remove_profile")).toBe(true);
    });
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
            { backup_id: "b1", tool: "claude", profile: "claude/work" },
          ],
          get_settings: bootstrap.settings,
        } as Record<string, unknown>
      )[command];
    };

    renderApp();
    await waitFor(() => expect(screen.getByText("Backups")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Backups"));
    await waitFor(() => expect(screen.getByText("Restore and activate")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Restore and activate"));

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
});
