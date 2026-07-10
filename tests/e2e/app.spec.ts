import { expect, test, type Page } from "@playwright/test";

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
  | "bootstrapError";

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
  await page.getByRole("button", { name: "Start setup" }).click();
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

test("uses saved profile labels across onboarding and overview", async ({ page }) => {
  await installDesktopMock(page, "labelOverrides");

  await page.goto("/");

  await expect(page.getByText("Active set: Client Acme")).toBeVisible();
  await expect(page.getByLabel("First switch profile").getByRole("option", { name: "Office" })).toHaveCount(1);
  const overview = page.locator(".section-card").filter({ hasText: "Control Center" });
  await expect(overview.getByRole("option", { name: "Shared profile: Office" })).toHaveCount(1);
});

test("opens shell setup from onboarding", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");

  await expect(page.getByText("Detected shell:")).toBeVisible();
  await page.getByRole("button", { name: "Open shell setup" }).click();

  await expect(page.getByRole("heading", { name: "Shell hook" })).toBeVisible();
  await expect(page.getByText("Config file: ~/.zshrc")).toBeVisible();
  await expect(page.getByRole("button", { name: "Shell hook", pressed: true })).toBeVisible();
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

test("shows missing-tool install guidance during onboarding", async ({ page }) => {
  await installDesktopMock(page, "onboardingMissingTool");

  await page.goto("/");

  const setup = page.locator(".section-card").filter({ hasText: "First-run setup" });
  await expect(setup.getByRole("heading", { name: "First-run setup" })).toBeVisible();
  await expect(setup.getByText("Gemini is not installed")).toBeVisible();
  await expect(setup.getByText("npm install -g @google/gemini-cli")).toBeVisible();
  await expect(setup.getByText("gemini --version")).toBeVisible();
  await expect(setup.getByText(/(which|where) gemini/)).toBeVisible();

  await setup.getByRole("button", { name: "Open installation guide" }).click();

  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { __AISW_OPENED_GUIDES__?: string[] }).__AISW_OPENED_GUIDES__ ?? []),
    )
    .toContain("https://www.npmjs.com/package/@google/gemini-cli");
});

test("shows runtime compatibility blockers when the configured aisw runtime is unusable", async ({
  page,
}) => {
  await installDesktopMock(page, "incompatibleRuntime");

  await page.goto("/");

  await expect(page.getByText("Runtime blocked")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runtime compatibility" })).toBeVisible();
  await expect(page.getByText("aisw does not advertise mutation_json support")).toBeVisible();
  await expect(
    page.getByText(/Fix the selected .* runtime in Settings before profile switching/),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Runtime detection")).toBeVisible();
  await expect(page.getByRole("button", { name: "Overview" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Profiles" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Contexts" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Workspaces" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Diagnostics" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Backups" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeEnabled();
  await expect(page.getByText("First-run setup")).not.toBeVisible();
});

test("shows bootstrap failure remediation when the desktop shell cannot load initial state", async ({
  page,
}) => {
  await installDesktopMock(page, "bootstrapError");

  await page.goto("/");

  await expect(page.getByText("Desktop bootstrap failed.")).toBeVisible();
  await expect(page.getByText("aisw binary could not be resolved")).toBeVisible();
  await expect(
    page.getByText("Stage the bundled aisw binary or switch to a working system runtime."),
  ).toBeVisible();
});

test("reruns setup detection when no live accounts are initially found", async ({ page }) => {
  await installDesktopMock(page, "noLiveAccounts");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "First-run setup" })).toBeVisible();
  await expect(page.getByText("No live credentials detected").first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __AISW_DESKTOP_SCENARIO_STATE__?: { initRuns?: number };
            }
          ).__AISW_DESKTOP_SCENARIO_STATE__?.initRuns ?? 0,
      ),
    )
    .toBe(0);

  await page.getByRole("button", { name: "Start setup" }).click();

  await expect(page.getByText("detected · oauth")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __AISW_DESKTOP_SCENARIO_STATE__?: { initRuns?: number };
            }
          ).__AISW_DESKTOP_SCENARIO_STATE__?.initRuns ?? 0,
      ),
    )
    .toBe(1);
});

test("runs the onboarding first switch flow", async ({ page }) => {
  await installDesktopMock(page, "labelOverrides");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "First-run setup" })).toBeVisible();
  await page.getByLabel("First switch profile").selectOption("work");
  await page.getByRole("button", { name: "Switch now" }).click();

  await expect(page.getByText("Last bulk result: Switched all tools to Office.")).toBeVisible();
  await expect(page.getByText("Shell guidance")).toBeVisible();
  await expect(page.getByText("AISW runtime contract")).toBeVisible();
});

test("keeps Gemini state mode non-configurable when runtime capabilities are stale", async ({
  page,
}) => {
  await installDesktopMock(page, "profiles", {
    ...toolCapabilities,
    gemini: { state_modes: ["isolated", "shared"] },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  const profilesSection = page.locator(".section-card").filter({ hasText: "Profiles" });
  await profilesSection.locator("form select").first().selectOption("gemini");

  await expect(profilesSection.getByLabel("State mode")).toBeDisabled();
  await expect(profilesSection.getByLabel("State mode")).toHaveValue("n/a");

  await profilesSection.getByLabel("Profile name").fill("travel");
  await profilesSection.getByRole("button", { name: "Add profile" }).click();

  await page.getByRole("button", { name: "Overview" }).click();

  const geminiCard = page.locator(".tool-card").filter({ hasText: "Gemini" });
  await expect(geminiCard.getByText("State mode: n/a")).toBeVisible();
  await expect(geminiCard.locator("select")).toHaveCount(1);

  await geminiCard.getByRole("button", { name: "Re-apply Travel" }).click();
  await expect(geminiCard.getByText("Last result: Switched Gemini to Travel.")).toBeVisible();
  await expect(geminiCard.getByText("State mode: n/a")).toBeVisible();
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

  await expect(page.getByText("Last bulk result: Switched all tools to Work.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Work" }).nth(1)).toBeVisible();

  await page.getByRole("button", { name: "Profiles" }).click();
  await expect(page.getByText("incident · oauth")).toBeVisible();
});

test("opens the profiles screen from overview details actions", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  const codexCard = page.locator(".tool-card").filter({ hasText: "Codex" });
  await codexCard.getByRole("button", { name: "Open details" }).click();

  await expect(page.getByText("Provisioning")).toBeVisible();
  await expect(page.getByLabel("Tool")).toHaveValue("codex");
  await expect(page.getByRole("heading", { name: "Diagnostic details" })).toBeVisible();
  await expect(
    page.getByText("No additional token or runtime warnings are currently reported for this tool."),
  ).toBeVisible();
});

