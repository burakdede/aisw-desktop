import { expect, type Page } from "@playwright/test";

const CURRENT_APP_VERSION = process.env.npm_package_version ?? "0.1.5";

type ScenarioName =
  | "onboarding"
  | "onboardingMissingTool"
  | "noLiveAccounts"
  | "labelOverrides"
  | "incompatibleRuntime"
  | "diagnosticsRepair"
  | "switching"
  | "workspaceContext"
  | "profiles"
  | "backupCatalog"
  | "staleProfile"
  | "nonInteractiveProfile"
  | "profileCommandError"
  | "tokenWarnings"
  | "failedBulkSwitch"
  | "trayRefresh"
  | "trayWorkspaceRefresh"
  | "trayBackupRefresh"
  | "trayDiagnosticsRefresh"
  | "matchingContextSet"
  | "diagnosticFixes"
  | "missingTool"
  | "partialSetup"
  | "updaterError"
  | "updaterInstallError"
  | "customRuntime"
  | "sharedWorkspaceContext"
  | "profileLatestBackup"
  | "emptyProfileSet"
  | "emptyProfileSetWorkspaceMismatch"
  | "staleProfileSet"
  | "staleWorkspaceTarget"
  | "bootstrapError";

const toolCapabilities = {
  claude: { state_modes: ["isolated", "shared"] },
  codex: { state_modes: ["isolated", "shared"] },
  gemini: { state_modes: [] },
};

