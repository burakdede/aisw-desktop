import { expect, test, type Page } from "@playwright/test";

type ScenarioName =
  | "onboarding"
  | "switching"
  | "profiles"
  | "missingTool"
  | "partialSetup"
  | "updaterError";

const toolCapabilities = {
  claude: { state_modes: ["isolated", "shared"] },
  codex: { state_modes: ["isolated", "shared"] },
  gemini: { state_modes: [] },
};

test("imports detected Claude, Codex, and Gemini accounts during onboarding", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "First-run setup" })).toBeVisible();
  await expect(page.getByText("Active set: Work")).toBeVisible();
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

test("opens shell setup from onboarding", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");

  await expect(page.getByText("Detected shell:")).toBeVisible();
  await page.getByRole("button", { name: "Open shell setup" }).click();

  await expect(page.getByRole("heading", { name: "Shell hook" })).toBeVisible();
  await expect(page.getByText("Config file: ~/.zshrc")).toBeVisible();
});

test("opens profile setup from onboarding when first-switch options are missing", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");

  await page.getByRole("button", { name: "Open profile setup" }).click();

  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(page.getByLabel("Tool")).toHaveValue("claude");
});

test("keeps onboarding usable when another installed tool has no live credentials", async ({ page }) => {
  await installDesktopMock(page, "partialSetup");

  await page.goto("/");

  await expect(page.getByText("No live credentials detected").first()).toBeVisible();
  await page.getByLabel("Add codex profile").click();

  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(page.getByLabel("Tool")).toHaveValue("codex");
});

test("switches shared profiles and recovers from live mismatch", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await page.getByLabel("import claude current login").fill("incident");
  await page.getByRole("button", { name: "Import current as new" }).click();

  await expect(page.getByText("Last result: Saved claude profile incident.")).toBeVisible();

  const overview = page.locator(".section-card").filter({ hasText: "Control Center" });
  await overview.getByRole("combobox").first().selectOption("profile:work");
  await overview.getByRole("button", { name: "Switch all" }).click();

  await expect(page.getByText("Last bulk result: Switched all tools to work.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Work" }).nth(1)).toBeVisible();

  await page.getByRole("button", { name: "Profiles" }).click();
  await expect(page.getByText("incident · oauth")).toBeVisible();
});

test("opens profile diagnostics from a diagnostics live mismatch card", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await page.getByRole("button", { name: "Diagnostics" }).click();
  const mismatchCard = page.locator(".diagnostic-card").filter({ hasText: "claude live mismatch" });
  await mismatchCard.getByRole("button", { name: "Open profile details" }).click();

  await expect(page.getByText("Credential backend: system_keyring")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide diagnostic details" }).first()).toBeVisible();
  await expect(page.getByText("Live mismatch detected")).toBeVisible();
});

test("imports the current login as a new profile from diagnostics", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await page.getByRole("button", { name: "Diagnostics" }).click();
  await page.getByLabel("import claude current login from diagnostics").fill("incident");
  await page.getByRole("button", { name: "Import current as new" }).click();

  await page.getByRole("button", { name: "Profiles" }).click();
  await expect(page.getByText("incident · oauth")).toBeVisible();
});

test("switches one tool directly from overview and refreshes the active profile state", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  const codexCard = page.locator(".tool-card").filter({ hasText: "Codex" });
  await codexCard.getByLabel("Switch codex profile").selectOption("work");
  await codexCard.getByRole("button", { name: "Switch to Work" }).click();

  await expect(codexCard.getByRole("heading", { name: "Work" })).toBeVisible();
  await expect(codexCard.getByText("Last result: Switched codex to work.")).toBeVisible();
});

test("activates a local profile set from overview quick switch", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  const overview = page.locator(".section-card").filter({ hasText: "Control Center" });
  await overview.getByRole("combobox").first().selectOption("set:client-acme");
  await overview.getByRole("button", { name: "Switch all" }).click();

  await expect(page.getByText("Last bulk result: Activated profile set client-acme.")).toBeVisible();
  await expect(page.locator(".tool-card").filter({ hasText: "Codex" }).getByRole("heading", { name: "Work" })).toBeVisible();
});