test("clears route-opened profile details when switching tools manually", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  const codexCard = page.locator(".tool-card").filter({ hasText: "Codex" });
  await codexCard.getByRole("button", { name: "Open details" }).click();

  await expect(page.getByLabel("Tool")).toHaveValue("codex");
  await expect(page.getByRole("heading", { name: "Diagnostic details" })).toBeVisible();

  await page.getByLabel("Tool").selectOption("claude");

  await expect(page.getByLabel("Tool")).toHaveValue("claude");
  await expect(page.getByRole("heading", { name: "Diagnostic details" })).toHaveCount(0);
});

test("clears routed profile details when reopening profiles from the sidebar", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  const codexCard = page.locator(".tool-card").filter({ hasText: "Codex" });
  await codexCard.getByRole("button", { name: "Open details" }).click();

  await expect(page.getByLabel("Tool")).toHaveValue("codex");
  await expect(page.getByRole("heading", { name: "Diagnostic details" })).toBeVisible();

  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Profiles" }).click();

  await expect(page.getByLabel("Tool")).toHaveValue("claude");
  await expect(page.getByRole("heading", { name: "Diagnostic details" })).toHaveCount(0);
});

test("clears routed settings sections when reopening settings from the sidebar", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");
  await page.getByRole("button", { name: "Open shell setup" }).click();

  await expect(page.getByRole("button", { name: "Shell hook", pressed: true })).toBeVisible();

  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Settings" }).click();

  await expect(page.getByRole("button", { name: "Runtime", pressed: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Shell hook", pressed: false })).toBeVisible();
});

test("refreshes state after a failed switch-all to show the rolled-back profiles", async ({ page }) => {
  await installDesktopMock(page, "failedBulkSwitch");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Work" }).first()).toBeVisible();
  await page.locator(".section-card").filter({ hasText: "Control Center" }).getByRole("combobox").first().selectOption("profile:work");
  await page.getByRole("button", { name: "Switch all" }).click();

  await expect(page.getByRole("heading", { name: "Personal" }).first()).toBeVisible();
  await expect(page.getByText("Last bulk result: switch failed")).toBeVisible();
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

test("offers direct diagnostic fixes for missing tools, live mismatch, and workspace mismatch", async ({
  page,
}) => {
  await installDesktopMock(page, "diagnosticFixes");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  await expect(page.getByText("Direct fixes")).toBeVisible();
  await expect(page.getByText("codex is missing")).toBeVisible();
  await expect(page.getByText("claude live mismatch")).toBeVisible();
  await expect(page.getByText("Workspace context mismatch")).toBeVisible();

  const missingToolCard = page.locator(".diagnostic-card").filter({ hasText: "codex is missing" });
  await missingToolCard.getByRole("button", { name: "Open installation guide" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { __AISW_OPENED_GUIDES__?: string[] }).__AISW_OPENED_GUIDES__ ?? []),
    )
    .toContain("https://www.npmjs.com/package/@openai/codex");

  await page.getByRole("button", { name: "Re-apply Work" }).click();
  await page.getByRole("button", { name: "Use expected context now" }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __AISW_COMMAND_LOG__?: Array<{ command: string }>;
          }).__AISW_COMMAND_LOG__ ?? [],
      ),
    )
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "use_profile" }),
        expect.objectContaining({ command: "activate_profile_set" }),
      ]),
    );

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __AISW_NOTIFICATIONS__?: Array<{ title: string; body: string }>;
          }).__AISW_NOTIFICATIONS__ ?? [],
      ),
    )
    .toContainEqual({
      title: "Workspace switch",
      body: "Switched to Client Acme for /code/acme.",
    });
});

test("opens diagnostics when the tray requests it", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByText("Control Center")).toBeVisible();

  await page.evaluate(() => {
    const handlers = (
      window as typeof window & {
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
      }
    ).__AISW_DESKTOP_EVENT_HANDLERS__;
    handlers?.["tray-open-diagnostics"]?.({});
  });

  await expect(page.getByText("Doctor · Verify · Repair")).toBeVisible();
});

test("reruns diagnostics when the tray requests a diagnostics run", async ({ page }) => {
  await installDesktopMock(page, "trayDiagnosticsRefresh");

  await page.goto("/");
  await expect(page.getByText("Control Center")).toBeVisible();

  await page.evaluate(() => {
    const handlers = (
      window as typeof window & {
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
      }
    ).__AISW_DESKTOP_EVENT_HANDLERS__;
    handlers?.["tray-run-diagnostics"]?.({});
  });

  const diagnosticsSection = page.locator(".section-card").filter({ hasText: "Doctor · Verify · Repair" });
  await expect(diagnosticsSection).toBeVisible();
  await expect(
    diagnosticsSection.getByText("Shell hook is not active in the current shell session.").first(),
  ).toBeVisible();
});

test("records tray command results and shows a desktop notification", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByText("Control Center")).toBeVisible();

  await page.evaluate(() => {
    const handlers = (
      window as typeof window & {
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
      }
    ).__AISW_DESKTOP_EVENT_HANDLERS__;
    handlers?.["tray-command-result"]?.({
      scope: "tool",
      tool: "claude",
      label: "Switch profile",
      status: "success",
      message: "Switched claude to work.",
    });
  });

  const claudeCard = page.locator(".tool-card").filter({ hasText: "Claude" });
  await expect(claudeCard.getByText("Last result: Switched claude to work.")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __AISW_NOTIFICATIONS__?: Array<{ title: string; body: string }>;
          }).__AISW_NOTIFICATIONS__ ?? [],
      ),
    )
    .toContainEqual({
      title: "Switch profile",
      body: "Switched claude to work.",
    });
});

test("refreshes overview state after a successful tray profile switch", async ({ page }) => {
  await installDesktopMock(page, "trayRefresh");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Work" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal" })).toHaveCount(0);

  await page.evaluate(() => {
    const handlers = (
      window as typeof window & {
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
      }
    ).__AISW_DESKTOP_EVENT_HANDLERS__;
    handlers?.["tray-command-result"]?.({
      scope: "tool",
      tool: "claude",
      label: "Switch profile",
      status: "success",
      message: "Switched claude to personal.",
    });
  });

  const claudeCard = page.locator(".tool-card").filter({ hasText: "Claude" });
  await expect(claudeCard.getByRole("heading", { name: "Personal" })).toBeVisible();
  await expect(claudeCard.getByText("Last result: Switched claude to personal.")).toBeVisible();
});

