import { expect, test, type Page } from "@playwright/test";

type ScenarioName = "onboarding" | "switching" | "profiles";

const toolCapabilities = {
  claude: { state_modes: ["isolated", "shared"] },
  codex: { state_modes: ["isolated", "shared"] },
  gemini: { state_modes: [] },
};

test("imports detected Claude, Codex, and Gemini accounts during onboarding", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "First-run setup" })).toBeVisible();
  await expect(page.getByText("detected · oauth").first()).toBeVisible();

  await importDetectedAccount(page, "claude", "work");
  await importDetectedAccount(page, "codex", "ops");
  await importDetectedAccount(page, "gemini", "travel");

  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByLabel("Tool").selectOption("claude");
  await expect(page.locator(".list-row p").filter({ hasText: "work · oauth" }).first()).toBeVisible();
  await expect(page.locator(".list-row strong").filter({ hasText: "Work" }).first()).toBeVisible();

  await page.getByLabel("Tool").selectOption("codex");
  await expect(page.getByText("ops · oauth")).toBeVisible();
  await expect(page.locator(".list-row strong").filter({ hasText: "Ops" })).toBeVisible();

  await page.getByLabel("Tool").selectOption("gemini");
  await expect(page.getByText("travel · oauth")).toBeVisible();
  await expect(page.locator(".list-row strong").filter({ hasText: "Travel" })).toBeVisible();
});

test("switches shared profiles and recovers from live mismatch", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await page.getByLabel("import claude current login").fill("incident");
  await page.getByRole("button", { name: "Import current as new" }).click();

  await expect(page.getByText("Imported current claude login as incident.")).toBeVisible();

  await page.getByRole("combobox").first().selectOption("work");
  await page.getByRole("button", { name: "Switch all" }).click();

  await expect(page.getByText("Switched all tools to work.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "work" }).nth(1)).toBeVisible();

  await page.getByRole("button", { name: "Profiles" }).click();
  await expect(page.getByText("incident · oauth")).toBeVisible();
});

test("switches one tool and refreshes the active profile state", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByLabel("Tool").selectOption("codex");

  await expect(page.getByText("Active: no")).toBeVisible();
  await page
    .locator(".list-row")
    .filter({ hasText: "work · api_key" })
    .getByRole("button", { name: /^Activate$/ })
    .click();

  await expect(page.getByText("Active: yes · Backend: system_keyring")).toBeVisible();

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.locator(".tool-card").filter({ hasText: "Codex" }).getByRole("heading", { name: "work" })).toBeVisible();
});

test("creates profiles from environment and API key modes", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");

  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByLabel("Tool").selectOption("codex");
  await page.getByLabel("Profile name").fill("ci");
  await page.getByLabel("Import mode").selectOption("from_env");
  await expect(page.getByText("OPENAI_API_KEY")).toBeVisible();
  await page.getByRole("button", { name: "Add profile" }).click();
  await expect(page.getByText("ci · api_key")).toBeVisible();

  await page.getByLabel("Tool").selectOption("claude");
  await page.getByLabel("Profile name").fill("ops");
  await page.getByLabel("Import mode").selectOption("api_key");
  await page.locator('input[type="password"]').fill("sk-ant-live-secret");
  await page.getByRole("button", { name: "Add profile" }).click();
  await expect(page.getByText("ops · api_key")).toBeVisible();
});

test("warns before backup restore and re-activates the restored profile", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await page.getByRole("button", { name: "Backups" }).click();
  await expect(
    page.getByText(
      "Restore replays the saved files only. It does not activate that profile again until you run a matching use action or choose restore and activate here.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Restore and activate" }).click();

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.locator(".tool-card").filter({ hasText: "Codex" }).getByRole("heading", { name: "work" })).toBeVisible();
});