test("binds and resolves workspace context from the workspaces panel", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Workspaces" }).click();

  await expect(page.getByRole("heading", { name: "Workspace mismatch" })).toBeVisible();
  await expect(page.getByText("Current context: work")).toBeVisible();
  await expect(page.getByText("Expected context: client-acme")).toBeVisible();
  await expect(page.getByText("path · /code/acme")).toBeVisible();

  await page.getByRole("button", { name: "Use expected context now" }).click();
  await expect(page.getByText("Current context: client-acme")).toBeVisible();
  await expect(page.getByText("Expected context: client-acme")).toBeVisible();

  const workspacesForm = page.locator("form.stacked-form");
  await workspacesForm.getByLabel("Binding scope").selectOption("path");
  await workspacesForm.locator("select").nth(1).selectOption("client-acme");
  await workspacesForm.getByRole("textbox").fill("/code/next");
  await workspacesForm.getByRole("button", { name: "Save binding" }).click();

  await expect(page.getByText("path · /code/next")).toBeVisible();

  await page.getByRole("button", { name: "Guard strict" }).click();
  await expect(page.getByText("Guard mode: strict")).toBeVisible();

  await page.getByRole("button", { name: "Remove this binding" }).first().click();
  await expect(page.getByText("path · /code/acme")).not.toBeVisible();
});

test("shows missing-tool guidance and opens the install guide from diagnostics", async ({ page }) => {
  await installDesktopMock(page, "missingTool");

  await page.goto("/");

  await expect(
    page.getByText(
      "Gemini is not available on PATH, so AISW Desktop cannot switch or verify that tool yet.",
    ),
  ).toBeVisible();
  await expect(page.getByText("npm install -g @google/gemini-cli")).toBeVisible();
  await expect(page.getByText("gemini --version")).toBeVisible();
  await expect(page.getByText(/(which|where) gemini/)).toBeVisible();

  await page.getByRole("button", { name: "Diagnostics" }).click();
  const missingToolCard = page.locator(".diagnostic-card").filter({ hasText: "gemini is missing" });
  await expect(missingToolCard).toBeVisible();
  await missingToolCard.getByRole("button", { name: "Open installation guide" }).click();

  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { __AISW_OPENED_GUIDES__?: string[] }).__AISW_OPENED_GUIDES__ ?? []),
    )
    .toContain("https://www.npmjs.com/package/@google/gemini-cli");
});

test("shows remediation when the updater configuration is invalid", async ({ page }) => {
  await installDesktopMock(page, "updaterError");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Check for updates" }).click();

  await expect(page.getByRole("heading", { name: "Update check failed" })).toBeVisible();
  await expect(page.getByText("Desktop update failed: invalid endpoint")).toBeVisible();
  await expect(
    page.getByText(
      "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
    ),
  ).toBeVisible();
});