test("refreshes workspace status and bindings after a successful tray context switch", async ({
  page,
}) => {
  await installDesktopMock(page, "trayWorkspaceRefresh");

  await page.goto("/");
  await page.getByRole("button", { name: "Workspaces" }).click();

  await expect(page.getByText("Workspace mismatch")).toBeVisible();
  await expect(page.getByText("Guard mode: warn")).toBeVisible();

  await page.evaluate(() => {
    (
      window as typeof window & {
        __AISW_DESKTOP_SCENARIO_STATE__?: { trayContextApplied?: boolean };
      }
    ).__AISW_DESKTOP_SCENARIO_STATE__!.trayContextApplied = true;
    const handlers = (
      window as typeof window & {
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
      }
    ).__AISW_DESKTOP_EVENT_HANDLERS__;
    handlers?.["tray-command-result"]?.({
      scope: "global",
      id: "context",
      label: "Switch context",
      status: "success",
      message: "Activated context client-acme.",
    });
  });

  await expect(page.getByText("Current context: client-acme")).toBeVisible();
  await expect(page.getByText("Expected context: client-acme")).toBeVisible();
  await expect(page.getByText("Guard mode: strict")).toBeVisible();
  await expect(page.getByText("Workspace mismatch")).not.toBeVisible();
});

test("refreshes the backup catalog after a successful tray profile switch", async ({ page }) => {
  await installDesktopMock(page, "trayBackupRefresh");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  await expect(page.getByText("No backups found.")).toBeVisible();

  await page.evaluate(() => {
    (
      window as typeof window & {
        __AISW_DESKTOP_SCENARIO_STATE__?: { trayBackupApplied?: boolean };
      }
    ).__AISW_DESKTOP_SCENARIO_STATE__!.trayBackupApplied = true;
    const handlers = (
      window as typeof window & {
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
      }
    ).__AISW_DESKTOP_EVENT_HANDLERS__;
    handlers?.["tray-command-result"]?.({
      scope: "tool",
      tool: "claude",
      label: "Switch profile",
      status: "success",
      message: "Switched claude to work.",
    });
  });

  await expect(page.getByText("Claude backup · 20260326T120000Z-claude-work")).toBeVisible();
  await expect(
    page.getByText(
      "Affects Claude / Work. Restore files only unless you explicitly re-activate this profile.",
    ),
  ).toBeVisible();
});

test("records tray context failures and keeps the remediation visible in overview", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByText("Control Center")).toBeVisible();

  await page.evaluate(() => {
    const handlers = (
      window as typeof window & {
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
      }
    ).__AISW_DESKTOP_EVENT_HANDLERS__;
    handlers?.["tray-command-result"]?.({
      scope: "global",
      id: "context",
      label: "Switch context",
      status: "error",
      message: "Context switch failed.",
      remediation: "Re-open AISW Desktop and verify the saved CLI context.",
    });
  });

  await expect(
    page.getByText(
      "Last context result: Context switch failed. Remediation: Re-open AISW Desktop and verify the saved CLI context.",
    ),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __AISW_NOTIFICATIONS__?: Array<{ title: string; body: string }>;
          }).__AISW_NOTIFICATIONS__ ?? [],
      ),
    )
    .toContainEqual({
      title: "Switch context",
      body: "Context switch failed. Re-open AISW Desktop and verify the saved CLI context.",
    });
});

test("classifies tray profile failures in diagnostics", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByText("Control Center")).toBeVisible();

  await page.evaluate(() => {
    const handlers = (
      window as typeof window & {
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
      }
    ).__AISW_DESKTOP_EVENT_HANDLERS__;
    handlers?.["tray-command-result"]?.({
      scope: "tool",
      tool: "claude",
      label: "Switch profile",
      status: "error",
      kind: "ProfileMissing",
      message: "profile work no longer exists",
      remediation: "Refresh profile state or recreate the missing profile before retrying.",
    });
  });

  await page.getByRole("button", { name: "Diagnostics" }).click();
  await expect(page.getByText("Claude profile missing")).toBeVisible();
  await expect(page.getByText("profile work no longer exists")).toBeVisible();
  await expect(
    page.getByText("Refresh profile state or recreate the missing profile before retrying."),
  ).toBeVisible();
});

test("exports a redacted diagnostic bundle from diagnostics", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();
  await page.getByRole("button", { name: "Export redacted bundle" }).click();

  await expect(page.getByText("Diagnostic bundle exported")).toBeVisible();
  await expect(
    page.getByText("/tmp/aisw-desktop/aisw-desktop-diagnostics-789.json"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Copy bundle path" }).click();
  await expect(
    page.getByText("Copied bundle path /tmp/aisw-desktop/aisw-desktop-diagnostics-789.json."),
  ).toBeVisible();
});

test("shows no-action states when diagnostics are healthy", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  await expect(page.getByText("No failing or warning diagnostics are currently reported.")).toBeVisible();
  await expect(
    page.getByText("No direct fix actions are available from the current diagnostics state."),
  ).toBeVisible();
  await expect(page.getByText("No safe automatic repairs are currently planned.")).toBeVisible();
});

test("shows token warnings in the overview cards", async ({ page }) => {
  await installDesktopMock(page, "tokenWarnings");

  await page.goto("/");

  await expect(
    page.getByText("Token warning: Claude session expires soon Expires in 2 days."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Warning: Refresh Claude authentication soon. Remediation: Run the guided OAuth flow again.",
    ),
  ).toBeVisible();
});

test("applies safe repairs from diagnostics", async ({ page }) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  await expect(page.getByText("1 actions planned")).toBeVisible();
  await page.getByRole("button", { name: "Apply safe repairs" }).click();

  await expect(page.getByText("Last applied repair")).toBeVisible();
  await expect(page.getByText("1 actions applied")).toBeVisible();
});

test("shows doctor remediations and targeted repair actions in diagnostics", async ({ page }) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  await expect(page.getByText("Local credential store is locked.").first()).toBeVisible();
  await expect(page.getByText("AISW cannot write the active config path.").first()).toBeVisible();
  await expect(page.getByText("Upstream OAuth session timed out.").first()).toBeVisible();
  await expect(page.getByText("Unlock the local credential store and retry.")).toBeVisible();
  await expect(page.getByText("Grant write access to ~/.aisw")).toBeVisible();
  await expect(page.getByText("Retry the switch")).toBeVisible();
  await expect(
    page.getByText("Run the guided OAuth flow again and finish login before timeout."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Apply keyring repair" }).click();
  await expect(page.getByText("1 actions applied").first()).toBeVisible();

  await page.getByRole("button", { name: "Repair permissions" }).click();
  await expect(page.getByText("repair config path permissions")).toBeVisible();

  await page.getByRole("button", { name: "Retry OAuth repair" }).click();
  await expect(page.getByText("retry the OAuth recovery flow")).toBeVisible();

  await page.getByRole("button", { name: "Show keyring setup" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keyring setup" })).toBeVisible();
  await expect(page.getByText("Linux Secret Service")).toBeVisible();
  await expect(page.getByRole("button", { name: "Keyring setup", pressed: true })).toBeVisible();
});

test("opens shell setup from diagnostics when doctor reports the shell hook is inactive", async ({
  page,
}) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  const shellHookFix = page.locator("article").filter({ hasText: "Shell hook not active" });
  await expect(shellHookFix).toBeVisible();
  await expect(shellHookFix.getByText("Shell hook is not active in the current shell session.")).toBeVisible();

  await shellHookFix.getByRole("button", { name: "Open shell setup" }).click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shell hook" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Shell hook", pressed: true })).toBeVisible();
});