async function installDesktopMock(page: Page, scenario: ScenarioName) {
  await page.addInitScript(
    ({ activeScenario, capabilities }) => {
      const deepClone = (value) => JSON.parse(JSON.stringify(value));

      const bootstrapSettings = {
        runtime_kind: "bundled",
        runtime_path: null,
        aisw_home: null,
        update_channel: "stable",
        profile_sets: [],
      };

      const baseBootstrap = {
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
            tools: capabilities,
          },
          compatible: true,
          issues: [],
        },
        snapshot: null,
      };

      const scenarios = {
        onboarding: {
          snapshot: {
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
              },
              {
                tool: "codex",
                binary_found: true,
                stored_profiles: 0,
                active_profile: null,
                auth_method: null,
                credential_backend: null,
                state_mode: "isolated",
                active_profile_applied: null,
                credentials_present: false,
                permissions_ok: true,
              },
              {
                tool: "gemini",
                binary_found: true,
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
            profiles: {
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
              },
              codex: {
                active: null,
                profiles: [],
              },
              gemini: {
                active: null,
                profiles: [],
              },
            },
            contexts: [],
          },
          initReport: {
            result: {
              live_accounts: [
                { tool: "claude", outcome: "detected", auth_method: "oauth" },
                { tool: "codex", outcome: "detected", auth_method: "oauth" },
                { tool: "gemini", outcome: "detected", auth_method: "oauth" },
              ],
            },
          },
        },
        switching: {
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
                active_profile_applied: false,
                credentials_present: true,
                permissions_ok: true,
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
              claude: {
                active: "work",
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
              gemini: {
                active: null,
                profiles: [],
              },
            },
            contexts: [],
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        profiles: {
          snapshot: {
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
              },
              {
                tool: "gemini",
                binary_found: true,
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
            profiles: {
              claude: {
                active: null,
                profiles: [],
              },
              codex: {
                active: null,
                profiles: [],
              },
              gemini: {
                active: null,
                profiles: [],
              },
            },
            contexts: [],
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
      };

      const scenarioState = scenarios[activeScenario];
      const state = {
        bootstrap: {
          ...deepClone(baseBootstrap),
          snapshot: deepClone(scenarioState.snapshot),
        },
        snapshot: deepClone(scenarioState.snapshot),
        initReport: deepClone(scenarioState.initReport),
      };

      const cloneSnapshot = () => deepClone(state.snapshot);
      const listeners = new Map();

      const ensureToolEntry = (tool) => {
        if (!state.snapshot.profiles[tool]) {
          state.snapshot.profiles[tool] = { active: null, profiles: [] };
        }
        if (!state.snapshot.statuses.find((entry) => entry.tool === tool)) {
          state.snapshot.statuses.push({
            tool,
            binary_found: true,
            stored_profiles: 0,
            active_profile: null,
            auth_method: null,
            credential_backend: "system_keyring",
            state_mode: tool === "gemini" ? null : "isolated",
            active_profile_applied: null,
            credentials_present: false,
            permissions_ok: true,
          });
        }
      };

      const syncStoredProfiles = (tool) => {
        const profileEntry = state.snapshot.profiles[tool];
        const statusEntry = state.snapshot.statuses.find((entry) => entry.tool === tool);
        if (profileEntry && statusEntry) {
          statusEntry.stored_profiles = profileEntry.profiles.length;
        }
      };

      window.__AISW_DESKTOP_LISTEN__ = async (event, handler) => {
        listeners.set(event, handler);
        return () => listeners.delete(event);
      };

      window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
        if (command === "get_bootstrap") {
          return {
            ...deepClone(state.bootstrap),
            snapshot: cloneSnapshot(),
          };
        }
        if (command === "get_snapshot") {
          return cloneSnapshot();
        }
        if (command === "run_doctor") {
          return { summary: { status: "pass" }, checks: [] };
        }
        if (command === "run_verify") {
          return { summary: { status: "pass" } };
        }
        if (command === "run_init") {
          return deepClone(state.initReport);
        }
        if (command === "get_workspace_status") {
          return { result: { status: "match" } };
        }
        if (command === "get_project_bindings") {
          return { result: { user_bindings: { guard_mode: "warn" } } };
        }
        if (command === "list_backups") {
          if (activeScenario === "switching") {
            return [
              {
                backup_id: "20260325T114502Z-codex-work",
                tool: "codex",
                profile: "codex/work",
              },
            ];
          }
          return [];
        }
        if (command === "get_settings") {
          return deepClone(bootstrapSettings);
        }
        if (command === "get_shell_guidance") {
          return {
            detected_shell: "zsh",
            capabilities: [],
            note: "",
            manual_apply_examples: [],
            variants: [],
          };
        }
        if (command === "add_profile") {
          const request = args.request;
          ensureToolEntry(request.tool);
          const auth = request.import_mode.kind === "from_live" ? "oauth" : "api_key";
          state.snapshot.profiles[request.tool].profiles.push({
            name: request.profile,
            auth,
            label: request.label ?? null,
          });
          state.snapshot.profiles[request.tool].active = request.profile;
          const statusEntry = state.snapshot.statuses.find((entry) => entry.tool === request.tool);
          if (statusEntry) {
            statusEntry.active_profile = request.profile;
            statusEntry.auth_method = auth;
            statusEntry.active_profile_applied = true;
            statusEntry.credentials_present = true;
            statusEntry.state_mode = request.state_mode ?? statusEntry.state_mode;
          }
          syncStoredProfiles(request.tool);
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "use_all_profiles") {
          const request = args.request;
          state.snapshot.statuses.forEach((entry) => {
            const matching = state.snapshot.profiles[entry.tool]?.profiles.find(
              (profile) => profile.name === request.profile,
            );
            if (!matching) {
              return;
            }
            state.snapshot.profiles[entry.tool].active = request.profile;
            entry.active_profile = request.profile;
            entry.auth_method = matching.auth;
            entry.active_profile_applied = true;
            entry.state_mode = request.state_mode ?? entry.state_mode;
          });
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "use_profile") {
          const request = args.request;
          const profileEntry = state.snapshot.profiles[request.tool];
          const statusEntry = state.snapshot.statuses.find((entry) => entry.tool === request.tool);
          const matching = profileEntry?.profiles.find((profile) => profile.name === request.profile);
          if (profileEntry && statusEntry && matching) {
            profileEntry.active = request.profile;
            statusEntry.active_profile = request.profile;
            statusEntry.auth_method = matching.auth;
            statusEntry.active_profile_applied = true;
            statusEntry.state_mode = request.state_mode ?? statusEntry.state_mode;
          }
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "restore_backup") {
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "add_profile_oauth") {
          const request = args.request;
          const emit = listeners.get("oauth-progress");
          if (emit) {
            emit({ seq: 1, phase: "browser_launch", message: "Launching browser" });
            emit({ seq: 2, phase: "waiting_for_login", message: "Waiting for login" });
            emit({ seq: 3, phase: "profile_saved", message: "Profile saved" });
          }
          ensureToolEntry(request.tool);
          state.snapshot.profiles[request.tool].profiles.push({
            name: request.profile,
            auth: "oauth",
            label: request.label ?? null,
          });
          state.snapshot.profiles[request.tool].active = request.profile;
          syncStoredProfiles(request.tool);
          return { command, snapshot: cloneSnapshot() };
        }
        throw new Error(`Unhandled desktop command: ${command}`);
      };
    },
    { activeScenario: scenario, capabilities: toolCapabilities },
  );
}

async function importDetectedAccount(page: Page, tool: string, profile: string) {
  const form = page.locator("form").filter({ has: page.getByLabel(`${tool} profile name`) });
  await form.getByLabel(`${tool} profile name`).fill(profile);
  await form.getByRole("button", { name: "Import current login" }).click();
}