test("creates profiles from environment and API key modes", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");

  await page.getByRole("button", { name: "Profiles" }).click();
  const profilesSection = page.locator(".section-card").filter({ hasText: "Provisioning" });

  await page.getByLabel("Tool").selectOption("codex");
  await page.getByLabel("Profile name").fill("ci");
  await page.getByLabel("Import mode").selectOption("from_env");
  await expect(page.getByText("OPENAI_API_KEY")).toBeVisible();
  await profilesSection.getByRole("button", { name: "Add profile" }).click();
  await expect(page.getByText("ci · api_key")).toBeVisible();

  await page.getByLabel("Tool").selectOption("claude");
  await page.getByLabel("Profile name").fill("ops");
  await page.getByLabel("Import mode").selectOption("api_key");
  await page.locator('input[type="password"]').fill("sk-ant-live-secret");
  await profilesSection.getByRole("button", { name: "Add profile" }).click();
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
  await expect(page.getByText("Codex backup · 20260325T114502Z-codex-work")).toBeVisible();
  await expect(page.getByText("Affects codex / work. Restore files only unless you explicitly re-activate this profile.")).toBeVisible();

  await page.getByRole("button", { name: "Restore and activate" }).click();

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.locator(".tool-card").filter({ hasText: "Codex" }).getByRole("heading", { name: "Work" })).toBeVisible();
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
          inventory: {
            bundled_path: "/Applications/AISW.app/Contents/Resources/aisw",
            system_path: "/opt/homebrew/bin/aisw",
            configured_path: null,
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
        partialSetup: {
          settings: bootstrapSettings,
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
                credential_backend: "system_keyring",
                state_mode: "isolated",
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
            },
            contexts: [],
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        switching: {
          settings: {
            ...bootstrapSettings,
            profile_sets: [
              {
                name: "client-acme",
                label: "Client Acme",
                profiles: {
                  claude: "work",
                  codex: "work",
                  gemini: null,
                },
              },
            ],
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
          settings: bootstrapSettings,
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
        missingTool: {
          settings: bootstrapSettings,
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
                stored_profiles: 1,
                active_profile: "work",
                auth_method: "api_key",
                credential_backend: "system_keyring",
                state_mode: "isolated",
                active_profile_applied: true,
                credentials_present: true,
                permissions_ok: true,
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
        updaterError: {
          settings: bootstrapSettings,
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
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
              },
              codex: {
                active: "work",
                profiles: [{ name: "work", auth: "api_key", label: "Work" }],
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
          settings: deepClone(scenarioState.settings ?? bootstrapSettings),
          snapshot: deepClone(scenarioState.snapshot),
        },
        snapshot: deepClone(scenarioState.snapshot),
        initReport: deepClone(scenarioState.initReport),
        settings: deepClone(scenarioState.settings ?? bootstrapSettings),
      };

      const stateWorkspace = {
        current_path: "/code/acme",
        current_remote: "git@github.com:acme/desktop.git",
        current_context: activeScenario === "switching" ? "work" : "none",
        guard_mode: "warn",
        default_context: activeScenario === "switching" ? "work" : "none",
        items:
          activeScenario === "switching"
            ? [{ scope: "path", path: "/code/acme", context: "client-acme" }]
            : [],
      };

      const cloneBinding = (binding) => deepClone(binding);

      const findMatchedBinding = () => {
        const pathBindings = stateWorkspace.items
          .filter((binding) => binding.scope === "path")
          .sort((left, right) => right.path.length - left.path.length);
        const pathMatch = pathBindings.find((binding) =>
          stateWorkspace.current_path.startsWith(binding.path),
        );
        if (pathMatch) {
          return cloneBinding(pathMatch);
        }

        const remoteBindings = stateWorkspace.items.filter((binding) => binding.scope === "git_remote");
        const remoteMatch = remoteBindings.find((binding) =>
          stateWorkspace.current_remote.includes(binding.pattern),
        );
        if (remoteMatch) {
          return cloneBinding(remoteMatch);
        }

        if (stateWorkspace.default_context !== "none") {
          return {
            scope: "default",
            target: "default",
            context: stateWorkspace.default_context,
          };
        }

        return null;
      };

      const workspaceStatusResult = () => {
        const matchedBinding = findMatchedBinding();
        if (!matchedBinding) {
          return {
            status: "unbound",
            current_context: stateWorkspace.current_context,
            expected_context: "none",
          };
        }

        return {
          status:
            matchedBinding.context === stateWorkspace.current_context ? "match" : "mismatch",
          current_context: stateWorkspace.current_context,
          expected_context: matchedBinding.context,
          matched_binding: matchedBinding,
        };
      };

      const projectBindingsResult = () => ({
        user_bindings: {
          guard_mode: stateWorkspace.guard_mode,
          default_context: stateWorkspace.default_context,
          items: stateWorkspace.items.map((binding) => cloneBinding(binding)),
        },
      });

      const cloneSnapshot = () => ({
        ...deepClone(state.snapshot),
        workspace_status: workspaceStatusResult(),
        project_bindings: projectBindingsResult(),
      });
      const listeners = new Map();
      window.__AISW_OPENED_GUIDES__ = [];
      window.open = (url) => {
        window.__AISW_OPENED_GUIDES__.push(String(url));
        return null;
      };

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
          return { result: workspaceStatusResult() };
        }
        if (command === "get_project_bindings") {
          return { result: projectBindingsResult() };
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
        if (command === "check_for_updates") {
          if (activeScenario === "updaterError") {
            throw {
              message: "Desktop update failed: invalid endpoint",
              remediation:
                "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
            };
          }
          return {
            configured: true,
            channel: state.settings.update_channel,
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
            channel: state.settings.update_channel,
            current_version: "0.1.0",
            installed_version: "0.2.0",
            restart_requested: true,
            message: "Update installed. Restart has been requested.",
          };
        }
        if (command === "get_settings") {
          return deepClone(state.settings);
        }
        if (command === "get_shell_guidance") {
          return {
            detected_shell: "zsh",
            capabilities: [
              "Apply CLAUDE_CONFIG_DIR, CODEX_HOME, and GEMINI_API_KEY into the current shell session.",
            ],
            note:
              "Without the shell hook, aisw use still writes live credential files and updates ~/.aisw/config.json.",
            manual_apply_examples: ['eval "$(aisw use claude work --emit-env)"'],
            variants: [
              {
                shell: "zsh",
                title: "Zsh",
                config_path: "~/.zshrc",
                alternate_config_path: null,
                install_command: "echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc",
                reload_command: "source ~/.zshrc",
                verify_command: 'echo "$AISW_SHELL_HOOK"',
                verify_expected: "1",
              },
            ],
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
        if (command === "activate_profile_set") {
          const set = state.settings.profile_sets.find((entry) => entry.name === args.name);
          if (!set) {
            throw new Error(`Unknown profile set: ${args.name}`);
          }
          Object.entries(set.profiles).forEach(([tool, profile]) => {
            if (!profile) {
              return;
            }
            const profileEntry = state.snapshot.profiles[tool];
            const statusEntry = state.snapshot.statuses.find((entry) => entry.tool === tool);
            const matching = profileEntry?.profiles.find((entry) => entry.name === profile);
            if (profileEntry && statusEntry && matching) {
              profileEntry.active = profile;
              statusEntry.active_profile = profile;
              statusEntry.auth_method = matching.auth;
              statusEntry.active_profile_applied = true;
              statusEntry.state_mode = tool === "gemini" ? null : "isolated";
            }
          });
          stateWorkspace.current_context = args.name;
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "use_context") {
          const request = args.request;
          stateWorkspace.current_context = request.context;
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
        if (command === "workspace_bind") {
          const request = args.request;
          if (request.target.scope === "default") {
            stateWorkspace.default_context = request.context;
          } else if (request.target.scope === "path") {
            stateWorkspace.items = stateWorkspace.items.filter(
              (binding) => !(binding.scope === "path" && binding.path === request.target.path),
            );
            stateWorkspace.items.push({
              scope: "path",
              path: request.target.path,
              context: request.context,
            });
          } else {
            stateWorkspace.items = stateWorkspace.items.filter(
              (binding) =>
                !(binding.scope === "git_remote" && binding.pattern === request.target.pattern),
            );
            stateWorkspace.items.push({
              scope: "git_remote",
              pattern: request.target.pattern,
              context: request.context,
            });
          }
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "workspace_unbind") {
          const target = args.target;
          if (target.scope === "default") {
            stateWorkspace.default_context = "none";
          } else if (target.scope === "path") {
            stateWorkspace.items = stateWorkspace.items.filter(
              (binding) => !(binding.scope === "path" && binding.path === target.path),
            );
          } else {
            stateWorkspace.items = stateWorkspace.items.filter(
              (binding) =>
                !(binding.scope === "git_remote" && binding.pattern === target.pattern),
            );
          }
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "workspace_guard") {
          stateWorkspace.guard_mode = args.mode;
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