test("switches one tool directly from overview and refreshes the active profile state", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  const codexCard = page.locator(".tool-card").filter({ hasText: "Codex" });
  await codexCard.getByLabel("Switch codex profile").selectOption("work");
  await codexCard.getByRole("button", { name: "Switch to Work" }).click();

  await expect(codexCard.getByRole("heading", { name: "Work" })).toBeVisible();
  await expect(codexCard.getByText("Last result: Switched Codex to Work.")).toBeVisible();
});

test("uses saved profile labels in overview switch results", async ({ page }) => {
  await installDesktopMock(page, "labelOverrides");

  await page.goto("/");

  const codexCard = page.locator(".tool-card").filter({ hasText: "Codex" });
  await codexCard.getByLabel("Switch codex profile").selectOption("work");
  await codexCard.getByRole("button", { name: /Code Work/ }).click();

  await expect(codexCard.getByText("Last result: Switched Codex to Code Work.")).toBeVisible();
});

test("activates a local profile set from overview quick switch", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  const overview = page.locator(".section-card").filter({ hasText: "Control Center" });
  await overview.getByRole("combobox").first().selectOption("set:client-acme");
  await overview.getByRole("button", { name: "Switch all" }).click();

  await expect(page.getByText("Last bulk result: Activated profile set Client Acme.")).toBeVisible();
  await expect(page.locator(".tool-card").filter({ hasText: "Codex" }).getByRole("heading", { name: "Work" })).toBeVisible();
});

test("saves and deletes a local profile set from contexts", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  const contextsForm = page.locator("form.stacked-form");
  await contextsForm.getByLabel("Profile set name").fill("focus-mode");
  await contextsForm.getByLabel("Label").fill("Focus Mode");
  await contextsForm.getByLabel("Claude").selectOption("work");
  await contextsForm.getByLabel("Codex").selectOption("work");
  await contextsForm.getByRole("button", { name: "Save profile set" }).click();

  await expect(page.getByText("Saved profile set Focus Mode.")).toBeVisible();
  const focusModeRow = page.locator(".list-row").filter({ hasText: "Focus Mode" });
  await expect(focusModeRow).toHaveCount(1);
  await focusModeRow.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted profile set Focus Mode.")).toBeVisible();
  await expect(focusModeRow).toHaveCount(0);
});

test("renames a local profile set from contexts without leaving the old entry behind", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  await page.locator(".list-row").filter({ hasText: "Client Acme" }).getByRole("button", { name: "Edit" }).click();

  const contextsForm = page.locator("form.stacked-form");
  await expect(contextsForm.getByLabel("Profile set name")).toHaveValue("client-acme");
  await expect(contextsForm.getByRole("button", { name: "Update profile set" })).toBeVisible();

  await contextsForm.getByLabel("Profile set name").fill("client-acme-prime");
  await contextsForm.getByLabel("Label").fill("Client Acme Prime");
  await contextsForm.getByRole("button", { name: "Update profile set" }).click();

  await expect(page.getByText("Updated profile set Client Acme Prime.")).toBeVisible();
  await expect(page.locator(".list-row").filter({ hasText: "Client Acme Prime" })).toHaveCount(1);
  await expect(page.getByText("Client Acme", { exact: true })).toHaveCount(0);
});

test("activates a local profile set from contexts", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  await page.locator(".list-row").filter({ hasText: "Client Acme" }).getByRole("button", { name: "Activate set" }).click();

  await expect(page.getByText("Activated profile set Client Acme.")).toBeVisible();
  const activeSetRow = page.locator(".list-row").filter({ hasText: "Client Acme ✓" }).first();
  await expect(activeSetRow).toContainText("Client Acme ✓");
  await expect(activeSetRow.getByRole("button", { name: "Active set" })).toBeDisabled();
  await page.getByRole("button", { name: "Workspaces" }).click();
  await expect(page.getByText("Current context: Client Acme")).toBeVisible();
});

test("uses native profile-set activation when a matching CLI context exists", async ({ page }) => {
  await installDesktopMock(page, "matchingContextSet");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();
  await page.locator(".list-row").filter({ hasText: "Client Acme" }).getByRole("button", { name: "Activate set" }).click();

  await expect(page.getByText("Activated profile set Client Acme.")).toBeVisible();
  const activeSetRow = page.locator(".list-row").filter({ hasText: "Client Acme ✓" }).first();
  await expect(activeSetRow).toContainText("Client Acme ✓");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __AISW_COMMAND_LOG__?: Array<{ command: string }>;
          }).__AISW_COMMAND_LOG__ ?? [],
      ),
    )
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "activate_profile_set" }),
      ]),
    );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __AISW_COMMAND_LOG__?: Array<{ command: string }>;
          }).__AISW_COMMAND_LOG__?.some(
            (entry) => entry.command === "use_all_profiles" || entry.command === "use_profile",
          ) ?? false,
      ),
    )
    .toBe(false);
});

test("activates a CLI context from contexts", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  await page.locator(".list-row").filter({ hasText: "client-acme" }).getByRole("button", { name: "Activate CLI context" }).click();
  await expect(page.getByText("Last context result: Activated context client-acme.")).toBeVisible();

  await page.getByRole("button", { name: "Workspaces" }).click();
  await expect(page.getByText("Current context: client-acme")).toBeVisible();
  await expect(page.getByText("Expected context: client-acme")).toBeVisible();
});

test("uses saved profile-set labels in CLI context activation results", async ({ page }) => {
  await installDesktopMock(page, "matchingContextSet");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  const cliContextRow = page.locator(".list-row").filter({ hasText: "client-acme" });
  await expect(cliContextRow.getByText("Client Acme")).toBeVisible();
  await expect(cliContextRow.getByText("CLI context id: client-acme")).toBeVisible();
  await cliContextRow.getByRole("button", { name: "Activate CLI context" }).click();
  await expect(page.getByText("Last context result: Activated context Client Acme.")).toBeVisible();

  await page.getByRole("button", { name: "Workspaces" }).click();
  await expect(page.getByText("Current context: Client Acme")).toBeVisible();
});

test("marks the active CLI context and disables reactivation", async ({ page }) => {
  await installDesktopMock(page, "matchingContextSet");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  const cliContextRow = page.locator(".list-row").filter({ hasText: "client-acme" });
  await cliContextRow.getByRole("button", { name: "Activate CLI context" }).click();
  await expect(page.getByText("Last context result: Activated context Client Acme.")).toBeVisible();

  await page.getByRole("button", { name: "Workspaces" }).click();
  await expect(page.getByText("Current context: Client Acme")).toBeVisible();

  await page.getByRole("button", { name: "Contexts" }).click();
  const activeContextRow = page.locator(".list-row").filter({ hasText: "Client Acme ✓" });
  await expect(activeContextRow.getByRole("button", { name: "Active context" })).toBeDisabled();
});