export async function installDesktopMock(
  page: Page,
  scenario: ScenarioName,
  capabilitiesOverride = toolCapabilities,
  scenarioOverride?: Record<string, unknown>,
) {
  await page.addInitScript(
    ({ activeScenario, capabilities, scenarioPatch }) => {
      window.localStorage.clear();
      if (document.documentElement) {
        document.documentElement.removeAttribute("data-appearance");
        document.documentElement.style.colorScheme = "";
      }

      const deepClone = (value) => JSON.parse(JSON.stringify(value));
      const deepMerge = (base, patch) => {
        if (patch === undefined) {
          return deepClone(base);
        }
        if (base === undefined || base === null || patch === null) {
          return deepClone(patch);
        }
        if (Array.isArray(base) || Array.isArray(patch)) {
          return deepClone(patch);
        }
        if (typeof base !== "object" || typeof patch !== "object") {
          return deepClone(patch);
        }
        const merged = { ...deepClone(base) };
        for (const [key, value] of Object.entries(patch)) {
          merged[key] = key in merged ? deepMerge(merged[key], value) : deepClone(value);
        }
        return merged;
      };

      const bootstrapSettings = {
        runtime_kind: "bundled",
        runtime_path: null,
        aisw_home: null,
        update_channel: "stable",
        profile_sets: [],
      };
      if (activeScenario === "customRuntime") {
        bootstrapSettings.runtime_kind = "custom";
        bootstrapSettings.runtime_path = "/opt/aisw/bin/aisw";
      }

      const baseBootstrap = {
        settings: bootstrapSettings,
        runtime_status: {
          resolved_path:
            activeScenario === "customRuntime"
              ? "/opt/aisw/bin/aisw"
              : "/Applications/AI Switch.app/Contents/Resources/aisw",
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
            bundled_path: "/Applications/AI Switch.app/Contents/Resources/aisw",
            system_path: "/opt/homebrew/bin/aisw",
            configured_path:
              activeScenario === "customRuntime" ? "/opt/aisw/bin/aisw" : null,
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
        onboardingMissingTool: {
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
        incompatibleRuntime: {
          snapshot: null,
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        bootstrapError: {
          snapshot: null,
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        diagnosticsRepair: {
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
                permissions_ok: false,
              },
            ],
            profiles: {
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
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
        labelOverrides: {
          settings: {
            ...bootstrapSettings,
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
              live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
            },
          },
        },
        noLiveAccounts: {
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
        failedBulkSwitch: {
          settings: bootstrapSettings,
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
            contexts: [],
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        trayRefresh: {
          settings: bootstrapSettings,
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
                profiles: [
                  { name: "work", auth: "oauth", label: "Work" },
                  { name: "personal", auth: "oauth", label: "Personal" },
                ],
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
        trayWorkspaceRefresh: {
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
        trayBackupRefresh: {
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
            ],
            profiles: {
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
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
        trayDiagnosticsRefresh: {
          settings: bootstrapSettings,
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
                profiles: [
                  { name: "work", auth: "oauth", label: "Work" },
                  { name: "personal", auth: "oauth", label: "Personal" },
                ],
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
        matchingContextSet: {
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
                active_profile: "personal",
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
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        diagnosticFixes: {
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
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        workspaceContext: {
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
            contexts: [
              {
                name: "client-acme",
                profiles: {
                  claude: "work",
                  codex: "work",
                },
              },
            ],
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        sharedWorkspaceContext: {
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
                state_mode: "shared",
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
                state_mode: "shared",
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
                  codex: "work",
                },
              },
            ],
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        profileLatestBackup: {
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
            ],
            profiles: {
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
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
        emptyProfileSet: {
          settings: {
            ...bootstrapSettings,
            profile_sets: [
              {
                name: "empty-set",
                label: "Empty Set",
                profiles: {
                  claude: null,
                  codex: null,
                  gemini: null,
                },
              },
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
                credential_backend: "file",
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
        emptyProfileSetWorkspaceMismatch: {
          settings: {
            ...bootstrapSettings,
            profile_sets: [
              {
                name: "client-acme",
                label: "Client Acme",
                profiles: {
                  claude: null,
                  codex: null,
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
                stored_profiles: 1,
                active_profile: "work",
                auth_method: "oauth",
                credential_backend: "system_keyring",
                state_mode: "shared",
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
                credential_backend: "file",
                state_mode: "shared",
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
                  codex: "work",
                },
              },
            ],
          },
          initReport: {
            result: {
              live_accounts: [],
            },
          },
        },
        staleProfileSet: {
          settings: {
            ...bootstrapSettings,
            profile_sets: [
              {
                name: "client-acme",
                label: "Client Acme",
                profiles: {
                  claude: "work",
                  codex: "missing",
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
                credential_backend: "file",
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
        staleWorkspaceTarget: {
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
                state_mode: "shared",
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
                credential_backend: "file",
                state_mode: "shared",
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
        backupCatalog: {
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
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
              },
              codex: {
                active: "personal",
                profiles: [{ name: "personal", auth: "api_key", label: "Personal" }],
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
        staleProfile: {
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
            ],
            profiles: {
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
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
        nonInteractiveProfile: {
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
            ],
            profiles: {
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
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
        profileCommandError: {
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
            ],
            profiles: {
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
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
        tokenWarnings: {
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
                credentials_present: false,
                permissions_ok: false,
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
                  {
                    message: "Keyring access failed.",
                    remediation: "Unlock the local credential store and retry.",
                  },
                ],
              },
            ],
            profiles: {
              claude: {
                active: "work",
                profiles: [{ name: "work", auth: "oauth", label: "Work" }],
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
        customRuntime: {
          settings: {
            ...bootstrapSettings,
            runtime_kind: "custom",
            runtime_path: "/opt/aisw/bin/aisw",
          },
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
        updaterInstallError: {
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

      const scenarioState = deepMerge(scenarios[activeScenario], scenarioPatch ?? {});
      const state = {
        bootstrap: {
          ...deepClone(baseBootstrap),
          settings: deepClone(scenarioState.settings ?? bootstrapSettings),
          snapshot: deepClone(scenarioState.snapshot),
        },
        snapshot: deepClone(scenarioState.snapshot),
        initReport: deepClone(scenarioState.initReport),
        settings: deepClone(scenarioState.settings ?? bootstrapSettings),
        initRuns: 0,
        snapshotReads: 0,
        doctorRuns: 0,
        workspaceStatusReads: 0,
        projectBindingsReads: 0,
        backupReads: 0,
        trayContextApplied: false,
        trayBackupApplied: false,
      };
      window.__AISW_DESKTOP_SCENARIO_STATE__ = state;

      const stateWorkspace = {
        current_path: "/code/acme",
        current_remote: "git@github.com:acme/desktop.git",
        current_context:
          activeScenario === "switching" ||
          activeScenario === "workspaceContext" ||
          activeScenario === "trayWorkspaceRefresh" ||
          activeScenario === "diagnosticFixes" ||
          activeScenario === "emptyProfileSetWorkspaceMismatch" ||
          activeScenario === "staleWorkspaceTarget"
            ? "work"
            : "none",
        guard_mode: "warn",
        default_context:
          activeScenario === "switching" ||
          activeScenario === "trayWorkspaceRefresh" ||
          activeScenario === "diagnosticFixes" ||
          activeScenario === "emptyProfileSetWorkspaceMismatch" ||
          activeScenario === "staleWorkspaceTarget"
            ? "work"
            : "none",
        items:
          activeScenario === "switching" ||
          activeScenario === "workspaceContext" ||
          activeScenario === "trayWorkspaceRefresh" ||
          activeScenario === "diagnosticFixes" ||
          activeScenario === "emptyProfileSetWorkspaceMismatch" ||
          activeScenario === "staleWorkspaceTarget"
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
        state.workspaceStatusReads += 1;
        if (activeScenario === "trayWorkspaceRefresh" && state.trayContextApplied) {
          stateWorkspace.current_context = "client-acme";
        }
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

      const projectBindingsResult = () => {
        state.projectBindingsReads += 1;
        if (activeScenario === "trayWorkspaceRefresh" && state.trayContextApplied) {
          stateWorkspace.guard_mode = "strict";
          stateWorkspace.default_context = "client-acme";
        }
        return {
          user_bindings: {
            guard_mode: stateWorkspace.guard_mode,
            default_context: stateWorkspace.default_context,
            items: stateWorkspace.items.map((binding) => cloneBinding(binding)),
          },
        };
      };

      const cloneSnapshot = () => ({
        ...deepClone(state.snapshot),
        workspace_status: workspaceStatusResult(),
        project_bindings: projectBindingsResult(),
      });
      const listeners = new Map();
      window.__AISW_DESKTOP_EVENT_HANDLERS__ = {};
      window.__AISW_COMMAND_LOG__ = [];
      window.__AISW_OPENED_GUIDES__ = [];
      window.__AISW_NOTIFICATIONS__ = [];
      window.__AISW_CLIPBOARD_WRITES__ = [];
      window.__AISW_DESKTOP_NOTIFY__ = (payload) => {
        window.__AISW_NOTIFICATIONS__.push(payload);
      };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__AISW_CLIPBOARD_WRITES__.push(String(value));
          },
        },
      });
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
        window.__AISW_DESKTOP_EVENT_HANDLERS__[event] = handler;
        return () => {
          listeners.delete(event);
          delete window.__AISW_DESKTOP_EVENT_HANDLERS__[event];
        };
      };

      window.__AISW_DESKTOP_MOCK__ = async (command, args) => {
        window.__AISW_COMMAND_LOG__.push({ command, args: deepClone(args ?? null) });
        if (command === "get_bootstrap") {
          if (activeScenario === "bootstrapError") {
            throw {
              kind: "aisw_not_found",
              message: "AI Switch could not resolve a compatible switching runtime",
              remediation: "Select a valid bundled, system, or custom switching runtime.",
            };
          }
          if (activeScenario === "incompatibleRuntime") {
            return {
              ...deepClone(state.bootstrap),
              runtime_status: {
                ...deepClone(state.bootstrap.runtime_status),
                version: null,
                capabilities: null,
                compatible: false,
                issues: [
                  "Runtime version details are unavailable",
                  "Runtime capability details are unavailable",
                ],
              },
              snapshot: null,
            };
          }
          return {
            ...deepClone(state.bootstrap),
            snapshot: cloneSnapshot(),
          };
        }
        if (command === "get_snapshot") {
          if (activeScenario === "failedBulkSwitch") {
            state.snapshotReads += 1;
            if (state.snapshotReads > 1) {
              state.snapshot.statuses = state.snapshot.statuses.map((entry) => ({
                ...entry,
                active_profile: "personal",
              }));
              Object.entries(state.snapshot.profiles).forEach(([tool, profileEntry]) => {
                if (profileEntry) {
                  state.snapshot.profiles[tool] = {
                    ...profileEntry,
                    active: "personal",
                  };
                }
              });
            }
          }
          if (activeScenario === "trayRefresh") {
            state.snapshotReads += 1;
            if (state.snapshotReads > 1) {
              state.snapshot.statuses = state.snapshot.statuses.map((entry) =>
                entry.tool === "claude"
                  ? { ...entry, active_profile: "personal", active_profile_applied: true }
                  : entry,
              );
              if (state.snapshot.profiles.claude) {
                state.snapshot.profiles.claude = {
                  ...state.snapshot.profiles.claude,
                  active: "personal",
                };
              }
            }
          }
          return cloneSnapshot();
        }
        if (command === "run_doctor") {
          if (activeScenario === "trayDiagnosticsRefresh") {
            state.doctorRuns += 1;
            if (state.doctorRuns > 1) {
              return {
                checks: [
                  {
                    name: "shell_hook",
                    status: "warn",
                    detail: "Shell hook is not active in the current shell session.",
                    remediation: ["Install the shell hook and reload the shell."],
                  },
                ],
                summary: { status: "warn" },
              };
            }
          }
          if (activeScenario === "diagnosticFixes") {
            return {
              checks: [{ name: "tool/codex", status: "warn", detail: "codex not found on PATH" }],
            };
          }
          if (activeScenario === "diagnosticsRepair") {
            return {
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
                {
                  name: "shell_hook",
                  status: "warn",
                  detail: "Shell hook is not active in the current shell session.",
                  remediation: ["Install the shell hook and reload the shell."],
                },
              ],
            };
          }
          return { summary: { status: "pass" }, checks: [] };
        }
        if (command === "run_verify") {
          if (activeScenario === "diagnosticFixes") {
            return {
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
            };
          }
          if (activeScenario === "diagnosticsRepair") {
            return { summary: { status: "warn", passed: 0, warnings: 0, failed: 0 }, tools: [] };
          }
          return { summary: { status: "pass" } };
        }
        if (command === "run_repair") {
          if (activeScenario === "diagnosticsRepair") {
            const request = args?.request ?? {};
            const fixes = Array.isArray(request.fixes) ? request.fixes : [];
            if (request.apply) {
              if (fixes.length > 0) {
                return {
                  result: {
                    summary: {
                      status: "pass",
                      actions_planned: fixes.length,
                      actions_applied: fixes.length,
                      issues_remaining: 0,
                    },
                    actions: fixes.map((fix) => ({
                      kind: "repair",
                      fix,
                      path: "~/.aisw",
                      detail:
                        fix === "keyring"
                          ? "unlock the system keyring integration"
                          : fix === "permissions"
                            ? "repair config path permissions"
                            : "retry the OAuth recovery flow",
                      status: "applied",
                    })),
                  },
                };
              }

              return {
                result: {
                  summary: {
                    status: "pass",
                    actions_planned: 1,
                    actions_applied: 1,
                    issues_remaining: 0,
                  },
                  actions: [
                    {
                      kind: "create_dir",
                      fix: "home",
                      path: "/tmp/aisw",
                      detail: "create AISW_HOME directory",
                      status: "applied",
                    },
                  ],
                },
              };
            }

            return {
              result: {
                summary: {
                  status: "warn",
                  actions_planned: 1,
                  actions_applied: 0,
                  issues_remaining: 3,
                },
                actions: [
                  {
                    kind: "create_dir",
                    fix: "home",
                    path: "/tmp/aisw",
                    detail: "create AISW_HOME directory",
                    status: "planned",
                  },
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
          return { result: { mode: "dry_run" } };
        }
        if (command === "run_init") {
          state.initRuns += 1;
          if (activeScenario === "noLiveAccounts" && state.initRuns >= 1) {
            return {
              result: {
                live_accounts: [{ tool: "codex", outcome: "detected", auth_method: "oauth" }],
              },
            };
          }
          return deepClone(state.initReport);
        }
        if (command === "get_workspace_status") {
          return { result: workspaceStatusResult() };
        }
        if (command === "get_project_bindings") {
          return { result: projectBindingsResult() };
        }
        if (command === "list_backups") {
          state.backupReads += 1;
          if (activeScenario === "trayBackupRefresh") {
            return state.trayBackupApplied
              ? [
                  {
                    backup_id: "20260326T120000Z-claude-work",
                    tool: "claude",
                    profile: "claude/work",
                  },
                ]
              : [];
          }
          if (activeScenario === "backupCatalog") {
            return [
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
            ];
          }
          if (activeScenario === "profileLatestBackup") {
            return [
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
            ];
          }
          if (activeScenario === "switching") {
            return [
              {
                backup_id: "20260325T114502Z-codex-work",
                tool: "codex",
                profile: "codex/work",
              },
            ];
          }
          if (activeScenario === "labelOverrides") {
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
            current_version: CURRENT_APP_VERSION,
            endpoint: `https://updates.example.com/${state.settings.update_channel}.json`,
            update: {
              version:
                state.settings.update_channel === "beta" ? "0.3.0-beta.1" : "0.2.0",
              current_version: CURRENT_APP_VERSION,
              target: "darwin-aarch64",
              notes:
                state.settings.update_channel === "beta"
                  ? "Preview release candidate."
                  : "Faster switching and signed updater artifacts.",
            },
            message: null,
          };
        }
        if (command === "install_update") {
          if (activeScenario === "updaterInstallError") {
            throw {
              message: "Desktop update failed: signature mismatch",
              remediation:
                "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
            };
          }
          return {
            configured: true,
            channel: state.settings.update_channel,
            current_version: CURRENT_APP_VERSION,
            installed_version: "0.2.0",
            restart_requested: true,
            message: "Update installed. Restart has been requested.",
          };
        }
        if (command === "update_settings") {
          state.settings = deepClone(args.request);
          state.bootstrap.settings = deepClone(args.request);
          if (state.settings.runtime_kind === "custom") {
            state.bootstrap.runtime_status.resolved_path = state.settings.runtime_path;
            state.bootstrap.runtime_status.inventory.configured_path = state.settings.runtime_path;
          } else if (state.settings.runtime_kind === "system") {
            state.bootstrap.runtime_status.resolved_path =
              state.bootstrap.runtime_status.inventory.system_path;
            state.bootstrap.runtime_status.inventory.configured_path = null;
          } else {
            state.bootstrap.runtime_status.resolved_path =
              state.bootstrap.runtime_status.inventory.bundled_path;
            state.bootstrap.runtime_status.inventory.configured_path = null;
          }
          return deepClone(state.settings);
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
              "Without the shell hook, AI Switch still updates live credential files and ~/.aisw/config.json.",
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
          if (activeScenario === "nonInteractiveProfile") {
            throw {
              kind: "NonInteractiveMode",
              message: "interactive login required",
              remediation:
                "Rerun this flow in an interactive session or use a supported non-interactive import method.",
            };
          }
          const request = args.request;
          if (activeScenario === "profileCommandError") {
            throw {
              kind: "KeyringUnavailable",
              message: "keyring unavailable",
              remediation: "Unlock the local credential store and retry.",
            };
          }
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
        if (command === "rename_profile") {
          const request = args;
          const profileEntry = state.snapshot.profiles[request.tool];
          const statusEntry = state.snapshot.statuses.find((entry) => entry.tool === request.tool);
          const match = profileEntry?.profiles.find((profile) => profile.name === request.old_name);
          if (match) {
            match.name = request.new_name;
          }
          if (profileEntry?.active === request.old_name) {
            profileEntry.active = request.new_name;
          }
          if (statusEntry?.active_profile === request.old_name) {
            statusEntry.active_profile = request.new_name;
          }
          const toolLabels = state.settings.profile_labels?.[request.tool];
          if (toolLabels && Object.prototype.hasOwnProperty.call(toolLabels, request.old_name)) {
            toolLabels[request.new_name] = toolLabels[request.old_name];
            delete toolLabels[request.old_name];
          }
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "remove_profile") {
          const request = args;
          const profileEntry = state.snapshot.profiles[request.tool];
          const statusEntry = state.snapshot.statuses.find((entry) => entry.tool === request.tool);
          if (profileEntry) {
            profileEntry.profiles = profileEntry.profiles.filter(
              (profile) => profile.name !== request.profile,
            );
            if (profileEntry.active === request.profile) {
              profileEntry.active = null;
            }
          }
          if (statusEntry?.active_profile === request.profile) {
            statusEntry.active_profile = null;
            statusEntry.active_profile_applied = null;
            statusEntry.credentials_present = false;
          }
          const toolLabels = state.settings.profile_labels?.[request.tool];
          if (toolLabels) {
            delete toolLabels[request.profile];
          }
          syncStoredProfiles(request.tool);
          return { command, snapshot: cloneSnapshot() };
        }
        if (command === "use_all_profiles") {
          if (activeScenario === "failedBulkSwitch") {
            throw new Error("switch failed");
          }
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
          if (
            activeScenario === "staleProfile" &&
            request.tool === "claude" &&
            request.profile === "work"
          ) {
            throw {
              kind: "ProfileMissing",
              message: "profile work no longer exists",
              remediation: "Refresh profile state or recreate the missing profile before retrying.",
            };
          }
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
        if (command === "export_diagnostic_bundle") {
          return {
            path: "/tmp/aisw-desktop/aisw-desktop-diagnostics-789.json",
            filename: "aisw-desktop-diagnostics-789.json",
            generated_at: "unix:789",
          };
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
    { activeScenario: scenario, capabilities: capabilitiesOverride, scenarioPatch: scenarioOverride ?? null },
  );
}

export async function importDetectedAccount(page: Page, tool: string, profile: string) {
  await page.getByRole("button", { name: `Inspect ${titleCase(tool)}` }).click();
  await page.getByRole("button", { name: "Import as profile" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Profile name").fill(profile);
  await dialog.getByLabel("Label").fill(titleCase(profile));
  await dialog.getByRole("button", { name: "Import" }).dispatchEvent("click");
  await expect(dialog).toHaveCount(0);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
