import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
      run_verify: { summary: { status: "pass" } },
      run_repair: { result: { mode: "dry_run" } },
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
});