test("preserves shared state mode when activating a CLI context", async ({ page }) => {
  await installDesktopMock(page, "sharedWorkspaceContext");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  await page.locator(".list-row").filter({ hasText: "client-acme" }).getByRole("button", { name: "Activate CLI context" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const log = window.__AISW_COMMAND_LOG__ ?? [];
        const matching = [...log].reverse().find((entry) => entry.command === "use_context");
        return matching?.args?.request?.state_mode;
      }),
    )
    .toBe("shared");
});

test("uses the newest matching backup when restoring latest from profiles", async ({ page }) => {
  await installDesktopMock(page, "profileLatestBackup");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByRole("button", { name: "Restore latest + activate" }).click();
  await page.getByRole("button", { name: "Confirm restore latest and activate" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const log = window.__AISW_COMMAND_LOG__ ?? [];
        const matching = [...log].reverse().find((entry) => entry.command === "restore_backup");
        return matching?.args?.backup_id;
      }),
    )
    .toBe("20260327T121500Z-claude-work");
});

test("keeps empty profile sets out of activation surfaces", async ({ page }) => {
  await installDesktopMock(page, "emptyProfileSet");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  const emptySetRow = page.locator(".list-row").filter({ hasText: "Empty Set" });
  await expect(emptySetRow.getByRole("button", { name: "Activate set" })).toBeDisabled();
  await expect(
    emptySetRow.getByText(
      "Add at least one mapped profile before using this set in overview, tray, or workspace bindings.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByRole("option", { name: "Profile set: Empty Set" })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Profile set: Client Acme" })).toHaveCount(1);

  await page.getByRole("button", { name: "Workspaces" }).click();
  await expect(page.getByRole("option", { name: "Profile set: Empty Set" })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Profile set: Client Acme" })).toHaveCount(1);

  await page.getByRole("button", { name: "Contexts" }).click();
  await page.getByLabel("Profile set name").fill("empty-next");
  await expect(page.getByRole("button", { name: "Save profile set" })).toBeDisabled();
  await expect(
    page.getByText("Select at least one tool profile before saving this profile set."),
  ).toBeVisible();
});

test("uses saved profile labels in context summaries and selectors", async ({ page }) => {
  await installDesktopMock(page, "labelOverrides");

  await page.goto("/");
  await page.getByRole("button", { name: "Contexts" }).click();

  await expect(page.getByText("claude: Office · codex: Code Work · gemini: none")).toBeVisible();
  const contextsForm = page.locator("form.stacked-form");
  await expect(contextsForm.getByLabel("Codex").getByRole("option", { name: "Code Work" })).toHaveCount(1);
});

test("binds and resolves workspace context from the workspaces panel", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Workspaces" }).click();

  await expect(page.getByRole("heading", { name: "Workspace mismatch" })).toBeVisible();
  await expect(page.getByText("Current context: work")).toBeVisible();
  await expect(page.getByText("Expected context: Client Acme")).toBeVisible();
  await expect(page.getByText("Default context: work")).toBeVisible();
  await expect(page.getByText("path · /code/acme")).toBeVisible();
  await expect(page.getByText("Matched binding ✓")).toBeVisible();

  await page.getByRole("button", { name: "Use expected context now" }).click();
  await expect(page.getByText("Last workspace result: Switched to Client Acme for /code/acme.")).toBeVisible();
  await expect(page.getByText("Current context: Client Acme")).toBeVisible();
  await expect(page.getByText("Expected context: Client Acme")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __AISW_NOTIFICATIONS__?: Array<{ title: string; body: string }>;
          }).__AISW_NOTIFICATIONS__ ?? [],
      ),
    )
    .toContainEqual({
      title: "Workspace switch",
      body: "Switched to Client Acme for /code/acme.",
    });

  const workspacesForm = page.locator("form.stacked-form");
  await workspacesForm.getByLabel("Binding scope").selectOption("path");
  await workspacesForm.locator("select").nth(1).selectOption("client-acme");
  await workspacesForm.getByRole("textbox").fill("/code/next");
  await workspacesForm.getByRole("button", { name: "Save binding" }).click();

  await expect(page.getByText("Last workspace result: Saved workspace binding for Client Acme.")).toBeVisible();
  await expect(page.getByText("path · /code/next")).toBeVisible();

  await page.getByRole("button", { name: "Guard strict" }).click();
  await expect(page.getByText("Guard mode: strict")).toBeVisible();

  await page.getByRole("button", { name: "Remove this binding" }).first().click();
  await expect(page.getByText("path · /code/acme")).not.toBeVisible();
});

test("dedupes workspace binding targets when a profile set matches a CLI context", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Workspaces" }).click();

  await expect(page.getByRole("option", { name: "Profile set: Client Acme" })).toHaveCount(1);
  await expect(page.getByRole("option", { name: "CLI context: client-acme" })).toHaveCount(0);
});

test("labels workspace summary as a CLI context when no profile set matches", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext");

  await page.goto("/");

  await expect(page.getByText("Expected CLI context: client-acme")).toBeVisible();
  await expect(page.getByText("Current context: work")).toBeVisible();

  await page.getByRole("button", { name: "Use expected context now" }).click();

  await expect(page.getByText("Last workspace result: Switched to client-acme for /code/acme.")).toBeVisible();
  await expect(page.getByText("Current context: client-acme")).toBeVisible();
});

test("blocks empty workspace bindings when no context targets are available", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");
  await page.getByRole("button", { name: "Workspaces" }).click();

  await expect(
    page.getByText(
      "No profile sets or CLI contexts are available yet. Create one before saving workspace bindings.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save binding" })).toBeDisabled();

  const workspacesForm = page.locator("form.stacked-form");
  await workspacesForm.getByLabel("Binding scope").selectOption("path");

  await expect(
    page.getByText("Enter a path prefix before saving or removing this binding."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save binding" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Remove binding" })).toBeDisabled();
});

test("shows missing-tool guidance and opens the install guide from diagnostics", async ({ page }) => {
  await installDesktopMock(page, "missingTool");

  await page.goto("/");

  const geminiCard = page.locator(".tool-card").filter({
    hasText: "Gemini is not available on PATH, so AISW Desktop cannot switch or verify that tool yet.",
  });
  await expect(geminiCard).toBeVisible();
  await expect(geminiCard.getByText("npm install -g @google/gemini-cli")).toBeVisible();
  await expect(geminiCard.getByText("gemini --version")).toBeVisible();
  await expect(geminiCard.getByText(/(which|where) gemini/)).toBeVisible();

  await page.getByRole("button", { name: "Diagnostics" }).click();
  const missingToolCard = page.locator(".diagnostic-card").filter({ hasText: "gemini is missing" });
  await expect(missingToolCard).toBeVisible();
  const doctorRunsBeforeRefresh = await page.evaluate(
    () => (window.__AISW_COMMAND_LOG__ ?? []).filter((entry) => entry.command === "run_doctor").length,
  );
  const snapshotReadsBeforeRefresh = await page.evaluate(
    () => (window.__AISW_COMMAND_LOG__ ?? []).filter((entry) => entry.command === "get_snapshot").length,
  );
  await missingToolCard.getByRole("button", { name: "Refresh diagnostics" }).click();
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => (window.__AISW_COMMAND_LOG__ ?? []).filter((entry) => entry.command === "run_doctor").length,
        ),
    )
    .toBeGreaterThan(doctorRunsBeforeRefresh);
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => (window.__AISW_COMMAND_LOG__ ?? []).filter((entry) => entry.command === "get_snapshot").length,
        ),
    )
    .toBeGreaterThan(snapshotReadsBeforeRefresh);
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

test("shows remediation when update install fails", async ({ page }) => {
  await installDesktopMock(page, "updaterInstallError");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Check for updates" }).click();

  await expect(page.getByText("Update available: 0.2.0")).toBeVisible();
  await page.getByRole("button", { name: "Install update" }).click();

  await expect(page.getByText("Update install failed")).toBeVisible();
  await expect(page.getByText("Desktop update failed: signature mismatch")).toBeVisible();
  await expect(
    page.getByText(
      "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
    ),
  ).toBeVisible();
});

test("shows runtime detection and shell guidance in settings", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const settingsSection = page.locator(".section-card").filter({ hasText: "Runtime and home directory" });
  const shellSection = page.locator(".section-card").filter({ hasText: "Explicit shell guidance" });

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    settingsSection.getByText("Current resolved path: /Applications/AISW.app/Contents/Resources/aisw"),
  ).toBeVisible();
  await expect(settingsSection.getByText("Effective AISW home: ~/.aisw")).toBeVisible();
  await expect(
    settingsSection.getByText("Bundled aisw: /Applications/AISW.app/Contents/Resources/aisw"),
  ).toBeVisible();
  await expect(settingsSection.getByText("System aisw: /opt/homebrew/bin/aisw")).toBeVisible();
  await expect(settingsSection.getByText("Selected update channel: Stable")).toBeVisible();
  await expect(settingsSection.getByText("Selected backend: Bundled")).toBeVisible();
  await expect(settingsSection.getByText("Runtime version: 0.3.7")).toBeVisible();
  await expect(settingsSection.getByText("CLI API 1 · JSON schema 1 · Progress schema 1")).toBeVisible();

  await expect(shellSection.getByRole("heading", { name: "Shell hook" })).toBeVisible();
  await expect(shellSection.getByText("Detected shell: Zsh")).toBeVisible();
  await expect(shellSection.getByText("Config file: ~/.zshrc")).toBeVisible();
  await expect(shellSection.getByText("echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc")).toBeVisible();
  await expect(shellSection.getByText("source ~/.zshrc")).toBeVisible();
  await expect(shellSection.getByText("echo \"$AISW_SHELL_HOOK\"")).toBeVisible();
  await expect(shellSection.getByText("Expected output: 1")).toBeVisible();
});

test("saves custom runtime and AISW home settings", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  await page.getByLabel("Runtime selection").selectOption("custom");
  await page.getByLabel("Runtime path").fill("/opt/custom/aisw");
  await page.getByLabel("AISW_HOME override").fill("/tmp/aisw-home");
  await page.getByRole("button", { name: "Save settings" }).click();

  await expect(page.getByLabel("Runtime selection")).toHaveValue("custom");
  await expect(page.getByLabel("Runtime path")).toHaveValue("/opt/custom/aisw");
  await expect(page.getByLabel("AISW_HOME override")).toHaveValue("/tmp/aisw-home");

  const settingsSection = page.locator(".section-card").filter({ hasText: "Runtime and home directory" });
  await expect(settingsSection.getByText("Selected backend: Custom")).toBeVisible();
});

test("requires saving settings before updater actions use a changed channel", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  await page.getByLabel("Update channel").selectOption("beta");
  await expect(
    page.getByText("Check for a signed AISW Desktop release on the selected beta channel."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Save settings before checking for updates so the runtime and channel selection match the persisted desktop configuration.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Check for updates" })).toBeDisabled();

  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(
    page.getByText(
      "Save settings before checking for updates so the runtime and channel selection match the persisted desktop configuration.",
    ),
  ).not.toBeVisible();

  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(page.getByText("Channel: beta", { exact: true })).toBeVisible();
  await expect(page.getByText(/Endpoint:\s*https:\/\/updates\.example\.com\/beta\.json/)).toBeVisible();
});

test("clears stale update results after channel edits until the user checks again", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Check for updates" }).click();

  await expect(page.getByText("Update available: 0.2.0")).toBeVisible();
  await expect(page.getByText(/Endpoint:\s*https:\/\/updates\.example\.com\/stable\.json/)).toBeVisible();

  await page.getByLabel("Update channel").selectOption("beta");
  await expect(page.getByText("Update available: 0.2.0")).not.toBeVisible();
  await expect(page.getByText(/Endpoint:\s*https:\/\/updates\.example\.com\/stable\.json/)).not.toBeVisible();

  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Update available: 0.2.0")).not.toBeVisible();
  await expect(page.getByText(/Endpoint:\s*https:\/\/updates\.example\.com\/stable\.json/)).not.toBeVisible();

  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(page.getByText("Update available: 0.3.0-beta.1")).toBeVisible();
  await expect(page.getByText(/Endpoint:\s*https:\/\/updates\.example\.com\/beta\.json/)).toBeVisible();
});

test("checks and installs a signed desktop update", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Check for updates" }).click();

  await expect(page.getByText("Update available: 0.2.0")).toBeVisible();
  await page.getByRole("button", { name: "Install update" }).click();

  await expect(page.getByText("Update installed. Restart has been requested.")).toBeVisible();
});

test("clears a saved custom runtime path after switching back to bundled runtime", async ({ page }) => {
  await installDesktopMock(page, "customRuntime");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const runtimePath = page.getByLabel("Runtime path");
  await expect(runtimePath).toHaveValue("/opt/aisw/bin/aisw");
  await expect(runtimePath).toBeEnabled();

  await page.getByLabel("Runtime selection").selectOption("bundled");
  await expect(runtimePath).toBeDisabled();

  await page.getByRole("button", { name: "Save settings" }).click();

  await expect(runtimePath).toHaveValue("");
  await expect(page.getByText("Selected backend: Bundled")).toBeVisible();
  await expect(page.getByText("Current resolved path: /Applications/AISW.app/Contents/Resources/aisw")).toBeVisible();
});

test("switches from a custom runtime back to the system aisw selection", async ({ page }) => {
  await installDesktopMock(page, "customRuntime");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const runtimePath = page.getByLabel("Runtime path");
  await expect(runtimePath).toHaveValue("/opt/aisw/bin/aisw");
  await expect(runtimePath).toBeEnabled();

  await page.getByLabel("Runtime selection").selectOption("system");
  await expect(runtimePath).toBeDisabled();

  await page.getByRole("button", { name: "Save settings" }).click();

  await expect(runtimePath).toHaveValue("");
  await expect(page.getByText("Selected backend: System")).toBeVisible();
  await expect(page.getByText("Current resolved path: /opt/homebrew/bin/aisw")).toBeVisible();
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

test("warns before adding a duplicate profile name", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByLabel("Profile name").fill("work");
  await expect(
    page.getByText(
      "Claude already has a profile named work. Choose a different name or rename the existing profile first.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add profile" })).toBeDisabled();
});

test("runs guided OAuth capture from the profiles screen", async ({ page }) => {
  await installDesktopMock(page, "profiles");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  const profilesSection = page.locator(".section-card").filter({ hasText: "Provisioning" });
  await page.getByLabel("Profile name").fill("personal");
  await page.getByLabel("Import mode").selectOption("oauth");
  await profilesSection.getByRole("button", { name: "Start OAuth" }).click();

  await expect(page.getByText("OAuth progress")).toBeVisible();
  await expect(page.getByText("1. Starting Claude login")).toBeVisible();
  await expect(page.getByText("2. Browser opens")).toBeVisible();
  await expect(page.getByText("3. Complete login in browser")).toBeVisible();
  await expect(page.getByText("4. Waiting for credential capture")).toBeVisible();
  await expect(page.getByText("5. Profile saved")).toBeVisible();
  await expect(page.getByText("Preparing the native login flow.")).toBeVisible();
  await expect(page.locator(".inline-note").filter({ hasText: "Launching browser" })).toBeVisible();
  await expect(page.locator(".inline-note").filter({ hasText: "Waiting for login" })).toBeVisible();
  await expect(page.getByText("personal · oauth")).toBeVisible();
});

test("shows token and runtime warnings in profile diagnostic details", async ({ page }) => {
  await installDesktopMock(page, "tokenWarnings");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByRole("button", { name: "View diagnostic details" }).click();

  await expect(page.getByRole("heading", { name: "Diagnostic details" })).toBeVisible();
  await expect(page.getByText("Credential backend: system_keyring")).toBeVisible();
  await expect(page.getByText("Live match: yes")).toBeVisible();
  await expect(page.getByText("Credentials present: no")).toBeVisible();
  await expect(page.getByText("Permissions OK: no")).toBeVisible();
  await expect(
    page.getByText("Token warning: Claude session expires soon Expires in 2 days."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Warning: Keyring access failed. Remediation: Unlock the local credential store and retry.",
    ),
  ).toBeVisible();
});

test("limits live runtime diagnostics to the active profile details", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  const personalRow = page.locator(".list-row").filter({ hasText: "personal · oauth" });
  await personalRow.getByRole("button", { name: "View diagnostic details" }).click();

  await expect(personalRow.getByRole("heading", { name: "Diagnostic details" })).toBeVisible();
  await expect(personalRow.getByText("Auth method: oauth")).toBeVisible();
  await expect(personalRow.getByText("Desktop active: no")).toBeVisible();
  await expect(
    personalRow.getByText(
      "Live runtime diagnostics are only available for the active profile. Activate this profile to verify backend, live-match, token, and permission state.",
    ),
  ).toBeVisible();
  await expect(personalRow.getByText("Credential backend: system_keyring")).toHaveCount(0);
  await expect(personalRow.getByText(/^Live match:/)).toHaveCount(0);
  await expect(personalRow.getByText(/^Token warning:/)).toHaveCount(0);
});

test("shows missing-profile remediation when a stale profile is re-applied", async ({ page }) => {
  await installDesktopMock(page, "staleProfile");

  await page.goto("/");
  await page.getByRole("button", { name: "Re-apply Work" }).click();

  await expect(
    page.getByText(
      "Last result: profile work no longer exists Remediation: Refresh profile state or recreate the missing profile before retrying.",
    ),
  ).toBeVisible();
});

test("classifies non-interactive failures in diagnostics", async ({ page }) => {
  await installDesktopMock(page, "nonInteractiveProfile");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByLabel("Profile name").fill("ops");
  await page.getByRole("button", { name: "Add profile" }).click();

  await expect(page.getByText("interactive login required")).toBeVisible();

  await page.getByRole("button", { name: "Diagnostics" }).click();
  await expect(page.getByText("Non-interactive mode failure")).toBeVisible();
  await expect(
    page.getByText(
      "Rerun this flow in an interactive session or use a supported non-interactive import method.",
    ),
  ).toBeVisible();
});

test("surfaces recent command failures in diagnostics", async ({ page }) => {
  await installDesktopMock(page, "staleProfile");

  await page.goto("/");
  await page.getByRole("button", { name: "Re-apply Work" }).click();

  await expect(
    page.getByText(
      "Last result: profile work no longer exists Remediation: Refresh profile state or recreate the missing profile before retrying.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Diagnostics" }).click();

  const failureCard = page.locator("article").filter({ hasText: "Claude profile missing" });
  await expect(failureCard).toBeVisible();
  await expect(failureCard.getByText("profile work no longer exists")).toBeVisible();
  await expect(
    failureCard.getByText(
      "Refresh profile state or recreate the missing profile before retrying.",
    ),
  ).toBeVisible();

  await failureCard.getByRole("button", { name: "Open profile details" }).click();
  await expect(page.getByRole("heading", { name: "Diagnostic details" })).toBeVisible();
});

test("warns before renaming a profile to a duplicate name", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  const personalRow = page.locator(".list-row").filter({ hasText: "personal · oauth" });
  await personalRow.getByLabel("rename personal").fill("work");
  await expect(
    page.getByText(
      "Claude already has a profile named work. Choose a different name or rename the existing profile first.",
    ),
  ).toBeVisible();
  await expect(personalRow.getByRole("button", { name: "Rename" })).toBeDisabled();
});

test("shows remediation text for profile command failures", async ({ page }) => {
  await installDesktopMock(page, "profileCommandError");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByLabel("Profile name").fill("ops");
  await page.getByRole("button", { name: "Add profile" }).click();

  await expect(
    page.getByText("keyring unavailable Remediation: Unlock the local credential store and retry."),
  ).toBeVisible();
});

test("renames, relabels, and removes profiles from the profiles screen", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  const workRow = page.locator(".list-row").filter({ hasText: "work · oauth" });
  await workRow.getByLabel("rename work").fill("client-acme");
  await workRow.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByText("client-acme · oauth")).toBeVisible();

  const renamedRow = page.locator(".list-row").filter({ hasText: "client-acme · oauth" });
  await renamedRow.getByLabel("label client-acme").fill("Client Acme");
  await renamedRow.getByRole("button", { name: "Relabel" }).click();
  await expect(renamedRow.getByText("Client Acme")).toBeVisible();

  await renamedRow.getByRole("button", { name: "Remove active…" }).click();
  await renamedRow.getByRole("button", { name: "Confirm remove active" }).click();
  await expect(page.getByText("client-acme · oauth")).not.toBeVisible();
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
  await expect(page.getByText("Affects Codex / Work. Restore files only unless you explicitly re-activate this profile.")).toBeVisible();

  await page.getByRole("button", { name: "Restore and activate" }).click();
  await expect(
    page.getByText(
      "Confirm before restoring and activating Codex / Work. This replays the backup and switches the live profile again.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm restore and activate" }).click();

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.locator(".tool-card").filter({ hasText: "Codex" }).getByRole("heading", { name: "Work" })).toBeVisible();
});

test("restores backup files only without re-activating the profile", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await page.getByRole("button", { name: "Backups" }).click();
  await page.getByRole("button", { name: "Restore files only" }).click();
  await expect(
    page.getByText(
      "Confirm before restoring Codex / Work. This replays the saved files only.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm restore files" }).click();

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.locator(".tool-card").filter({ hasText: "Codex" }).getByRole("heading", { name: "Personal" })).toBeVisible();
});

test("warns before restoring the latest profile backup from profiles", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByLabel("Tool").selectOption("codex");
  await page.getByRole("button", { name: "Restore latest + activate" }).click();

  await expect(
    page.getByText(
      "Confirm before restoring and activating the latest backup for Codex / Work. This replays the backup and switches the live profile again.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Confirm restore latest and activate" }).click();
  await expect(page.locator(".list-row p").filter({ hasText: "work · api_key" }).first()).toBeVisible();
});

test("passes the selected state mode when restoring and re-activating from profiles", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  const profilesSection = page.locator(".section-card").filter({ hasText: "Profiles" });
  await profilesSection.locator("form select").first().selectOption("codex");
  await profilesSection.getByRole("radio", { name: "Shared" }).click();
  await profilesSection.getByRole("button", { name: "Restore latest + activate" }).click();
  await profilesSection.getByRole("button", { name: "Confirm restore latest and activate" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const log = window.__AISW_COMMAND_LOG__ ?? [];
        const matching = [...log].reverse().find((entry) => entry.command === "use_profile");
        return matching?.args?.request?.state_mode;
      }),
    )
    .toBe("shared");
});

test("restores the latest profile backup without re-activating it", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByLabel("Tool").selectOption("codex");
  await page.getByRole("button", { name: "Restore latest", exact: true }).click();

  await expect(
    page.getByText(
      "Confirm before restoring the latest backup for Codex / Work. This replays the saved files only.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm restore latest" }).click();

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.locator(".tool-card").filter({ hasText: "Codex" }).getByRole("heading", { name: "Personal" })).toBeVisible();
});

test("uses saved labels in backup restore copy", async ({ page }) => {
  await installDesktopMock(page, "labelOverrides");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  const backupRow = page.locator(".list-row").filter({ hasText: "Code Work" });
  await expect(backupRow.getByText("Code Work", { exact: true })).toBeVisible();
  await expect(
    backupRow.getByText(
      "Affects Codex / Code Work. Restore files only unless you explicitly re-activate this profile.",
    ),
  ).toBeVisible();

  await backupRow.getByRole("button", { name: "Restore and activate" }).click();
  await expect(
    backupRow.getByText(
      "Confirm before restoring and activating Codex / Code Work. This replays the backup and switches the live profile again.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByLabel("Tool").selectOption("codex");
  await page.getByRole("button", { name: "Restore latest + activate" }).click();
  await expect(
    page.getByText(
      "Confirm before restoring and activating the latest backup for Codex / Code Work. This replays the backup and switches the live profile again.",
    ),
  ).toBeVisible();
});

test("lists backups newest first, copies backup ids, and opens matching profile details", async ({
  page,
}) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  const backupsSection = page.locator(".section-card").filter({ hasText: "Backups" });
  const backupRows = backupsSection.locator(".list-row");
  await expect(backupRows).toHaveCount(2);
  await expect(backupRows.nth(0)).toContainText("Personal");
  await expect(backupRows.nth(1)).toContainText("Work");

  await backupRows.nth(0).getByRole("button", { name: "Copy backup ID" }).click();
  await expect(page.getByText("Copied backup id 20260326T094012Z-codex-personal.")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __AISW_CLIPBOARD_WRITES__?: string[] }).__AISW_CLIPBOARD_WRITES__ ?? [],
      ),
    )
    .toContain("20260326T094012Z-codex-personal");

  await backupRows.nth(1).getByRole("button", { name: "Open profile details" }).click();
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(page.getByLabel("Tool")).toHaveValue("claude");
  await expect(page.getByText("Credential backend: system_keyring")).toBeVisible();
});

async function installDesktopMock(
  page: Page,
  scenario: ScenarioName,
  capabilitiesOverride = toolCapabilities,
) {
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
              : "/Applications/AISW.app/Contents/Resources/aisw",
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
          activeScenario === "diagnosticFixes"
            ? "work"
            : "none",
        guard_mode: "warn",
        default_context:
          activeScenario === "switching" ||
          activeScenario === "trayWorkspaceRefresh" ||
          activeScenario === "diagnosticFixes"
            ? "work"
            : "none",
        items:
          activeScenario === "switching" ||
          activeScenario === "workspaceContext" ||
          activeScenario === "trayWorkspaceRefresh" ||
          activeScenario === "diagnosticFixes"
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
              message: "aisw binary could not be resolved",
              remediation: "Stage the bundled aisw binary or switch to a working system runtime.",
            };
          }
          if (activeScenario === "incompatibleRuntime") {
            return {
              ...deepClone(state.bootstrap),
              runtime_status: {
                ...deepClone(state.bootstrap.runtime_status),
                compatible: false,
                issues: ["aisw does not advertise mutation_json support"],
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
            current_version: "0.1.0",
            endpoint: `https://updates.example.com/${state.settings.update_channel}.json`,
            update: {
              version:
                state.settings.update_channel === "beta" ? "0.3.0-beta.1" : "0.2.0",
              current_version: "0.1.0",
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
            current_version: "0.1.0",
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
    { activeScenario: scenario, capabilities: capabilitiesOverride },
  );
}

async function importDetectedAccount(page: Page, tool: string, profile: string) {
  const form = page.locator("form").filter({ has: page.getByLabel(`${tool} profile name`) });
  await form.getByLabel(`${tool} profile name`).fill(profile);
  await form.getByRole("button", { name: "Import current login" }).click();
}
