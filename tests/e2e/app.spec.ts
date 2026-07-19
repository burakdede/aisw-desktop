import { expect, test, type Locator, type Page } from "@playwright/test";
import { importDetectedAccount, installDesktopMock } from "./desktopMock";

test("imports a detected account during onboarding", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByText("Switch accounts safely")).toBeVisible();
  await expect(page.getByRole("button", { name: "Get Started" })).toBeVisible();

  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(page.getByRole("button", { name: "Inspect Claude" })).toBeVisible();
  await expect(page.getByText("detected · oauth").first()).toBeVisible();

  await importDetectedAccount(page, "claude", "work");

  await page.getByRole("tab", { name: "First switch" }).click();
  await expect(page.getByLabel("First switch profile")).toContainText("Work");
});

test("dismisses the onboarding live-import dialog without saving a profile", async ({
  page,
}) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("button", { name: "Inspect Claude" }).click();
  await page.getByRole("button", { name: "Import as profile" }).click();

  const dialog = page.getByRole("dialog", { name: "Import Claude Code Profile" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Profile name").fill("draft-profile");
  await dialog.getByLabel("Label").fill("Draft Profile");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Import as profile" })).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "add_profile")).toBe(false);
});

test("closes the onboarding live-import dialog from the header action", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("button", { name: "Inspect Claude" }).click();
  await page.getByRole("button", { name: "Import as profile" }).click();

  const dialog = page.getByRole("dialog", { name: "Import Claude Code Profile" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Profile name").fill("draft-profile");
  await dialog.getByLabel("Label").fill("Draft Profile");
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import as profile" })).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "add_profile")).toBe(false);
});

test("opens the terminal setup section from onboarding", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");
  await page.getByRole("tab", { name: "Terminal" }).click();

  await expect(page.getByText("Detected shell:")).toBeVisible();
  await page.getByRole("button", { name: "Open terminal setup" }).click();

  await expect(page.getByRole("button", { name: "Terminal Integration", pressed: true })).toBeVisible();
  await expect(page.getByText("Config file")).toBeVisible();
  await expect(page.getByText("~/.zshrc")).toBeVisible();
});

test("routes unsupported live imports into profiles setup", async ({ page }) => {
  await installDesktopMock(
    page,
    "switching",
    {
      claude: {
        auth_methods: ["from_env", "api_key"],
        state_modes: ["isolated", "shared"],
        credential_backends: ["file"],
      },
      codex: { state_modes: ["isolated", "shared"] },
      gemini: { state_modes: [] },
    },
    {
      initReport: {
        result: {
          live_accounts: [{ tool: "claude", outcome: "detected", auth_method: "oauth" }],
        },
      },
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Open Account Setup" }).click();

  await expect(page.getByLabel("Tool")).toHaveValue("claude");
  await expect(page.getByLabel("Import mode")).toHaveValue("from_env");
});

test("opens profile setup from onboarding when live import requires another sign-in method", async ({
  page,
}) => {
  await installDesktopMock(
    page,
    "onboarding",
    {
      claude: {
        auth_methods: ["from_env", "api_key"],
        state_modes: ["isolated", "shared"],
        credential_backends: ["file"],
      },
      codex: { state_modes: ["isolated", "shared"] },
      gemini: { state_modes: [] },
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("button", { name: "Inspect Claude Code" }).click();

  await expect(page.getByRole("button", { name: "Choose sign-in method" })).toBeVisible();
  await page.getByRole("button", { name: "Choose sign-in method" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles", exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Claude", pressed: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Tool")).toHaveValue("claude");
  await expect(dialog.getByLabel("Import mode")).toHaveValue("from_env");
});

test("shows missing-tool guidance during onboarding", async ({ page }) => {
  await installDesktopMock(page, "onboardingMissingTool");

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Gemini" }).click();

  await expect(page.getByRole("heading", { name: "Gemini CLI is not installed" })).toBeVisible();
  await expect(
    page.getByText(
      "You can finish setup without Gemini CLI. Install the gemini tool later when you want to manage that provider here.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open installation guide" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { __AISW_OPENED_GUIDES__?: string[] }).__AISW_OPENED_GUIDES__ ?? [],
      ),
    )
    .toContain("https://www.npmjs.com/package/@google/gemini-cli");
});

test("uses saved profile labels in onboarding first-switch options and the current-state badge", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", undefined, {
    settings: {
      profile_labels: {
        claude: { work: "Office" },
        codex: { work: "Code Work" },
      },
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
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
        gemini: {
          active: null,
          profiles: [],
        },
      },
      contexts: [],
    },
  });

  await page.goto("/");
  await expect(page.locator(".sidebar-status-stack")).toContainText("Client Acme");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Reopen Setup Assistant" }).click();

  await expect(page.getByRole("heading", { name: "Get started" }).first()).toBeVisible();
  await page.getByRole("tab", { name: "First switch" }).click();
  await expect(page.getByLabel("First switch profile")).toContainText("Office");
});

test("runs the onboarding first switch and updates the setup summary", async ({ page }) => {
  await installDesktopMock(page, "onboarding", undefined, {
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
          auth_method: "oauth",
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
          active: "personal",
          profiles: [
            { name: "personal", auth: "oauth", label: "Personal" },
            { name: "work", auth: "oauth", label: "Work" },
          ],
        },
        codex: {
          active: "personal",
          profiles: [
            { name: "personal", auth: "oauth", label: "Personal" },
            { name: "work", auth: "oauth", label: "Work" },
          ],
        },
        gemini: {
          active: null,
          profiles: [],
        },
      },
      contexts: [],
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("tab", { name: "First switch" }).click();

  const firstSwitchProfile = page.getByLabel("First switch profile");
  await expect(firstSwitchProfile).toContainText("Work");
  await firstSwitchProfile.selectOption("work");
  await page.getByRole("button", { name: "Switch now" }).click();

  await page.getByRole("tab", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "You're ready" })).toBeVisible();
  await expect(
    page.locator(".onboarding-complete-cell").filter({ hasText: "Claude Code" }),
  ).toContainText("work");
  await expect(
    page.locator(".onboarding-complete-cell").filter({ hasText: "Codex CLI" }),
  ).toContainText("work");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_all_profiles" &&
        entry.args?.request?.profile === "work" &&
        entry.args?.request?.state_mode === "isolated",
    ),
  ).toBe(true);
});

test("opens security settings from onboarding credential storage guidance", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Get started" }).first()).toBeVisible();

  await page.getByRole("button", { name: "How credentials stay local" }).click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const settingsNav = page.locator(".settings-category-pane");
  await expect(settingsNav.getByRole("button", { name: "Security", pressed: true })).toBeVisible();

  const securityPane = page.locator(".settings-form-pane");
  await expect(securityPane.getByText("Credential Storage")).toBeVisible();
  await expect(securityPane.getByText("macOS Keychain")).toBeVisible();
  await expect(securityPane.getByText("Local Data")).toBeVisible();
  await expect(securityPane.getByText("~/.aisw")).toBeVisible();
});

test("reruns onboarding setup detection and surfaces newly detected live accounts", async ({
  page,
}) => {
  await installDesktopMock(page, "noLiveAccounts");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Get Started" })).toBeVisible();

  const initialInitRuns = (await readCommandLog(page)).filter(
    (entry) => entry.command === "run_init",
  ).length;

  await page.getByRole("button", { name: "Get Started" }).click();

  await expect(page.getByRole("button", { name: "Inspect Codex" })).toBeVisible();
  await expect(page.getByText("detected · oauth").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh Setup" })).toBeVisible();
  await expect
    .poll(async () =>
      (await readCommandLog(page)).filter((entry) => entry.command === "run_init").length,
    )
    .toBe(initialInitRuns + 1);
});

test("guides onboarding with step footer navigation", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();

  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to First switch" })).toBeVisible();

  await page.getByRole("button", { name: "Continue to First switch" }).click();
  await expect(page.getByText("Step 3 of 5")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Try one safe switch" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Detected tools" })).toBeVisible();

  await page.getByRole("button", { name: "Continue to First switch" }).click();
  await page.getByRole("button", { name: "Continue to Terminal" }).click();
  await page.getByRole("button", { name: "Continue to Done" }).click();

  await expect(page.getByText("Step 5 of 5")).toBeVisible();
  await expect(page.getByRole("heading", { name: "You're ready" })).toBeVisible();
  await expect(page.getByLabel("Setup completion status").getByText("Claude Code")).toBeVisible();
});

test("opens profiles from onboarding when an installed tool still needs a saved profile", async ({
  page,
}) => {
  await installDesktopMock(page, "partialSetup");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByText("Installed, but no saved profile yet").first()).toBeVisible();

  await page.getByLabel("Add codex profile").click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles", exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Codex", pressed: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No matching profiles" })).toBeVisible();
  await expect(addDialog.getByLabel("Tool")).toHaveValue("codex");
});

test("opens profiles from onboarding when an installed tool has no live credentials", async ({
  page,
}) => {
  await installDesktopMock(page, "noLiveAccounts", undefined, {
    snapshot: {
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
    },
    initReport: {
      result: {
        live_accounts: [],
      },
    },
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByText("Installed, but no saved profile yet").first()).toBeVisible();

  await page.getByLabel("Add codex profile").click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles", exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Codex", pressed: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No matching profiles" })).toBeVisible();
  await expect(addDialog.getByLabel("Tool")).toHaveValue("codex");
});

test("keeps setup visible while another installed tool still has no profile", async ({
  page,
}) => {
  await installDesktopMock(page, "partialSetup");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByText("Installed, but no saved profile yet").first()).toBeVisible();
  await expect(page.getByLabel("Add codex profile")).toBeVisible();
});

test("resets settings to the default section when reopened from a fresh entry point", async ({
  page,
}) => {
  await installDesktopMock(page, "noLiveAccounts");

  await page.goto("/");
  await page.getByRole("tab", { name: "Terminal" }).click();
  await expect(page.getByRole("button", { name: "Open terminal setup" })).toBeVisible();
  await page.getByRole("button", { name: "Open terminal setup" }).click();

  const settingsNav = page.locator(".settings-category-pane");
  await expect(settingsNav.getByRole("button", { name: "Terminal Integration", pressed: true })).toBeVisible();
  await expect(page.getByText("Detected shell")).toBeVisible();

  await dispatchDesktopEvent(page, "menu-open-settings");

  await expect(page.getByText("Bundled runtime")).toBeVisible();
  await expect(settingsNav.getByRole("button", { name: "Engine", pressed: true })).toBeVisible();
  await expect(
    settingsNav.getByRole("button", { name: "Terminal Integration", pressed: true }),
  ).toHaveCount(0);
});

test("opens profiles from the onboarding first-switch step when no shared profile choices exist", async ({
  page,
}) => {
  await installDesktopMock(page, "partialSetup");

  await page.goto("/");

  await page.getByRole("tab", { name: "First switch" }).click();
  await expect(
    page.getByText(
      "Import or create matching profile names across tools before running a shared switch check.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open Profiles" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(addDialog.getByLabel("Tool")).toHaveValue("claude");
});

test("restores the bundled engine from onboarding runtime setup", async ({ page }) => {
  await installDesktopMock(page, "onboarding", undefined, {
    settings: {
      runtime_kind: "custom",
      runtime_path: "/opt/aisw/bin/aisw",
    },
    runtime_status: {
      resolved_path: "/opt/aisw/bin/aisw",
      inventory: {
        configured_path: "/opt/aisw/bin/aisw",
      },
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("tab", { name: "Welcome" }).click();

  await expect(
    page.getByText("AI Switch is currently pointing at a custom engine path instead of the included one."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Use Included Engine" })).toBeVisible();

  await page.getByRole("button", { name: "Use Included Engine" }).click();

  await expect(page.getByRole("button", { name: "Use Included Engine" })).toHaveCount(0);
  await expect(
    page.getByText("AI Switch is already set to use the desktop engine bundled with this app."),
  ).toBeVisible();
  await expect(page.getByText("Ready. Version 0.3.8.")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "update_settings" &&
        entry.args?.request?.runtime_kind === "bundled" &&
        entry.args?.request?.runtime_path === null,
    ),
  ).toBe(true);
});

test("opens engine settings from onboarding runtime setup", async ({ page }) => {
  await installDesktopMock(page, "onboarding");

  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("tab", { name: "Welcome" }).click();

  await expect(page.getByRole("button", { name: "Engine Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Engine Settings" }).click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const settingsNav = page.locator(".settings-category-pane");
  await expect(settingsNav.getByRole("button", { name: "Engine", pressed: true })).toBeVisible();

  const runtimePane = page.locator(".settings-form-pane");
  await expect(runtimePane.getByText("Bundled runtime")).toBeVisible();
  await expect(runtimePane.getByText("/Applications/AI Switch.app/Contents/Resources/aisw")).toBeVisible();
});

test("shows runtime compatibility blockers for an unusable runtime", async ({ page }) => {
  await installDesktopMock(page, "incompatibleRuntime");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Finish Setup", exact: true })).toBeVisible();
  await expect(page.getByText("Desktop engine required")).toBeVisible();
  await expect(
    page.getByText(
      "AI Switch Desktop uses the included switching engine. A separate command-line install on this Mac cannot power this app yet.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Engine Settings" })).toBeVisible();

  await page.getByText(/^Why setup paused$/).click();
  await expect(page.getByText("Runtime version details are unavailable")).toBeVisible();
  await expect(page.getByText("Runtime capability details are unavailable")).toBeVisible();
});

test("routes runtime recovery into engine settings", async ({ page }) => {
  await installDesktopMock(page, "incompatibleRuntime");

  await page.goto("/");
  await page.getByRole("button", { name: "Engine Settings" }).click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.locator(".settings-category-pane").getByRole("button", { name: "Engine", pressed: true }),
  ).toBeVisible();
});

test("retries the runtime bootstrap check from the recovery surface", async ({ page }) => {
  await installDesktopMock(page, "incompatibleRuntime");

  await page.goto("/");
  await page.getByRole("button", { name: "Try Again" }).click();

  await expect
    .poll(async () =>
      (await readCommandLog(page)).filter((entry) => entry.command === "get_bootstrap").length,
    )
    .toBeGreaterThan(1);
});

test("shows bootstrap remediation when initial desktop state cannot load", async ({ page }) => {
  await installDesktopMock(page, "bootstrapError");

  await page.goto("/");

  await expect(page.getByText("AI Switch could not open this window.")).toBeVisible();
  await expect(page.getByText("AI Switch could not resolve a compatible switching runtime")).toBeVisible();
  await expect(page.getByText("Select a valid bundled, system, or custom switching runtime.")).toBeVisible();
});

test("shows the waiting snapshot surface when the desktop runtime is ready but no snapshot is available", async ({
  page,
}) => {
  await installDesktopMock(page, "waitingSnapshot");

  await page.goto("/");

  await expect(page.getByText("Bootstrap")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for snapshot" })).toBeVisible();
  await expect(
    page.getByText(
      "The desktop engine is compatible, but no state snapshot is available yet.",
    ),
  ).toBeVisible();
});

test("opens quick switch from the keyboard shortcut and focuses search", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.locator("body").focus();
  await page.keyboard.press("Meta+K");

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Search Quick Switch")).toBeFocused();
});

test("opens settings from the keyboard shortcut", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.keyboard.press("Meta+,");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.locator(".settings-category-pane")).toBeVisible();
});

test("switches primary sections from keyboard shortcuts", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.keyboard.press("Meta+2");
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search Profiles" })).toBeVisible();

  await page.keyboard.press("Meta+6");
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activity more actions" })).toBeVisible();
});

test("supports arrow-key sidebar navigation", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  const sidebar = page.locator(".sidebar");
  const overviewButton = sidebar.getByRole("button", { name: "Overview", exact: true });
  await overviewButton.focus();
  await expect(overviewButton).toBeFocused();

  await page.keyboard.press("ArrowDown");

  const profilesButton = sidebar.getByRole("button", { name: "Profiles", exact: true });
  await expect(profilesButton).toBeFocused();
  await expect(profilesButton).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();

  await page.keyboard.press("End");

  const settingsButton = sidebar.getByRole("button", { name: "Settings", exact: true });
  await expect(settingsButton).toBeFocused();
  await expect(settingsButton).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("opens help from the app menu and routes into diagnostics", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-help");

  const dialog = page.getByRole("dialog", { name: "Using AI Switch" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Desktop control center")).toBeVisible();
  await dialog.getByRole("button", { name: "Open Diagnostics" }).click();

  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect(dialog).toBeHidden();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "open_reference_document")).toBe(true);
});

test("opens profiles and settings from the help sheet", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-help");

  let dialog = page.getByRole("dialog", { name: "Using AI Switch" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Supported tools")).toContainText("Claude");
  await expect(dialog.getByLabel("Supported tools")).toContainText("Codex");
  await expect(dialog.getByLabel("Supported tools")).toContainText("Gemini");
  await expect(dialog.getByRole("button", { name: "Open Profiles" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Open Settings" })).toBeVisible();

  await dialog.getByRole("button", { name: "Open Profiles" }).click();
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(dialog).toBeHidden();

  await dispatchDesktopEvent(page, "menu-open-help");
  dialog = page.getByRole("dialog", { name: "Using AI Switch" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Open Settings" }).click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(dialog).toBeHidden();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "open_reference_document")).toBe(true);
});

test("closes the help sheet without changing screens", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-help");

  const dialog = page.getByRole("dialog", { name: "Using AI Switch" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "open_reference_document")).toBe(true);
});

test("dismisses the help sheet when clicking the overlay", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-help");

  const dialog = page.getByRole("dialog", { name: "Using AI Switch" });
  await expect(dialog).toBeVisible();

  await page.locator(".quick-switch-overlay").click({ position: { x: 12, y: 12 } });

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "open_reference_document")).toBe(true);
});

test("falls back to exporting diagnostics when the issue tracker cannot open", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-issues");

  await expect
    .poll(async () =>
      (await readCommandLog(page)).map((entry) => entry.command),
    )
    .toEqual(expect.arrayContaining(["open_issue_tracker", "export_diagnostic_bundle"]));
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "Diagnostic report exported" &&
          notification?.body === "Saved aisw-desktop-diagnostics-789.json.",
      ),
    )
    .toBe(true);
});

test("opens local documentation from the app menu when it is available", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await overrideDesktopCommand(page, "open_reference_document", {
    result: "/Users/burakdede/Projects/aisw-desktop/README.md",
  });
  await dispatchDesktopEvent(page, "menu-open-help");

  await expect
    .poll(async () =>
      (await readCommandLog(page)).some((entry) => entry.command === "open_reference_document"),
    )
    .toBe(true);
  await expect(page.getByRole("dialog", { name: "Using AI Switch" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("opens the issue tracker from the app menu when it is available", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await overrideDesktopCommand(page, "open_issue_tracker", {
    result: "https://github.com/burakdede/aisw-desktop/issues",
  });
  await dispatchDesktopEvent(page, "menu-open-issues");

  await expect
    .poll(async () =>
      (await readCommandLog(page)).some((entry) => entry.command === "open_issue_tracker"),
    )
    .toBe(true);
  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "export_diagnostic_bundle")).toBe(false);
});

test("opens add profile from the app menu", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-add-profile");

  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Add Profile" })).toBeVisible();
});

test("opens import current login from the app menu in the profiles flow", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-import-current-login");

  const dialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Import mode")).toHaveValue("from_live");
});

test("opens the updates settings section from the app menu", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-settings-updates");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.locator(".settings-category-pane").getByRole("button", {
      name: "Updates",
      pressed: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Check for Updates" })).toBeVisible();
});

test("routes native app-menu navigation across the primary desktop screens", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("button", { name: "Inspect Codex" }).click();
  await page.getByRole("button", { name: "Open Profile" }).click();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Codex", pressed: true }),
  ).toBeVisible();

  await dispatchDesktopEvent(page, "menu-open-profiles");
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "All", pressed: true }),
  ).toBeVisible();

  await dispatchDesktopEvent(page, "menu-open-sets");
  await expect(page.getByRole("heading", { name: "Sets", exact: true })).toBeVisible();
  await expect(page.getByLabel("Sets mode")).toBeVisible();

  await dispatchDesktopEvent(page, "menu-open-diagnostics");
  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify Again" })).toBeVisible();

  await dispatchDesktopEvent(page, "menu-open-backups");
  await expect(page.getByRole("heading", { name: "Backups" })).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Backups filters" })).toBeVisible();

  await dispatchDesktopEvent(page, "menu-open-activity");
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search activity" })).toBeVisible();

  await dispatchDesktopEvent(page, "menu-open-overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quick Switch" })).toBeVisible();
});

test("opens quick switch from the app menu and focuses search", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-quick-switch");

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Search Quick Switch")).toBeFocused();
});

test("switches a saved set from the native app menu quick-switch entry point", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-quick-switch");

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Search Quick Switch")).toBeFocused();
  await dialog.getByLabel("Search Quick Switch").fill("client acme");
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  await expect(page.locator(".overview-set-row")).toContainText("Client Acme");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "activate_profile_set" &&
        entry.args?.name === "client-acme",
    ),
  ).toBe(true);
});

test("runs diagnostics from the native app-menu verify action", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  const doctorRunsBefore = await expectCommandCount(page, "run_doctor");
  const verifyRunsBefore = await expectCommandCount(page, "run_verify");

  await dispatchDesktopEvent(page, "menu-run-verify");

  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect
    .poll(async () => ({
      doctorRuns: await expectCommandCount(page, "run_doctor"),
      verifyRuns: await expectCommandCount(page, "run_verify"),
    }))
    .toEqual({
      doctorRuns: doctorRunsBefore + 1,
      verifyRuns: verifyRunsBefore + 1,
    });
});

test("supports keyboard navigation in quick switch with an active descendant", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  const search = dialog.getByRole("searchbox", { name: "Search Quick Switch" });
  const results = dialog.getByRole("listbox", { name: "Quick Switch results" });

  await expect(results).toBeVisible();
  await expect(search).toHaveAttribute("aria-controls", "quick-switch-results-listbox");

  const initialActiveId = await search.getAttribute("aria-activedescendant");
  expect(initialActiveId).toMatch(/^quick-switch-option-/);
  await expect(page.locator(`[id="${initialActiveId}"]`)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowDown");

  await expect
    .poll(async () => search.getAttribute("aria-activedescendant"))
    .not.toBe(initialActiveId);

  const nextActiveId = await search.getAttribute("aria-activedescendant");
  expect(nextActiveId).toMatch(/^quick-switch-option-/);
  await expect(page.locator(`[id="${nextActiveId}"]`)).toHaveAttribute("aria-selected", "true");
});

test("supports Command-Enter in quick switch for matching shared profiles", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await dialog.getByLabel("Search Quick Switch").fill("work");

  const sharedOption = dialog
    .getByRole("option")
    .filter({ hasText: "Across Claude Code, Codex CLI" })
    .first();
  await sharedOption.hover();
  await page.keyboard.press("Meta+Enter");

  await expect(dialog).toHaveCount(0);
  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "use_all_profiles")).toBe(true);
});

test("groups quick switch tool profiles under full tool names", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  const results = dialog.getByRole("listbox", { name: "Quick Switch results" });
  await expect(results.getByText("Claude Code", { exact: true })).toBeVisible();
  await expect(results.getByText("Codex CLI", { exact: true })).toBeVisible();
});

test("preserves shared state mode when switching all tools from quick switch", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", undefined, {
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
          warnings: [],
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
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await dialog.getByRole("option").filter({ hasText: "Across Claude Code, Codex CLI" }).first().click();
  await expect(dialog).toHaveCount(0);

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_all_profiles" &&
        entry.args?.request?.profile === "work" &&
        entry.args?.request?.state_mode === "shared",
    ),
  ).toBe(true);
});

test("returns focus to the quick switch trigger when the palette closes", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Quick Switch" }).first();
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  const search = dialog.getByLabel("Search Quick Switch");
  await expect(search).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("returns focus to the quick switch trigger when the palette closes from its header button", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Quick Switch" }).first();
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await expect(dialog.getByLabel("Search Quick Switch")).toBeFocused();
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "use_profile")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "use_all_profiles")).toBe(false);
});

test("returns focus to the quick switch trigger when the palette is dismissed by the overlay", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Quick Switch" }).first();
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await expect(dialog.getByLabel("Search Quick Switch")).toBeFocused();

  await page.locator(".quick-switch-overlay").click({ position: { x: 12, y: 12 } });

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "use_profile")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "use_all_profiles")).toBe(false);
});

test("clears the quick switch query from the search field", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  const search = dialog.getByRole("searchbox", { name: "Search Quick Switch" });
  await search.fill("office");
  await expect(search).toHaveValue("office");

  await dialog.getByRole("button", { name: "Clear Search Quick Switch" }).click();
  await expect(search).toHaveValue("");
});

test("announces an available desktop update on launch and lets the user dismiss it", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await expect(page.getByText("AI Switcher 0.2.0 is available")).toBeVisible();
  await expect(page.getByText("Faster switching and signed updater artifacts.")).toBeVisible();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "AI Switcher 0.2.0 is available" &&
          notification?.body === "Faster switching and signed updater artifacts.",
      ),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Later" }).click();
  await expect(page.getByText("AI Switcher 0.2.0 is available")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Update and Restart" }),
  ).toHaveCount(0);
  await expect
    .poll(async () =>
      readLocalStorage(page, "ai-switch.desktop.update-dismissed-version"),
    )
    .toBe("0.2.0");
  await expect
    .poll(async () => expectCommandCount(page, "check_for_updates"))
    .toBeGreaterThan(0);
});

test("surfaces a newly available desktop update after dismissing an older version", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");

  await expect(page.getByText("AI Switcher 0.2.0 is available")).toBeVisible();
  await page.getByRole("button", { name: "Later" }).click();
  await expect(page.getByText("AI Switcher 0.2.0 is available")).toHaveCount(0);
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.update-dismissed-version"))
    .toBe("0.2.0");

  await overrideDesktopCommand(page, "check_for_updates", {
    result: {
      configured: true,
      channel: "beta",
      current_version: "0.1.11",
      endpoint: "https://updates.example.com/beta.json",
      update: {
        version: "0.3.0-beta.2",
        current_version: "0.1.11",
        target: "darwin-aarch64",
        notes: "Preview fixes for switching, diagnostics, and set routing.",
      },
      message: null,
    },
  });

  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Updates" }).click();
  await page.getByLabel("Update channel").selectOption("beta");

  await expect(page.getByText("AI Switcher 0.3.0-beta.2 is available")).toBeVisible();
  await expect(
    page.getByText("Preview fixes for switching, diagnostics, and set routing."),
  ).toBeVisible();
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.update-dismissed-version"))
    .toBeNull();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "AI Switcher 0.3.0-beta.2 is available" &&
          notification?.body ===
            "Preview fixes for switching, diagnostics, and set routing.",
      ),
    )
    .toBe(true);
});

test("uses fallback update copy and keeps a dismissed version hidden after relaunch", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", undefined, {
    preserveLocalStorageOnReload: true,
    updateCheckReport: {
      configured: true,
      channel: "stable",
      current_version: "0.1.11",
      endpoint: "https://updates.example.com/stable.json",
      update: {
        version: "0.2.1",
        current_version: "0.1.11",
        target: "darwin-aarch64",
        notes: null,
      },
      message: null,
    },
  });

  await page.goto("/");

  await expect(page.getByText("AI Switcher 0.2.1 is available")).toBeVisible();
  await expect(
    page.getByText(
      "New fixes and improvements are ready. Download the signed update and restart when prompted.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Later" }).click();

  await expect(page.getByText("AI Switcher 0.2.1 is available")).toHaveCount(0);
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.update-dismissed-version"))
    .toBe("0.2.1");

  await page.reload();

  await expect(page.getByText("AI Switcher 0.2.1 is available")).toHaveCount(0);
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.update-dismissed-version"))
    .toBe("0.2.1");
});

test("installs an available desktop update from the global banner", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByText("AI Switcher 0.2.0 is available")).toBeVisible();

  await page.getByRole("button", { name: "Update and Restart" }).click();

  await expect(page.getByText("Restart requested")).toBeVisible();
  await expect(page.getByText("Update installed. Restart has been requested.")).toBeVisible();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "AI Switcher updated" &&
          notification?.body === "Update installed. Restart has been requested.",
      ),
    )
    .toBe(true);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "check_for_updates")).toBe(true);
  expect(commandLog.some((entry) => entry.command === "install_update")).toBe(true);
});

test("dismisses the installed-update banner after a successful global update", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByText("AI Switcher 0.2.0 is available")).toBeVisible();

  await page.getByRole("button", { name: "Update and Restart" }).click();

  await expect(page.getByText("Restart requested")).toBeVisible();
  await expect(page.getByText("Update installed. Restart has been requested.")).toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();

  await expect(page.getByText("Restart requested")).toHaveCount(0);
  await expect(page.getByText("Update installed. Restart has been requested.")).toHaveCount(0);
  await expect(page.getByText("AI Switcher 0.2.0 is available")).toHaveCount(0);
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.update-dismissed-version"))
    .toBeNull();
});

test("surfaces update install remediation from the global banner", async ({ page }) => {
  await installDesktopMock(page, "updaterInstallError");

  await page.goto("/");
  await expect(page.getByText("AI Switcher 0.2.0 is available")).toBeVisible();

  await page.getByRole("button", { name: "Update and Restart" }).click();

  await expect(page.getByText("Update failed", { exact: true })).toBeVisible();
  await expect(page.getByText("Desktop update failed: signature mismatch")).toBeVisible();
  await expect(
    page.getByText(
      "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
    ),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "Update install failed" &&
          notification?.body?.includes("Desktop update failed: signature mismatch"),
      ),
    )
    .toBe(true);
});

test("keeps the profile inspector actions menu inside the visible pane", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  await page.locator(".profiles-table-row-button").first().click();
  const inspector = page.locator(".profiles-inspector");
  await expect(inspector.getByRole("heading", { name: /Work/i })).toBeVisible();
  await inspector.getByRole("button", { name: "More profile actions" }).click();

  const menu = page.getByRole("menu", { name: "Profile actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Rename…" })).toBeVisible();
  await expectMenuToFitWithin(menu, inspector);
});

test("filters the profile inventory by tool segment and search query", async ({ page }) => {
  await installDesktopMock(page, "switching", undefined, {
    settings: {
      profile_labels: {
        claude: {
          work: "Office",
        },
        codex: {
          work: "Code Work",
        },
      },
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();

  await expect(page.locator(".profiles-table-row-button").filter({ hasText: "Office" })).toBeVisible();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "Code Work" }),
  ).toBeVisible();

  await page.getByLabel("Profile filters").getByRole("button", { name: "Codex" }).click();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "Code Work" }),
  ).toBeVisible();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "Office" }),
  ).toHaveCount(0);

  await page.getByRole("searchbox", { name: "Search Profiles" }).fill("office");
  await expect(page.getByRole("heading", { name: "No matching profiles" })).toBeVisible();

  await page.getByRole("button", { name: "Clear Search Profiles" }).click();
  await expect(page.getByRole("searchbox", { name: "Search Profiles" })).toHaveValue("");
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "Code Work" }),
  ).toBeVisible();
});

test("warns before adding a duplicate profile name from the profiles screen", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByRole("button", { name: "Add Profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Tool").selectOption("claude");
  await addDialog.getByLabel("Profile name").fill("work");

  await expect(
    addDialog.getByText(
      "Claude already has a profile named work. Choose a different name or rename the existing profile first.",
    ),
  ).toBeVisible();
  await expect(addDialog.getByRole("button", { name: "Import" })).toBeDisabled();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "add_profile")).toBe(false);
});

test("surfaces duplicate profile save failures from the profiles screen", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await overrideDesktopCommand(page, "add_profile", {
    error: { message: "duplicate profile" },
  });
  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByRole("button", { name: "Add Profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Tool").selectOption("claude");
  await addDialog.getByLabel("Profile name").fill("ops");
  await addDialog.getByRole("button", { name: "Import" }).click();

  await expect(addDialog.getByText("duplicate profile")).toBeVisible();
});

test("shows keyring remediation when profile import fails from the profiles screen", async ({
  page,
}) => {
  await installDesktopMock(page, "profileCommandError");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByRole("button", { name: "Add Profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Profile name").fill("ops");
  await addDialog.getByRole("button", { name: "Import" }).click();

  await expect(
    addDialog.getByText(
      "keyring unavailable Remediation: Unlock the local credential store and retry.",
    ),
  ).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "add_profile")).toBe(true);
});

test("shows interactive-session remediation when live import is unavailable", async ({
  page,
}) => {
  await installDesktopMock(page, "nonInteractiveProfile");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByRole("button", { name: "Add Profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Profile name").fill("ops");
  await addDialog.getByRole("button", { name: "Import" }).click();

  await expect(
    addDialog.getByText(
      "interactive login required Remediation: Rerun this flow in an interactive session or use a supported non-interactive import method.",
    ),
  ).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "add_profile")).toBe(true);
});

test("limits antigravity profile setup to live auth flows and fixed state mode", async ({
  page,
}) => {
  await installDesktopMock(
    page,
    "switching",
    {
      claude: { state_modes: ["isolated", "shared"] },
      codex: { state_modes: ["isolated", "shared"] },
      gemini: { state_modes: [] },
      agy: {
        auth_methods: ["oauth", "from_live"],
        state_modes: [],
        credential_backends: ["system_keyring", "file"],
        fail_closed_keyring_identity: false,
      },
    },
    {
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
          {
            tool: "antigravity",
            binary_found: true,
            stored_profiles: 1,
            active_profile: "work",
            auth_method: "oauth",
            credential_backend: "system_keyring",
            state_mode: null,
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
          antigravity: {
            active: "work",
            profiles: [{ name: "work", auth: "oauth", label: "Work" }],
          },
        },
        contexts: [],
      },
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByRole("button", { name: "Add Profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Tool").selectOption("antigravity");

  const importMode = addDialog.getByLabel("Import mode");
  await expect(importMode).toHaveValue("from_live");
  await expect(importMode.getByRole("option", { name: "Import current login" })).toHaveCount(1);
  await expect(importMode.getByRole("option", { name: "Sign in with OAuth" })).toHaveCount(1);
  await expect(importMode.getByRole("option", { name: "Read from environment" })).toHaveCount(0);
  await expect(importMode.getByRole("option", { name: "Paste API key" })).toHaveCount(0);
  await expect(addDialog.getByText("Managed by tool")).toBeVisible();
  await expect(
    addDialog.getByText("Antigravity CLI keeps authentication and local state together."),
  ).toBeVisible();

  await addDialog.getByLabel("Profile name").fill("field");
  await addDialog.getByRole("button", { name: "Import" }).click();

  await expect(addDialog).toBeHidden();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "Field" }).first(),
  ).toBeVisible();

  const afterImportLog = await readCommandLog(page);
  expect(
    afterImportLog.some(
      (entry) =>
        entry.command === "add_profile" &&
        entry.args?.request?.tool === "antigravity" &&
        entry.args?.request?.state_mode === null,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Inspect Antigravity" }).click();
  await page.getByLabel("Switch antigravity profile").selectOption("work");
  await page.getByRole("button", { name: "Switch to Work" }).click();

  await expect(
    page.locator(".overview-tool-list-row").filter({ hasText: "Antigravity" }).first(),
  ).toContainText("Work");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "antigravity" &&
        entry.args?.request?.profile === "work" &&
        entry.args?.request?.state_mode === null,
    ),
  ).toBe(true);
});

test("keeps the backups inspector actions menu inside the visible pane", async ({ page }) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  await page.locator(".backups-table-row").first().click();
  const inspector = page.locator(".backups-inspector-surface");
  await expect(inspector.getByRole("button", { name: "Restore…" })).toBeVisible();
  await inspector.getByRole("button", { name: "Backup actions" }).click();

  const menu = page.getByRole("menu", { name: "Backup actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Open Profile" })).toBeVisible();
  await expectMenuToFitWithin(menu, inspector);
});

test("opens the matching profile details from backup actions", async ({ page }) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  await page.locator(".backups-table-row").filter({ hasText: "Work" }).first().click();
  await page.getByRole("button", { name: "Backup actions" }).click();
  await page.getByRole("menuitem", { name: "Open Profile" }).click();

  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Claude", pressed: true }),
  ).toBeVisible();
  await expect(page.locator(".profiles-inspector")).toContainText("Work");
  await expect(page.getByRole("button", { name: "Storage Details" })).toBeVisible();
});

test("opens backups from the selected profile menu without restoring or activating", async ({
  page,
}) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("option", { name: "Inspect Claude Code Work" }).click();

  await page.locator(".profiles-inspector").getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "View Backups" }).click();

  await expect(page.getByRole("heading", { name: "Backups" })).toBeVisible();
  await expect(page.getByLabel("Backups list")).toContainText("Work");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "restore_backup")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "use_profile")).toBe(false);
});

test("opens backups from a profile row actions menu without restoring or activating", async ({
  page,
}) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("button", { name: "More actions for Claude Code Work" }).click();
  const menu = page.getByRole("menu", { name: "Profile actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "View Backups" })).toBeVisible();
  await expectMenuToFitViewport(menu, page);
  await menu.getByRole("menuitem", { name: "View Backups" }).click();

  await expect(page.getByRole("heading", { name: "Backups" })).toBeVisible();
  await expect(page.getByLabel("Backups list")).toContainText("Work");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "restore_backup")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "use_profile")).toBe(false);
});

test("uses an overlay sidebar on narrow widths", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.setViewportSize({ width: 760, height: 920 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Show sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Show sidebar" }).click();
  await expect(page.getByRole("button", { name: "Close sidebar" })).toBeVisible();
  await expect(page.locator(".sidebar")).toBeVisible();

  await page.getByRole("button", { name: "Close sidebar" }).click();
  await expect(page.locator(".sidebar")).toHaveCount(0);
});

test("uses a one-pane detail flow for profiles on narrow widths", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.setViewportSize({ width: 760, height: 920 });
  await page.goto("/");

  await page.getByRole("button", { name: "Show sidebar" }).click();
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await expect(page.getByLabel("Profile table")).toBeVisible();

  await page.getByRole("option", { name: "Inspect Claude Code Work" }).click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(page.getByLabel("Profile table")).toHaveCount(0);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Profile table")).toBeVisible();
});

test("uses a one-pane detail flow for sets on narrow widths", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.setViewportSize({ width: 760, height: 920 });
  await page.goto("/");

  await page.getByRole("button", { name: "Show sidebar" }).click();
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await expect(page.getByLabel("Set Library")).toBeVisible();

  await page.getByRole("button", { name: "Inspect set Client Acme" }).click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(page.getByLabel("Set Library")).toHaveCount(0);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Set Library")).toBeVisible();
});

test("uses a one-pane detail flow for backups on narrow widths", async ({ page }) => {
  await installDesktopMock(page, "backupCatalog");

  await page.setViewportSize({ width: 760, height: 920 });
  await page.goto("/");

  await page.getByRole("button", { name: "Show sidebar" }).click();
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  await expect(page.getByLabel("Backups list")).toBeVisible();

  await page.locator(".backups-table-row").first().click();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByLabel("Backups list")).toHaveCount(0);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Backups list")).toBeVisible();
});

test("uses a one-pane detail flow for diagnostics on narrow widths", async ({ page }) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.setViewportSize({ width: 760, height: 920 });
  await page.goto("/");

  await page.getByRole("button", { name: "Show sidebar" }).click();
  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  await expect(page.getByLabel("Diagnostics findings")).toBeVisible();

  await page
    .getByLabel("Diagnostics findings")
    .getByRole("button")
    .first()
    .click();

  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByLabel("Diagnostics findings")).toHaveCount(0);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Diagnostics findings")).toBeVisible();
});

test("uses the settings mobile section picker on narrow widths", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.setViewportSize({ width: 760, height: 920 });
  await page.goto("/");

  await page.getByRole("button", { name: "Show sidebar" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  const sectionPicker = page.getByLabel("Settings section", { exact: true });
  await expect(sectionPicker).toBeVisible();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await expect(page.getByText("Show menu bar icon")).toBeVisible();

  await sectionPicker.selectOption("updates");
  await expect(page.getByRole("heading", { name: "Updates" })).toBeVisible();
  await expect(page.getByText("Current version")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check for Updates" })).toBeVisible();

  await sectionPicker.selectOption("shell");
  await expect(page.locator(".settings-section-header")).toContainText("Terminal Integration");
  await expect(page.getByText("Detected shell")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Install" })).toBeVisible();
});

test("switches to a saved set from quick switch and updates the overview", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await dialog.getByLabel("Search Quick Switch").fill("client acme");
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  await expect(page.locator(".overview-set-row")).toContainText("Client Acme");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "activate_profile_set" &&
        entry.args?.name === "client-acme",
    ),
  ).toBe(true);
});

test("switches all matching tools from quick switch", async ({ page }) => {
  await installDesktopMock(page, "updaterError");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await dialog.getByLabel("Search Quick Switch").fill("work");
  await dialog.getByRole("option").filter({ hasText: "Across Claude Code, Codex CLI" }).first().click();

  await expect(dialog).toBeHidden();
  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "use_all_profiles")).toBe(true);
});

test("refreshes overview state after a successful tray profile switch", async ({ page }) => {
  await installDesktopMock(page, "trayRefresh");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "tool",
    tool: "claude",
    label: "Switch profile",
    status: "success",
    message: "Switched claude to personal.",
  });

  await expect(page.getByText("Last result: Switched claude to personal.")).toBeVisible();
  await expect(page.getByText("Active profile: Personal")).toBeVisible();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "Switch profile" &&
          notification?.body === "Switched claude to personal.",
      ),
    )
    .toBe(true);
});

test("records tray command results and shows a desktop notification", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "tool",
    tool: "claude",
    label: "Switch profile",
    status: "success",
    message: "Switched claude to work.",
  });

  await expect(page.getByText("Last result: Switched claude to work.")).toBeVisible();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "Switch profile" &&
          notification?.body === "Switched claude to work.",
      ),
    )
    .toBe(true);
});

test("surfaces token warnings in overview cards", async ({ page }) => {
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

test("refreshes overview state after a failed shared switch to show the rolled-back profile", async ({
  page,
}) => {
  await installDesktopMock(page, "failedBulkSwitch");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await dialog.getByLabel("Search Quick Switch").fill("work");
  await dialog.getByRole("option").filter({ hasText: "Across Claude Code, Codex CLI" }).first().click();

  await expect(page.getByText("Active profile: Personal")).toBeVisible();
  await expect(page.getByText("Last set result: switch failed")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "use_all_profiles")).toBe(true);
});

test("records tray context failures with remediation and shows a desktop notification", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "global",
    id: "context",
    label: "Use set",
    status: "error",
    message: "Set switch failed.",
    remediation: "Re-open AI Switch and verify the saved set.",
  });

  await expect(
    page.getByText(
      "Last set result: Set switch failed. Remediation: Re-open AI Switch and verify the saved set.",
    ),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "Use set" &&
          notification?.body === "Set switch failed. Re-open AI Switch and verify the saved set.",
      ),
    )
    .toBe(true);
});

test("refreshes workspace status after a tray context switch", async ({ page }) => {
  await installDesktopMock(page, "trayWorkspaceRefresh");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await expect(page.getByText("Project mismatch")).toBeVisible();

  await page.evaluate(() => {
    (
      window as typeof window & {
        __AISW_DESKTOP_SCENARIO_STATE__?: { trayContextApplied?: boolean };
      }
    ).__AISW_DESKTOP_SCENARIO_STATE__!.trayContextApplied = true;
  });
  const workspaceReadsBefore = await expectCommandCount(page, "get_workspace_status");
  const bindingReadsBefore = await expectCommandCount(page, "get_project_bindings");

  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "global",
    id: "context",
    label: "Use set",
    status: "success",
    message: "Activated set client-acme.",
  });

  await expect
    .poll(async () => ({
      workspaceReads: await expectCommandCount(page, "get_workspace_status"),
      bindingReads: await expectCommandCount(page, "get_project_bindings"),
    }))
    .toEqual({
      workspaceReads: workspaceReadsBefore + 1,
      bindingReads: bindingReadsBefore + 1,
    });
  await expect(page.getByText("Project mismatch")).toHaveCount(0);
  await page.locator(".sets-rule-table-row").filter({ hasText: "/code/acme" }).first().click();
  await expect(page.locator(".sets-rules-inspector")).toContainText("Current project");
});

test("classifies tray profile failures in diagnostics", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "tool",
    tool: "claude",
    label: "Switch profile",
    status: "error",
    kind: "ProfileMissing",
    message: "profile work no longer exists",
    remediation: "Refresh profile state or recreate the missing profile before retrying.",
  });

  await page.getByRole("button", { name: "Diagnostics" }).click();

  await expect(page.getByRole("heading", { name: "Claude Code profile missing" })).toBeVisible();
  await expect(page.getByText("profile work no longer exists").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Re-apply Work" })).toBeVisible();
});

test("surfaces failed profile switches in diagnostics and routes back into profile details", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await overrideDesktopCommand(page, "use_profile", {
    error: {
      kind: "ConfigLockTimeout",
      message: "config lock is busy",
      remediation:
        "Close other AI Switch windows or wait for the local config lock to clear, then retry.",
    },
  });
  await page.getByRole("button", { name: "Inspect Codex" }).click();
  await page.getByLabel("Switch codex profile").selectOption("work");
  await page.getByRole("button", { name: "Switch to Work" }).click();

  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "use_profile" &&
          entry.args?.request?.tool === "codex" &&
          entry.args?.request?.profile === "work",
      ),
    )
    .toBe(true);
  await expect(page.locator(".overview-inspector-pane")).toContainText("config lock is busy");
  await expect(page.locator(".overview-inspector-pane")).toContainText(
    "Close other AI Switch windows or wait for the local config lock to clear, then retry.",
  );

  await page.getByRole("button", { name: "Diagnostics" }).click();
  await expect(page.getByText("Config lock timeout").first()).toBeVisible();
  await expect(page.getByText("config lock is busy").first()).toBeVisible();
  await expect(
    page.getByText(
      "Close other AI Switch windows or wait for the local config lock to clear, then retry.",
    ).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Inspect Config lock timeout" }).click();
  await page.getByRole("button", { name: "Open Profile Details" }).click();

  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Codex" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".profiles-inspector")).toContainText("Personal");
  await expect(page.getByRole("button", { name: "Storage Details" })).toBeVisible();
});

test("re-applies the active shared profile from the app menu", async ({ page }) => {
  await installDesktopMock(page, "updaterError");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-reapply-active-profile");

  await expect
    .poll(async () =>
      (await readCommandLog(page)).some((entry) => entry.command === "use_all_profiles"),
    )
    .toBe(true);
  await expect(page.getByText(/Last set result: Re-applied shared profile/i)).toBeVisible();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "Re-apply active profile" &&
          notification?.body?.includes("Re-applied shared profile"),
      ),
    )
    .toBe(true);
});

test("switches a profile from overview and opens the matching profile details", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Codex" }).click();
  await page.getByLabel("Switch codex profile").selectOption("work");
  await page.getByRole("button", { name: "Switch to Work" }).click();

  await expect(
    page.locator(".overview-tool-list-row").filter({ hasText: "Codex" }).first(),
  ).toContainText("Work");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "work",
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Open Profile" }).click();
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Codex" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".profiles-inspector-pane")).toContainText("Work");
});

test("clears routed profile details when reopening profiles from the sidebar", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Codex" }).click();
  await page.getByRole("button", { name: "Open Profile" }).click();

  const profileFilters = page.getByLabel("Profile filters");
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(profileFilters.getByRole("button", { name: "Codex", pressed: true })).toBeVisible();
  await expect(page.locator(".profiles-inspector-pane")).toContainText("Personal");

  await page.locator(".sidebar").getByRole("button", { name: "Overview", exact: true }).click();
  await page.locator(".sidebar").getByRole("button", { name: "Profiles", exact: true }).click();

  await expect(profileFilters.getByRole("button", { name: "All", pressed: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Work" })).toBeVisible();
});

test("clears route-opened profile details when switching tools manually", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", undefined, {
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
          warnings: [],
        },
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
      contexts: [],
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Codex" }).click();
  await page.getByRole("button", { name: "Open Profile" }).click();

  const profileFilters = page.getByLabel("Profile filters");
  const inspectorPane = page.locator(".profiles-inspector-pane");

  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(profileFilters.getByRole("button", { name: "Codex", pressed: true })).toBeVisible();
  await expect(inspectorPane).toContainText("Personal");
  await expect(inspectorPane).toContainText("Authentication");
  await expect(inspectorPane).toContainText("API Key");

  await profileFilters.getByRole("button", { name: "Claude" }).click();

  await expect(profileFilters.getByRole("button", { name: "Claude", pressed: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal" })).toBeVisible();
  await expect(inspectorPane).not.toContainText("API Key");
});

test("shows the last successful overview switch result on the active tool card", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.locator(".overview-tool-list-row").filter({ hasText: "Codex" }).first().click();
  await page.getByLabel("Switch codex profile").selectOption("work");
  await page.getByRole("button", { name: "Switch to Work" }).click();

  await expect(
    page.locator(".overview-tool-list-row").filter({ hasText: "Codex" }).first(),
  ).toContainText("Work");
  await expect(
    page.getByText("Last result: Switched Codex CLI to Work."),
  ).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "work",
      ),
  ).toBe(true);
});

test("resolves a workspace mismatch directly from overview actions", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext");

  await page.goto("/");
  await expect(page.getByText("Expected set: client-acme")).toBeVisible();

  await page.getByRole("button", { name: "Inspect Claude" }).click();
  await page.getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "Use Expected Set" }).click();

  await expect(page.getByText("Expected set: client-acme")).toHaveCount(0);
  await expect(page.locator(".overview-status-strip")).toContainText("Ready to switch");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_context" &&
        entry.args?.request?.context === "client-acme",
      ),
  ).toBe(true);
});

test("routes unresolved workspace mismatch from overview into sets", async ({ page }) => {
  await installDesktopMock(page, "staleWorkspaceTarget");

  await page.goto("/");
  await expect(page.getByText("Expected set: client-acme")).toBeVisible();

  await page.getByRole("button", { name: "Inspect Claude" }).click();
  await page.getByRole("button", { name: "More profile actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Open Sets" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Open Sets" }).click();

  await expect(page.getByRole("heading", { name: "Sets", exact: true })).toBeVisible();
  await expect(page.getByLabel("Set Library")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "use_context")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "activate_profile_set")).toBe(false);
});

test("opens installation help and refreshes a missing tool from overview", async ({ page }) => {
  await installDesktopMock(page, "missingTool");

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Gemini" }).click();

  await expect(page.getByText("Gemini CLI is not installed on this Mac.")).toBeVisible();

  await page.getByRole("button", { name: "Installation Help" }).click();
  await expect.poll(async () => readOpenedGuides(page)).toContain(
    "https://www.npmjs.com/package/@google/gemini-cli",
  );

  const snapshotReadsBefore = await expectCommandCount(page, "get_snapshot");
  await page.getByRole("button", { name: "Refresh" }).click();

  await expect
    .poll(async () => await expectCommandCount(page, "get_snapshot"))
    .toBe(snapshotReadsBefore + 1);
});

test("keeps the overview actions menu inside the inspector and routes current-login import", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", {
    claude: {
      auth_methods: ["from_live", "oauth"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["system-keyring", "file"],
    },
    codex: { state_modes: ["isolated", "shared"] },
    gemini: { state_modes: [] },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Claude" }).click();

  const inspector = page.locator(".overview-inspector-pane");
  await inspector.getByRole("button", { name: "More profile actions" }).click();

  const menu = page.getByRole("menu", { name: "Overview actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Import Current…" })).toBeVisible();
  await expectMenuToFitWithin(menu, inspector);

  await menu.getByRole("menuitem", { name: "Import Current…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tool")).toHaveValue("claude");
  await expect(dialog.getByLabel("Import mode")).toHaveValue("from_live");
});

test("starts current-login import from the overview inspector when live credentials mismatch", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", {
    claude: {
      auth_methods: ["from_live", "oauth"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["system-keyring", "file"],
    },
    codex: { state_modes: ["isolated", "shared"] },
    gemini: { state_modes: [] },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Claude" }).click();
  await expect(page.getByText("Live credentials do not match Work.")).toBeVisible();

  await page.getByRole("button", { name: "Import Current…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tool")).toHaveValue("claude");
  await expect(dialog.getByLabel("Import mode")).toHaveValue("from_live");
});

test("opens account setup from overview when live import is unsupported for the selected tool", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", {
    claude: {
      auth_methods: ["from_env", "api_key"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["file"],
    },
    codex: { state_modes: ["isolated", "shared"] },
    gemini: { state_modes: [] },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Claude" }).click();
  await expect(page.getByText("Live credentials do not match Work.")).toBeVisible();

  await expect(page.getByRole("button", { name: "Open Account Setup" })).toBeVisible();
  await page.getByRole("button", { name: "Open Account Setup" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Profile" });
  const importMode = dialog.getByLabel("Import mode");
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Claude", pressed: true }),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tool")).toHaveValue("claude");
  await expect(importMode).toHaveValue("from_env");
  await expect(importMode.getByRole("option", { name: "Import current login" })).toHaveCount(0);
});

test("opens activity from the overview footer after a switch result is recorded", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Inspect Codex" }).click();
  await page.getByLabel("Switch codex profile").selectOption("work");
  await page.getByRole("button", { name: "Switch to Work" }).click();

  await expect(page.getByText("Last result: Switched Codex CLI to Work.")).toBeVisible();
  await page.getByRole("button", { name: "View Activity" }).click();

  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Switch profile" })).toBeVisible();
  await expect(page.getByText("Switched Codex CLI to Work.")).toBeVisible();
});

test("supports arrow-key navigation in the profiles inventory", async ({ page }) => {
  await installDesktopMock(page, "switching", undefined, {
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
          warnings: [],
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
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  const profilesList = page.getByRole("listbox", { name: "Profiles" });
  const workRow = page.getByRole("option", { name: "Inspect Claude Code Work" });
  const codexRow = page.getByRole("option", { name: "Inspect Codex CLI Work" });

  await expect(profilesList).toBeVisible();

  await workRow.focus();
  await workRow.press("ArrowDown");

  await expect(codexRow).toHaveAttribute("aria-selected", "true");
  await expect(codexRow).toBeFocused();
  await expect(workRow).toHaveAttribute("aria-selected", "false");
  await expect(page.getByRole("heading", { name: "Work" })).toBeVisible();
});

test("uses saved profile labels in overview switch results", async ({ page }) => {
  await installDesktopMock(page, "switching", undefined, {
    settings: {
      profile_labels: {
        codex: {
          work: "Code Work",
        },
      },
    },
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.locator(".overview-tool-list-row").filter({ hasText: "Codex" }).first().click();
  await page.getByLabel("Switch codex profile").selectOption("work");
  await page.getByRole("button", { name: "Switch to Code Work" }).click();

  await expect(
    page.locator(".overview-tool-list-row").filter({ hasText: "Codex" }).first(),
  ).toContainText("Code Work");
  await expect(
    page.getByText("Last result: Switched Codex CLI to Code Work."),
  ).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "work",
    ),
  ).toBe(true);
});

test("adds, renames, activates, and removes a profile from the profiles screen", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByRole("button", { name: "Add Profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Tool").selectOption("codex");
  await addDialog.getByLabel("Profile name").fill("ci");
  await addDialog.getByLabel("Import mode").selectOption("from_env");
  await addDialog.getByLabel("Credential backend").selectOption("system-keyring");
  await expect(addDialog.getByText("OPENAI_API_KEY", { exact: true })).toBeVisible();
  await addDialog.getByRole("button", { name: "Save Profile" }).click();

  await expect(addDialog).toBeHidden();
  const ciRow = page.locator(".profiles-table-row-button").filter({ hasText: "ci" }).first();
  await expect(ciRow).toBeVisible();

  await ciRow.click();
  await expect(page.locator(".profiles-inspector")).toContainText("Codex CLI");
  await page.locator(".profiles-inspector").getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.getByLabel("rename ci").fill("release-ci");
  await page.getByRole("button", { name: "Save" }).click();

  const renamedRow = page.locator(".profiles-table-row-button").filter({ hasText: "release-ci" }).first();
  await expect(renamedRow).toBeVisible();
  await page.getByLabel("Profile filters").getByRole("button", { name: "Codex" }).click();
  await page.locator(".profiles-table-row-button").filter({ hasText: "Work" }).first().click();
  await page.getByRole("button", { name: "Activate Profile" }).click();
  await expect(page.locator(".profiles-inspector")).toContainText("Active");

  await renamedRow.click();

  await page.locator(".profiles-inspector").getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  const removeDialog = page.getByRole("dialog", { name: "Remove Profile" });
  await removeDialog.getByRole("button", { name: "Remove Profile" }).click();
  await expect(removeDialog).toBeHidden();

  await expect(page.locator(".profiles-table-row-button").filter({ hasText: "release-ci" })).toHaveCount(0);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "add_profile")).toBe(true);
  expect(commandLog.some((entry) => entry.command === "rename_profile")).toBe(true);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "work",
    ),
  ).toBe(true);
  expect(commandLog.some((entry) => entry.command === "remove_profile")).toBe(true);
});

test("closes add profile without saving a draft", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByRole("button", { name: "Add Profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(addDialog).toBeVisible();
  await addDialog.getByLabel("Tool").selectOption("codex");
  await addDialog.getByLabel("Profile name").fill("draft-ci");
  await addDialog.getByLabel("Import mode").selectOption("from_env");
  await addDialog.getByLabel("Credential backend").selectOption("system-keyring");
  await expect(addDialog.getByText("OPENAI_API_KEY", { exact: true })).toBeVisible();
  await addDialog.getByRole("button", { name: "Cancel" }).click();

  await expect(addDialog).toBeHidden();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "draft-ci" }),
  ).toHaveCount(0);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "add_profile")).toBe(false);
});

test("closes profile removal without deleting the saved profile", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByLabel("Profile filters").getByRole("button", { name: "Codex" }).click();

  const personalRow = page
    .locator(".profiles-table-row-button")
    .filter({ hasText: "Personal" })
    .first();
  await personalRow.click();
  await expect(page.locator(".profiles-inspector")).toContainText("Personal");

  await page.locator(".profiles-inspector").getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();

  const removeDialog = page.getByRole("dialog", { name: "Remove Profile" });
  await expect(removeDialog).toBeVisible();
  await removeDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(removeDialog).toBeHidden();

  await expect(personalRow).toBeVisible();
  await expect(page.locator(".profiles-inspector")).toContainText("Personal");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "remove_profile")).toBe(false);
});

test("adds a profile from a pasted API key on the profiles screen", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("button", { name: "Add Profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Tool").selectOption("codex");
  await addDialog.getByLabel("Profile name").fill("ops");
  await addDialog.getByLabel("Import mode").selectOption("api_key");
  await addDialog.getByLabel("Credential backend").selectOption("file");
  await addDialog.getByLabel("API key").fill("sk-live-secret");
  await addDialog.getByRole("button", { name: "Save Profile" }).click();

  await expect(addDialog).toBeHidden();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "ops" }).first(),
  ).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "add_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "ops" &&
        entry.args?.request?.credential_backend === "file" &&
        entry.args?.request?.import_mode?.kind === "api_key" &&
        entry.args?.request?.import_mode?.value === "sk-live-secret",
    ),
  ).toBe(true);
});

test("captures a profile from environment variables with the expected env hint", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("button", { name: "Add Profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Tool").selectOption("codex");
  await addDialog.getByLabel("Profile name").fill("ci");
  await addDialog.getByLabel("Import mode").selectOption("from_env");
  await addDialog.getByLabel("Credential backend").selectOption("system-keyring");
  await expect(addDialog.getByText("OPENAI_API_KEY", { exact: true })).toBeVisible();

  await addDialog.getByRole("button", { name: "Save Profile" }).click();

  await expect(addDialog).toBeHidden();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "ci" }).first(),
  ).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "add_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "ci" &&
        entry.args?.request?.state_mode === "isolated" &&
        entry.args?.request?.credential_backend === "system-keyring" &&
        entry.args?.request?.import_mode?.kind === "from_env",
    ),
  ).toBe(true);
});

test("stores a relabel override for an existing profile", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.evaluate(() => {
    const currentMock = (
      window as typeof window & {
        __AISW_DESKTOP_MOCK__?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        __AISW_COMMAND_LOG__?: Array<{ command: string; args?: Record<string, unknown> | null }>;
        __AISW_DESKTOP_SCENARIO_STATE__?: {
          bootstrap?: { settings?: Record<string, unknown> };
          settings?: Record<string, unknown>;
        };
      }
    ).__AISW_DESKTOP_MOCK__;
    if (!currentMock) {
      return;
    }

    (
      window as typeof window & {
        __AISW_DESKTOP_MOCK__?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        __AISW_COMMAND_LOG__?: Array<{ command: string; args?: Record<string, unknown> | null }>;
        __AISW_DESKTOP_SCENARIO_STATE__?: {
          bootstrap?: { settings?: Record<string, unknown> };
          settings?: Record<string, unknown>;
        };
      }
    ).__AISW_DESKTOP_MOCK__ = async (command, args) => {
      if (command === "update_settings") {
        const request = structuredClone(args?.request ?? {});
        const state = (
          window as typeof window & {
            __AISW_DESKTOP_SCENARIO_STATE__?: {
              bootstrap?: { settings?: Record<string, unknown> };
              settings?: Record<string, unknown>;
            };
          }
        ).__AISW_DESKTOP_SCENARIO_STATE__;
        if (state?.bootstrap) {
          state.bootstrap.settings = request as Record<string, unknown>;
        }
        if (state) {
          state.settings = request as Record<string, unknown>;
        }
        (
          window as typeof window & {
            __AISW_COMMAND_LOG__?: Array<{ command: string; args?: Record<string, unknown> | null }>;
          }
        ).__AISW_COMMAND_LOG__?.push({ command, args: args ?? null });
        return request;
      }

      return currentMock(command, args);
    };
  });
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("option", { name: "Inspect Claude Code Work" }).click();

  await page.locator(".profiles-inspector").getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "Change Label…" }).click();
  await page.getByLabel("label work").fill("Acme Work");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.locator(".profiles-inspector")).toContainText("Acme Work");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "update_settings" &&
        entry.args?.request?.profile_labels?.claude?.work === "Acme Work",
    ),
  ).toBe(true);
});

test("derives add-profile modes and fixed file storage from runtime capabilities", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", {
    claude: {
      auth_methods: ["from_env", "api_key"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["file"],
      fail_closed_keyring_identity: false,
    },
    codex: {
      auth_methods: ["from_live", "oauth"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["system-keyring", "file"],
    },
    gemini: { state_modes: [] },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("button", { name: "Add Profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Tool").selectOption("claude");

  const importMode = addDialog.getByLabel("Import mode");
  await expect(importMode.getByRole("option", { name: "Read from environment" })).toHaveCount(1);
  await expect(importMode.getByRole("option", { name: "Paste API key" })).toHaveCount(1);
  await expect(importMode.getByRole("option", { name: "Import current login" })).toHaveCount(0);
  await expect(importMode.getByRole("option", { name: "Sign in with OAuth" })).toHaveCount(0);

  const backend = addDialog.getByLabel("Credential backend");
  await expect(backend).toBeDisabled();
  await expect(backend).toHaveValue("file");
  await expect(
    addDialog.getByText("Claude profiles are always stored with file-backed credentials."),
  ).toBeVisible();
});

test("falls back to legacy profile setup options when capability metadata is absent", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", undefined, {
    runtime_status: {
      capabilities: null,
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("button", { name: "Add Profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await addDialog.getByLabel("Tool").selectOption("codex");

  const importMode = addDialog.getByLabel("Import mode");
  await expect(importMode.getByRole("option", { name: "Import current login" })).toHaveCount(1);
  await expect(importMode.getByRole("option", { name: "Read from environment" })).toHaveCount(1);
  await expect(importMode.getByRole("option", { name: "Paste API key" })).toHaveCount(1);
  await expect(importMode.getByRole("option", { name: "Sign in with OAuth" })).toHaveCount(1);

  const backend = addDialog.getByLabel("Credential backend");
  await expect(backend).toBeEnabled();
  await expect(backend.getByRole("option", { name: "Automatic" })).toHaveCount(1);
  await expect(backend.getByRole("option", { name: "System keyring" })).toHaveCount(1);
  await expect(backend.getByRole("option", { name: "File-backed" })).toHaveCount(1);
});

test("focuses the rename field when rename is chosen from the profile inspector menu", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("option", { name: "Inspect Claude Code Work" }).click();

  await page.locator(".profiles-inspector").getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();

  await expect(page.getByLabel("rename work")).toBeFocused();
});

test("closes profile rename without saving changes", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles", exact: true }).click();

  const workRow = page.locator(".profiles-table-row-button").filter({ hasText: "Work" }).first();
  await workRow.click();
  await page.locator(".profiles-inspector").getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();

  const renameDialog = page.getByRole("dialog", { name: "Edit Profile" });
  await expect(renameDialog).toBeVisible();
  await renameDialog.getByLabel("rename work").fill("draft-work");
  await renameDialog.getByLabel("label work").fill("Draft Work");
  await renameDialog.getByRole("button", { name: "Cancel" }).click();

  await expect(renameDialog).toBeHidden();
  await expect(workRow).toBeVisible();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "draft-work" }),
  ).toHaveCount(0);
  await expect(page.locator(".profiles-inspector")).toContainText("Work");
  await expect(page.locator(".profiles-inspector")).not.toContainText("Draft Work");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "rename_profile")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "update_settings")).toBe(false);
});

test("warns before renaming a profile to a duplicate name", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  const workRow = page.locator(".profiles-table-row-button").filter({ hasText: "Work" }).first();
  await workRow.click();
  await page.locator(".profiles-inspector").getByRole("button", { name: "More profile actions" }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();

  const renameDialog = page.getByRole("dialog", { name: "Edit Profile" });
  await renameDialog.getByLabel("rename work").fill("PERSONAL");

  await expect(
    renameDialog.getByText(
      "Claude already has a profile named PERSONAL. Choose a different name or rename the existing profile first.",
    ),
  ).toBeVisible();
  await expect(renameDialog.getByRole("button", { name: "Save" })).toBeDisabled();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "rename_profile")).toBe(false);
});

test("uses saved labels in the profiles inspector header", async ({ page }) => {
  await installDesktopMock(page, "switching", undefined, {
    settings: {
      profile_labels: {
        claude: {
          work: "Office",
        },
      },
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  await expect(page.getByRole("heading", { name: "Office" })).toBeVisible();
  await expect(page.locator(".profiles-inspector")).toContainText("Saved as work");
  await expect(page.locator(".profiles-table-row-button").filter({ hasText: "work" }).first()).toBeVisible();
});

test("uses the newest matching backup timestamp in the profiles inspector", async ({ page }) => {
  await installDesktopMock(page, "profileLatestBackup");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  const expectedNewestAdded = await page.evaluate(() =>
    new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date("2026-03-27T12:15:00Z")),
  );
  const expectedOlderAdded = await page.evaluate(() =>
    new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date("2026-03-25T11:45:02Z")),
  );

  await expect(page.locator(".profiles-inspector")).toContainText("Added");
  await expect(page.locator(".profiles-inspector")).toContainText(expectedNewestAdded);
  await expect(page.locator(".profiles-inspector")).not.toContainText(expectedOlderAdded);
});

test("uses the selected state mode when activating from profiles", async ({ page }) => {
  await installDesktopMock(page, "matchingContextSet");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByLabel("Profile filters").getByRole("button", { name: "Codex" }).click();

  const workRow = page.locator(".profiles-table-row-button").filter({ hasText: "Work" }).first();
  await workRow.click();
  await page.getByRole("button", { name: "Shared" }).click();
  await page.getByRole("button", { name: "Activate Profile" }).click();

  await expect(page.locator(".profiles-inspector")).toContainText("Active");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "work" &&
        entry.args?.request?.state_mode === "shared",
    ),
  ).toBe(true);
});

test("keeps inactive profile storage details separate from live runtime warnings", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();
  await page.getByLabel("Profile filters").getByRole("button", { name: "Codex" }).click();

  const workRow = page.locator(".profiles-table-row-button").filter({ hasText: "Work" }).first();
  await workRow.click();

  const inspector = page.locator(".profiles-inspector");
  await expect(inspector).toContainText("Work");
  await expect(page.getByRole("button", { name: "Activate Profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Storage Details" })).toBeVisible();

  await page.getByRole("button", { name: "Storage Details" }).click();

  await expect(page.getByRole("button", { name: "Hide Storage Details" })).toBeVisible();
  await expect(inspector).toContainText(
    "Live storage details are available after this profile becomes active.",
  );
  await expect(inspector).not.toContainText("Credentials present");
  await expect(inspector).not.toContainText("Local permissions");
  await expect(inspector).not.toContainText("Token warning");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "use_profile")).toBe(false);
});

test("reapplies a mismatched active profile from the profile row actions menu", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  const workRow = page.locator(".profiles-table-row").filter({ hasText: "Claude" }).first();
  await expect(workRow).toContainText("Needs Attention");

  await page.getByRole("button", { name: "More actions for Claude Code Work" }).click();
  const menu = page.getByRole("menu", { name: "Profile actions" });
  await expect(menu.getByRole("menuitem", { name: "Reapply Active Profile" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Reapply Active Profile" }).click();

  await expect(workRow).toContainText("Active");
  await expect(workRow).not.toContainText("Needs Attention");
  await expect(page.locator(".profiles-inspector")).toContainText("Active");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "claude" &&
        entry.args?.request?.profile === "work" &&
        entry.args?.request?.state_mode === "isolated",
    ),
  ).toBe(true);
});

test("activates an inactive profile from the profile row actions menu", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Profiles" }).click();

  await page.getByLabel("Profile filters").getByRole("button", { name: "Codex" }).click();

  const workRow = page.locator(".profiles-table-row").filter({ hasText: "Work" }).first();
  await expect(workRow).toContainText("Stored");

  await page.getByRole("button", { name: "More actions for Codex CLI Work" }).click();
  const menu = page.getByRole("menu", { name: "Profile actions" });
  await expect(menu.getByRole("menuitem", { name: "Activate" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Activate" }).click();

  await expect(workRow).toContainText("Active");
  await expect(workRow).not.toContainText("Stored");
  await expect(page.locator(".profiles-inspector")).toContainText("Active");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "work" &&
        entry.args?.request?.state_mode === "isolated",
    ),
  ).toBe(true);
});

test("creates and activates a saved set from the sets screen", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByRole("button", { name: "New Set…" }).click();

  const dialog = page.getByRole("dialog", { name: "New Set" });
  await dialog.getByLabel("Set name").fill("focus-mode");
  await dialog.getByLabel("Display label").fill("Focus Mode");
  await dialog.getByLabel("Claude Code").selectOption("personal");
  await dialog.getByLabel("Codex CLI").selectOption("personal");
  await dialog.getByRole("button", { name: "Create Set" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Saved set Focus Mode.")).toBeVisible();

  await page.getByRole("button", { name: "Inspect set Focus Mode" }).click();
  await page.getByRole("button", { name: "Switch to Focus Mode" }).click();

  await expect(page.locator(".sets-inspector")).toContainText("Current");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "update_settings")).toBe(true);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "activate_profile_set" && entry.args?.name === "focus-mode",
    ),
  ).toBe(true);
});

test("closes a new set draft without creating a saved set", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByRole("button", { name: "New Set…" }).click();

  const dialog = page.getByRole("dialog", { name: "New Set" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Set name").fill("focus-mode-draft");
  await dialog.getByLabel("Display label").fill("Focus Mode Draft");
  await dialog.getByLabel("Claude Code").selectOption("personal");
  await dialog.getByLabel("Codex CLI").selectOption("personal");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Inspect set Client Acme", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect set Focus Mode Draft", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Saved set Focus Mode Draft.")).toHaveCount(0);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "update_settings")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "activate_profile_set")).toBe(false);
});

test("renames a saved set from the sets screen", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByRole("button", { name: "Inspect set Client Acme" }).click();
  await page.getByRole("button", { name: "Edit…" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit Set" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Set name").fill("client-acme-prime");
  await dialog.getByLabel("Display label").fill("Client Acme Prime");
  await dialog.getByRole("button", { name: "Save Set" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Updated set Client Acme Prime.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect set Client Acme Prime", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect set Client Acme", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".sets-inspector")).toContainText("Client Acme Prime");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "update_settings")).toBe(true);
});

test("closes the set editor without saving changes", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByRole("button", { name: "Inspect set Client Acme" }).click();
  await page.getByRole("button", { name: "Edit…" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit Set" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Set name").fill("client-acme-draft");
  await dialog.getByLabel("Display label").fill("Client Acme Draft");
  await dialog.getByLabel("Codex CLI").selectOption("personal");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Inspect set Client Acme", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect set Client Acme Draft", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".sets-inspector")).toContainText("Client Acme");
  await expect(
    page.locator(".sets-detail-row").filter({ hasText: "Codex CLI" }),
  ).toContainText("Work");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "update_settings")).toBe(false);
});

test("updates saved set mappings from the sets inspector", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByRole("button", { name: "Inspect set Client Acme" }).click();

  await expect(page.getByRole("button", { name: "Switch to Client Acme" })).toBeVisible();

  await page.getByRole("button", { name: "Edit…" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Set" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Codex CLI")).toHaveValue("work");
  await dialog.getByLabel("Codex CLI").selectOption("personal");
  await dialog.getByRole("button", { name: "Save Set" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Updated set Client Acme.")).toBeVisible();
  await expect(page.locator(".sets-inspector")).toContainText("Current");
  await expect(
    page.locator(".sets-detail-row").filter({ hasText: "Codex CLI" }),
  ).toContainText("Personal");

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "update_settings" &&
        entry.args?.request?.profile_sets?.some(
          (set: { name?: string; profiles?: Record<string, string | null> }) =>
            set.name === "client-acme" && set.profiles?.codex === "personal",
        ),
    ),
  ).toBe(true);
});

test("duplicates a saved set from the sets overflow menu", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByRole("button", { name: "Inspect set Client Acme" }).click();
  const inspector = page.locator(".sets-inspector");
  await inspector.getByRole("button", { name: "More actions for Client Acme" }).click();

  const menu = page.getByRole("menu", { name: "Set actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Duplicate…" })).toBeVisible();
  await expectMenuToFitWithin(menu, inspector);
  await menu.getByRole("menuitem", { name: "Duplicate…" }).click();

  const dialog = page.getByRole("dialog", { name: "New Set" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Set name")).toHaveValue("client-acme-copy");
  await expect(dialog.getByLabel("Display label")).toHaveValue("Client Acme Copy");
  await dialog.getByRole("button", { name: "Create Set" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Saved set Client Acme Copy.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect set Client Acme Copy", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sets-inspector")).toContainText("Client Acme Copy");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "update_settings")).toBe(true);
});

test("opens project rules from the selected set overflow menu", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByRole("button", { name: "Inspect set Client Acme" }).click();
  await page.getByRole("button", { name: "More actions for Client Acme" }).click();
  await page.getByRole("menuitem", { name: "Manage Project Rules…" }).click();

  await expect(
    page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Project Rules" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Rule…" })).toBeVisible();
});

test("deletes a saved set from the sets screen", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByRole("button", { name: "More actions for Client Acme" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();

  await expect(page.getByRole("heading", { name: "No sets yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Set…" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect set Client Acme", exact: true }),
  ).toHaveCount(0);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "update_settings")).toBe(true);
});

test("keeps empty saved sets out of activation surfaces", async ({ page }) => {
  await installDesktopMock(page, "emptyProfileSet");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();

  await page.getByRole("button", { name: "Inspect set Empty Set", exact: true }).click();
  await expect(page.getByRole("button", { name: "Switch to Empty Set" })).toBeDisabled();
  await expect(
    page.getByText("This saved set is empty and cannot be activated yet."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Quick Switch" }).click();
  const quickSwitchDialog = page.getByRole("dialog", { name: "Quick Switch" });
  await expect(quickSwitchDialog.getByRole("option", { name: /Empty Set/ })).toHaveCount(0);
  await expect(quickSwitchDialog.getByRole("option", { name: /Client Acme/ })).toBeVisible();
  await quickSwitchDialog.getByRole("button", { name: "Close" }).click();

  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await page.getByRole("button", { name: "Add Rule…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Rule" });
  const dialogOptions = await dialog.locator("option").allTextContents();
  expect(dialogOptions).toContain("Saved set: Client Acme");
  expect(dialogOptions).not.toContain("Saved set: Empty Set");
});

test("keeps stale saved sets out of activation surfaces and explains missing mappings", async ({
  page,
}) => {
  await installDesktopMock(page, "staleProfileSet");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();

  await expect(page.getByText("Missing: codex: missing")).toBeVisible();
  await page.getByRole("button", { name: "Inspect set Client Acme", exact: true }).click();
  await expect(page.getByRole("button", { name: "Switch to Client Acme" })).toBeDisabled();
  await expect(page.getByText("Missing mapped profiles: codex: missing")).toBeVisible();

  await page.getByRole("button", { name: "Quick Switch" }).click();
  const quickSwitchDialog = page.getByRole("dialog", { name: "Quick Switch" });
  await expect(
    quickSwitchDialog.getByRole("option", { name: /Saved set: Client Acme/i }),
  ).toHaveCount(0);
  await quickSwitchDialog.getByRole("button", { name: "Close" }).click();

  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await page.getByRole("button", { name: "Add Rule…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Rule" });
  const dialogOptions = await dialog.locator("option").allTextContents();
  expect(dialogOptions).not.toContain("Saved set: Client Acme");
  await expect(
    dialog.getByText("No sets are available yet. Create one before saving a project rule."),
  ).toBeVisible();
});

test("adds and removes a project rule from the sets screen", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await page.getByRole("button", { name: "Add Rule…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Rule" });
  await dialog.getByLabel("Rule scope").selectOption("path");
  await dialog.locator("select").nth(1).selectOption("client-acme");
  await dialog.getByRole("textbox", { name: "Path" }).fill("/code/acceptance");
  await dialog.getByRole("button", { name: "Add Rule" }).click();

  await expect(dialog).toBeHidden();
  const ruleRow = page.locator(".sets-rule-table-row").filter({ hasText: "/code/acceptance" }).first();
  await expect(ruleRow).toBeVisible();

  await ruleRow.click();
  await page.getByRole("button", { name: "Remove…" }).click();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "workspace_bind" &&
        entry.args?.request?.target?.scope === "path" &&
        entry.args?.request?.target?.path === "/code/acceptance",
    ),
  ).toBe(true);
  expect(commandLog.some((entry) => entry.command === "workspace_unbind")).toBe(true);
});

test("adds and removes a git remote project rule from the sets screen", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext", undefined, {
    settings: {
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await page.getByRole("button", { name: "Add Rule…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Rule" });
  await dialog.getByLabel("Rule scope").selectOption("git_remote");
  await dialog.getByRole("combobox", { name: "Set" }).selectOption("client-acme");
  await dialog.getByRole("textbox", { name: "Git remote pattern" }).fill("github.com:acme/desktop");
  await dialog.getByRole("button", { name: "Add Rule" }).click();

  await expect(dialog).toBeHidden();
  const ruleRow = page
    .locator(".sets-rule-table-row")
    .filter({ hasText: "github.com:acme/desktop" })
    .first();
  await expect(ruleRow).toBeVisible();

  await ruleRow.click();
  const inspector = page.locator(".sets-rules-inspector");
  await expect(inspector).toContainText("Client Acme");
  await expect(inspector).toContainText("Git remote");
  await expect(inspector).toContainText("github.com:acme/desktop");

  await page.getByRole("button", { name: "Remove…" }).click();
  await expect(
    page.locator(".sets-rule-table-row").filter({ hasText: "github.com:acme/desktop" }),
  ).toHaveCount(0);

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "workspace_bind" &&
        entry.args?.request?.target?.scope === "git_remote" &&
        entry.args?.request?.target?.pattern === "github.com:acme/desktop" &&
        entry.args?.request?.context === "client-acme",
    ),
  ).toBe(true);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "workspace_unbind" &&
        entry.args?.target?.scope === "git_remote" &&
        entry.args?.target?.pattern === "github.com:acme/desktop",
    ),
  ).toBe(true);
});

test("closes a new project rule draft without saving it", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await page.getByRole("button", { name: "Add Rule…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Rule" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Rule scope").selectOption("path");
  await dialog.locator("select").nth(1).selectOption("client-acme");
  await dialog.getByRole("textbox", { name: "Path" }).fill("/code/acceptance-draft");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.locator(".sets-rule-table-row").filter({ hasText: "/code/acme" }).first(),
  ).toBeVisible();
  await expect(
    page.locator(".sets-rule-table-row").filter({ hasText: "/code/acceptance-draft" }),
  ).toHaveCount(0);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "workspace_bind")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "workspace_unbind")).toBe(false);
});

test("edits an existing project rule from the sets inspector", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext", undefined, {
    settings: {
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();

  const ruleRow = page.getByRole("button", { name: "Inspect rule for Client Acme" });
  await ruleRow.click();
  await expect(page.locator(".sets-rules-inspector")).toContainText("Current project");

  await page.getByRole("button", { name: "Edit…" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit Rule" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Rule scope")).toHaveValue("path");
  await expect(dialog.getByRole("textbox", { name: "Path" })).toHaveValue("/code/acme");
  await expect(dialog.getByRole("combobox", { name: "Set" })).toHaveValue("client-acme");

  await dialog.getByRole("textbox", { name: "Path" }).fill("/code/acme-next");
  await dialog.getByRole("button", { name: "Save Rule" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.locator(".sets-rule-table-row").filter({ hasText: "/code/acme-next" }).first(),
  ).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "workspace_unbind" &&
        entry.args?.target?.scope === "path" &&
        entry.args?.target?.path === "/code/acme",
    ),
  ).toBe(true);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "workspace_bind" &&
        entry.args?.request?.target?.scope === "path" &&
        entry.args?.request?.target?.path === "/code/acme-next" &&
        entry.args?.request?.context === "client-acme",
    ),
  ).toBe(true);
});

test("closes the project rule editor without saving changes", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext", undefined, {
    settings: {
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();

  const ruleRow = page.getByRole("button", { name: "Inspect rule for Client Acme" });
  await ruleRow.click();
  await expect(page.locator(".sets-rules-inspector")).toContainText("Current project");

  await page.getByRole("button", { name: "Edit…" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit Rule" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Path" }).fill("/code/acme-draft");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.locator(".sets-rule-table-row").filter({ hasText: "/code/acme" }).first(),
  ).toBeVisible();
  await expect(
    page.locator(".sets-rule-table-row").filter({ hasText: "/code/acme-draft" }),
  ).toHaveCount(0);
  await expect(page.locator(".sets-rules-inspector")).toContainText("Current project");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "workspace_bind")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "workspace_unbind")).toBe(false);
});

test("returns from project rules to the set library from the rules overflow menu", async ({
  page,
}) => {
  await installDesktopMock(page, "workspaceContext");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await expect(page.getByRole("heading", { name: "Project Rules" })).toBeVisible();

  const panel = page.locator(".sets-rules-list-panel");
  await panel.getByRole("button", { name: "Project rules actions" }).click();

  const menu = page.getByRole("menu", { name: "Project rules actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Open Sets" })).toBeVisible();
  await expectMenuToFitWithin(menu, panel);
  await menu.getByRole("menuitem", { name: "Open Sets" }).click();

  await expect(
    page.getByLabel("Sets mode").getByRole("button", { name: "Set Library" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "New Set…" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project Rules" })).toHaveCount(0);
});

test("blocks incomplete project-rule submissions until a valid set and target are available", async ({
  page,
}) => {
  await installDesktopMock(page, "matchingContextSet", undefined, {
    settings: {
      profile_sets: [],
    },
    snapshot: {
      contexts: [],
    },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await page.getByRole("button", { name: "Add Rule…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Rule" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("No sets are available yet. Create one before saving a project rule."),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Add Rule" })).toBeDisabled();

  await dialog.getByLabel("Rule scope").selectOption("path");
  await expect(
    dialog.getByText("Enter a path prefix before saving or removing this rule."),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Add Rule" })).toBeDisabled();

  await dialog.getByRole("textbox", { name: "Path" }).fill("   ");
  await expect(dialog.getByRole("button", { name: "Add Rule" })).toBeDisabled();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "workspace_bind")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "workspace_unbind")).toBe(false);
});

test("reviews and applies safe diagnostics repairs, then exports a report", async ({ page }) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  const reviewSafeFixes = page.getByRole("button", { name: "Review Safe Fixes" });
  await expect(reviewSafeFixes).toBeEnabled();
  await reviewSafeFixes.click();
  const repairDialog = page.getByRole("dialog", { name: "Review Safe Fixes" });
  await expect(repairDialog).toBeVisible();
  await expect(repairDialog.getByText("Unlock keyring integration")).toBeVisible();
  await repairDialog.getByRole("button", { name: "Apply Safe Fixes" }).click();
  await expect(repairDialog).toBeHidden();

  await page.getByRole("button", { name: "Diagnostics more actions" }).click();
  const diagnosticsMenu = page.getByRole("menu", { name: "Diagnostics actions" });
  await expect(diagnosticsMenu).toBeVisible();
  await expect(diagnosticsMenu.getByRole("menuitem", { name: "Export Report" })).toBeVisible();
  await expectMenuToFitViewport(diagnosticsMenu, page);
  await diagnosticsMenu.getByRole("menuitem", { name: "Export Report" }).click();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "run_repair" &&
        entry.args?.request?.apply === true,
    ),
  ).toBe(true);
  expect(commandLog.some((entry) => entry.command === "export_diagnostic_bundle")).toBe(true);
  await expect(
    page.getByText(
      "Support report ready: aisw-desktop-diagnostics-789.json. /tmp/aisw-desktop/aisw-desktop-diagnostics-789.json",
    ),
  ).toBeVisible();
});

test("reviews safe diagnostics fixes and closes without applying changes", async ({ page }) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  const reviewSafeFixes = page.getByRole("button", { name: "Review Safe Fixes" });
  await expect(reviewSafeFixes).toBeEnabled();
  await reviewSafeFixes.click();

  const repairDialog = page.getByRole("dialog", { name: "Review Safe Fixes" });
  await expect(repairDialog).toBeVisible();
  await expect(repairDialog.getByText("Unlock keyring integration")).toBeVisible();
  await expect(repairDialog.getByRole("button", { name: /Apply .* Fixes|Apply Safe Fixes/ })).toBeVisible();

  await repairDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(repairDialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Review Safe Fixes" })).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "run_repair" &&
        entry.args?.request?.apply === true,
    ),
  ).toBe(false);
});

test("copies the exported diagnostics report path from the footer", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  await page.getByRole("button", { name: "Diagnostics more actions" }).click();
  await page.getByRole("menuitem", { name: "Export Report" }).click();

  await expect(
    page.getByText(
      "Support report ready: aisw-desktop-diagnostics-789.json. /tmp/aisw-desktop/aisw-desktop-diagnostics-789.json",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Copy report path" }).click();

  await expect.poll(async () => readClipboardWrites(page)).toContain(
    "/tmp/aisw-desktop/aisw-desktop-diagnostics-789.json",
  );
  await expect(
    page.getByText(
      "Copied bundle path /tmp/aisw-desktop/aisw-desktop-diagnostics-789.json.",
    ),
  ).toBeVisible();
});

test("routes keyring diagnostics into security settings", async ({ page }) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();
  await expect(page.getByRole("button", { name: "Apply keyring repair" })).toBeVisible();

  await page.getByRole("button", { name: "More finding actions" }).click();
  await page.getByRole("menuitem", { name: "Show keyring setup" }).click();

  const settingsNav = page.locator(".settings-category-pane");
  await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
  await expect(settingsNav.getByRole("button", { name: "Security" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Credential Storage" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal in Finder" })).toBeVisible();
});

test("runs targeted diagnostic repairs and opens file-backed profile setup", async ({
  page,
}) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  await expect(page.getByRole("button", { name: "Apply keyring repair" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use file-backed storage" })).toBeVisible();
  await page.getByRole("button", { name: "Apply keyring repair" }).click();

  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "run_repair" &&
          entry.args?.request?.apply === true &&
          entry.args?.request?.fixes?.includes("keyring"),
      ),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Inspect Permissions incorrect" }).click();
  await expect(page.getByRole("button", { name: "Repair permissions" })).toBeVisible();
  await page.getByRole("button", { name: "Repair permissions" }).click();

  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "run_repair" &&
          entry.args?.request?.apply === true &&
          entry.args?.request?.fixes?.includes("permissions"),
      ),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Inspect OAuth failure" }).click();
  await expect(page.getByRole("button", { name: "Retry OAuth repair" })).toBeVisible();
  await page.getByRole("button", { name: "Retry OAuth repair" }).click();

  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "run_repair" &&
          entry.args?.request?.apply === true &&
          entry.args?.request?.fixes?.includes("oauth"),
      ),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Inspect Keyring unavailable" }).click();
  await page.getByRole("button", { name: "Use file-backed storage" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByLabel("Import mode")).toHaveValue("from_live");
  await expect(addDialog.getByLabel("Credential backend")).toHaveValue("file");
});

test("shows healthy diagnostics states and reruns checks on demand", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Diagnostics" }).click();

  await expect(page.getByText("Everything looks good")).toBeVisible();
  await expect(
    page.getByText(
      "All configured tools match their active AISW profiles and local storage checks passed.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review Safe Fixes" })).toBeDisabled();

  const beforeRefresh = await readCommandLog(page);
  const initialDoctorRuns = beforeRefresh.filter((entry) => entry.command === "run_doctor").length;
  const initialVerifyRuns = beforeRefresh.filter((entry) => entry.command === "run_verify").length;
  const initialRepairRuns = beforeRefresh.filter((entry) => entry.command === "run_repair").length;

  await page.getByRole("button", { name: "Verify Again" }).first().click();

  await expect
    .poll(async () => {
      const commandLog = await readCommandLog(page);
      return {
        doctorRuns: commandLog.filter((entry) => entry.command === "run_doctor").length,
        verifyRuns: commandLog.filter((entry) => entry.command === "run_verify").length,
        repairRuns: commandLog.filter((entry) => entry.command === "run_repair").length,
      };
    })
    .toEqual({
      doctorRuns: initialDoctorRuns + 1,
      verifyRuns: initialVerifyRuns + 1,
      repairRuns: initialRepairRuns + 1,
    });
});

test("opens diagnostics from the tray without using the sidebar", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-open-diagnostics");

  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify Again" }).first()).toBeVisible();
});

test("opens diagnostics and refreshes health checks from the tray", async ({ page }) => {
  await installDesktopMock(page, "trayDiagnosticsRefresh");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-run-diagnostics");

  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify Again" }).first()).toBeVisible();
  await expect
    .poll(async () => {
      const commandLog = await readCommandLog(page);
      return {
        doctorRuns: commandLog.filter((entry) => entry.command === "run_doctor").length,
        verifyRuns: commandLog.filter((entry) => entry.command === "run_verify").length,
        repairRuns: commandLog.filter((entry) => entry.command === "run_repair").length,
      };
    })
    .toEqual({
      doctorRuns: 1,
      verifyRuns: 1,
      repairRuns: 1,
    });
});

test("reruns diagnostics from the global verify toolbar action", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const beforeRefresh = await readCommandLog(page);
  const initialDoctorRuns = beforeRefresh.filter((entry) => entry.command === "run_doctor").length;
  const initialVerifyRuns = beforeRefresh.filter((entry) => entry.command === "run_verify").length;
  const initialRepairRuns = beforeRefresh.filter((entry) => entry.command === "run_repair").length;

  await page.getByRole("button", { name: "Verify" }).first().click();

  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect
    .poll(async () => {
      const doctorRuns = await expectCommandCount(page, "run_doctor");
      const verifyRuns = await expectCommandCount(page, "run_verify");
      const repairRuns = await expectCommandCount(page, "run_repair");
      return {
        doctorRuns,
        verifyRuns,
        repairRuns,
        refreshed:
          doctorRuns > initialDoctorRuns &&
          verifyRuns > initialVerifyRuns &&
          repairRuns > initialRepairRuns,
      };
    })
    .toMatchObject({
      refreshed: true,
    });

  const afterFirstVerify = {
    doctorRuns: await expectCommandCount(page, "run_doctor"),
    verifyRuns: await expectCommandCount(page, "run_verify"),
    repairRuns: await expectCommandCount(page, "run_repair"),
  };

  await page.getByRole("button", { name: "Verify" }).first().click();

  await expect
    .poll(async () => {
      const doctorRuns = await expectCommandCount(page, "run_doctor");
      const verifyRuns = await expectCommandCount(page, "run_verify");
      const repairRuns = await expectCommandCount(page, "run_repair");
      return {
        doctorRuns,
        verifyRuns,
        repairRuns,
        refreshedAgain:
          doctorRuns > afterFirstVerify.doctorRuns &&
          verifyRuns > afterFirstVerify.verifyRuns &&
          repairRuns > afterFirstVerify.repairRuns,
      };
    })
    .toMatchObject({
      refreshedAgain: true,
    });
});

test("refreshes the backups list after a successful tray profile switch", async ({ page }) => {
  await installDesktopMock(page, "trayBackupRefresh");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Backups", exact: true }).click();
  await expect(page.getByText("No backups found")).toBeVisible();

  await page.evaluate(() => {
    (
      window as typeof window & {
        __AISW_DESKTOP_SCENARIO_STATE__?: { trayBackupApplied?: boolean };
      }
    ).__AISW_DESKTOP_SCENARIO_STATE__!.trayBackupApplied = true;
  });

  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "tool",
    tool: "claude",
    label: "Switch profile",
    status: "success",
    message: "Switched claude to work.",
  });

  await expect(page.getByText("20260326T120000Z-claude-work")).toBeVisible();
  await expect(page.getByLabel("Backups list")).toContainText("Work");
});

test("exports diagnostics from the app menu", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-export-diagnostics");

  await expect
    .poll(async () =>
      (await readCommandLog(page)).some((entry) => entry.command === "export_diagnostic_bundle"),
    )
    .toBe(true);
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "Diagnostic report exported" &&
          notification?.body === "Saved aisw-desktop-diagnostics-789.json.",
      ),
    )
    .toBe(true);
});

test("opens troubleshooting from the app menu and falls back to diagnostics", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-troubleshooting");

  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify Again" }).first()).toBeVisible();
  await expect
    .poll(async () => {
      const commandLog = await readCommandLog(page);
      return {
        openedReference: commandLog.some((entry) => entry.command === "open_reference_document"),
        doctorRuns: commandLog.filter((entry) => entry.command === "run_doctor").length,
        verifyRuns: commandLog.filter((entry) => entry.command === "run_verify").length,
        repairRuns: commandLog.filter((entry) => entry.command === "run_repair").length,
      };
    })
    .toEqual({
      openedReference: true,
      doctorRuns: 1,
      verifyRuns: 1,
      repairRuns: 1,
    });
});

test("filters backups and restores a saved backup into the active profile", async ({ page }) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  const toolbar = page.locator(".backups-filter-row");
  await toolbar.getByLabel("Tool").selectOption("codex");
  await toolbar.getByLabel("Search backups").fill("personal");

  const backupRow = page.locator(".backups-table-row").first();
  await expect(backupRow).toContainText("Personal");
  await backupRow.click();

  await page.getByRole("button", { name: "Backup actions" }).click();
  await page.getByRole("menuitem", { name: "Restore and Activate…" }).click();

  const restoreDialog = page.getByRole("dialog", { name: "Restore Backup" });
  await expect(restoreDialog).toContainText("Restore and Activate");
  await restoreDialog.getByRole("button", { name: "Restore and Activate" }).click();
  await expect(restoreDialog).toBeHidden();
  await expect(page.locator(".backups-inspector-surface")).toContainText("Personal");

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "restore_backup")).toBe(true);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "personal",
    ),
  ).toBe(true);
});

test("orders backups by created_at metadata and shows formatted timestamps", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await overrideDesktopCommand(page, "list_backups", {
    result: [
      {
        backup_id: "zzz-claude-work",
        tool: "claude",
        profile: "claude/work",
        created_at: "2026-03-25T11:45:02Z",
      },
      {
        backup_id: "aaa-codex-personal",
        tool: "codex",
        profile: "codex/personal",
        created_at: "2026-03-26T09:40:12Z",
      },
    ],
  });

  await page.getByRole("button", { name: "Backups" }).click();
  await expect(page.getByLabel("Backups list")).toBeVisible();

  const rows = page.locator(".backups-table-row");
  await expect(rows.nth(0)).toContainText("Personal");
  await expect(rows.nth(1)).toContainText("Work");
  await expect(page.getByText("Date Unavailable")).toHaveCount(0);

  await rows.nth(0).click();
  await expect(page.locator(".backups-inspector-surface")).not.toContainText("Date Unavailable");
});

test("reorders backups when the date filter changes", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await overrideDesktopCommand(page, "list_backups", {
    result: [
      {
        backup_id: "newer-claude-work",
        tool: "claude",
        profile: "claude/work",
        created_at: "2026-03-26T11:45:02Z",
      },
      {
        backup_id: "older-codex-personal",
        tool: "codex",
        profile: "codex/personal",
        created_at: "2026-03-24T09:40:12Z",
      },
    ],
  });

  await page.getByRole("button", { name: "Backups" }).click();
  const toolbar = page.locator(".backups-filter-row");
  const rows = page.locator(".backups-table-row");

  await expect(rows.nth(0)).toContainText("Work");
  await expect(rows.nth(1)).toContainText("Personal");

  await toolbar.getByLabel("Date").selectOption("oldest");

  await expect(rows.nth(0)).toContainText("Personal");
  await expect(rows.nth(1)).toContainText("Work");
});

test("refreshes backups from the toolbar menu", async ({ page }) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  const refreshRunsBefore = await expectCommandCount(page, "list_backups");
  await page.getByRole("button", { name: "Backups more actions" }).click();
  const backupsMenu = page.getByRole("menu", { name: "Backups actions" });
  await expect(backupsMenu).toBeVisible();
  await expect(backupsMenu.getByRole("menuitem", { name: "Refresh" })).toBeVisible();
  await expectMenuToFitViewport(backupsMenu, page);
  await backupsMenu.getByRole("menuitem", { name: "Refresh" }).click();

  await expect
    .poll(async () => await expectCommandCount(page, "list_backups"))
    .toBe(refreshRunsBefore + 1);
});

test("copies backup ids and reveals the backup folder from backup actions", async ({ page }) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  const backupRow = page.locator(".backups-table-row").first();
  await backupRow.click();

  await page.getByRole("button", { name: "Backup actions" }).click();
  await page.getByRole("menuitem", { name: "Copy Backup ID" }).click();
  await expect.poll(async () => readClipboardWrites(page)).toContain(
    "20260326T094012Z-codex-personal",
  );

  await page.getByRole("button", { name: "Backup actions" }).click();
  await page.getByRole("menuitem", { name: "Reveal Backup Folder" }).click();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "open_app_data_folder")).toBe(true);
});

test("warns before restoring backup files without activating the profile", async ({ page }) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  const backupRow = page.locator(".backups-table-row").first();
  await backupRow.click();
  await page.getByRole("button", { name: "Restore…" }).click();

  const restoreDialog = page.getByRole("dialog", { name: "Restore Backup" });
  await expect(restoreDialog).toContainText(
    "The active Codex CLI account will not change until you activate the profile.",
  );

  let commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "restore_backup")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "use_profile")).toBe(false);

  await restoreDialog.getByRole("button", { name: "Restore Files" }).click();
  await expect(restoreDialog).toBeHidden();

  commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "restore_backup")).toBe(true);
  expect(commandLog.some((entry) => entry.command === "use_profile")).toBe(false);
});

test("closes the backup restore dialog without changing files or activation", async ({
  page,
}) => {
  await installDesktopMock(page, "backupCatalog");

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  const backupRow = page.locator(".backups-table-row").first();
  await backupRow.click();
  await page.getByRole("button", { name: "Restore…" }).click();

  const restoreDialog = page.getByRole("dialog", { name: "Restore Backup" });
  await expect(restoreDialog).toBeVisible();
  await restoreDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(restoreDialog).toBeHidden();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "restore_backup")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "use_profile")).toBe(false);
});

test("preserves the tool state mode when a backup restore re-activates a profile", async ({
  page,
}) => {
  await installDesktopMock(page, "backupCatalog", undefined, {
    runtime_status: {
      capabilities: {
        tools: {
          codex: {
            state_modes: ["shared", "isolated"],
          },
        },
      },
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
          warnings: [],
        },
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
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Backups" }).click();

  const backupRow = page.locator(".backups-table-row").first();
  await backupRow.click();
  await page.getByRole("button", { name: "Backup actions" }).click();
  await page.getByRole("menuitem", { name: "Restore and Activate…" }).click();

  const restoreDialog = page.getByRole("dialog", { name: "Restore Backup" });
  await restoreDialog.getByRole("button", { name: "Restore and Activate" }).click();
  await expect(restoreDialog).toBeHidden();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "restore_backup")).toBe(true);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_profile" &&
        entry.args?.request?.tool === "codex" &&
        entry.args?.request?.profile === "personal" &&
        entry.args?.request?.state_mode === "shared",
    ),
  ).toBe(true);
});

test("exports and clears recorded activity from the activity screen", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();
  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await dialog.getByLabel("Search Quick Switch").fill("client acme");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();

  await page.locator(".sidebar").getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.locator(".activity-event-row").first()).toBeVisible();

  await page.getByRole("button", { name: "Activity more actions" }).click();
  const activityMenu = page.getByRole("menu", { name: "Activity actions" });
  await expect(activityMenu).toBeVisible();
  await expect(activityMenu.getByRole("menuitem", { name: "Export Redacted Activity…" })).toBeVisible();
  await expectMenuToFitViewport(activityMenu, page);
  await activityMenu.getByRole("menuitem", { name: "Export Redacted Activity…" }).click();
  await expect(page.getByText("Opened aisw-desktop-activity-123.json.")).toBeVisible();

  await page.getByRole("button", { name: "Activity more actions" }).click();
  const clearMenu = page.getByRole("menu", { name: "Activity actions" });
  await expect(clearMenu).toBeVisible();
  await expect(clearMenu.getByRole("menuitem", { name: "Clear Activity History…" })).toBeVisible();
  await expectMenuToFitViewport(clearMenu, page);
  await clearMenu.getByRole("menuitem", { name: "Clear Activity History…" }).click();

  const clearDialog = page.getByRole("dialog", { name: "Clear Activity History" });
  await clearDialog.getByRole("button", { name: "Clear History" }).click();
  await expect(clearDialog).toBeHidden();
  await expect(page.getByText("No recent activity")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "export_activity_log")).toBe(true);
});

test("closes activity clear history without removing recorded events", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Quick Switch" }).click();
  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await dialog.getByLabel("Search Quick Switch").fill("client acme");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();

  await page.locator(".sidebar").getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.locator(".activity-event-row").first()).toBeVisible();
  const activityBefore = await readLocalStorage(page, "ai-switch.desktop.activity-log");

  await page.getByRole("button", { name: "Activity more actions" }).click();
  const clearMenu = page.getByRole("menu", { name: "Activity actions" });
  await clearMenu.getByRole("menuitem", { name: "Clear Activity History…" }).click();

  const clearDialog = page.getByRole("dialog", { name: "Clear Activity History" });
  await expect(clearDialog).toBeVisible();
  await clearDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(clearDialog).toBeHidden();

  await expect(page.locator(".activity-event-row").first()).toBeVisible();
  await expect(page.locator(".activity-event-row").first()).toContainText("Activate saved set");
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.activity-log"))
    .toBe(activityBefore);
});

test("opens the activity log from the toolbar menu", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "tool",
    tool: "claude",
    label: "Switch profile",
    status: "success",
    message: "Switched claude to work.",
  });

  await page.locator(".sidebar").getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.locator(".activity-event-row").first()).toBeVisible();

  await page.getByRole("button", { name: "Activity more actions" }).click();
  const activityMenu = page.getByRole("menu", { name: "Activity actions" });
  await expect(activityMenu).toBeVisible();
  await expect(activityMenu.getByRole("menuitem", { name: "Open Log File" })).toBeVisible();
  await expectMenuToFitViewport(activityMenu, page);
  await activityMenu.getByRole("menuitem", { name: "Open Log File" }).click();

  await expect(page.getByText("Opened aisw-desktop-activity-123.json.")).toBeVisible();
  await expect
    .poll(async () =>
      (await readNotifications(page)).some(
        (notification) =>
          notification?.title === "Activity log opened" &&
          notification?.body === "Opened aisw-desktop-activity-123.json.",
      ),
    )
    .toBe(true);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "export_activity_log")).toBe(true);
});

test("shows recorded activity details and opens the log file from the activity screen", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "tool",
    tool: "claude",
    label: "Switched Claude Code",
    status: "error",
    message: "The selected profile needs attention before it can be applied.",
    remediation: "Open the profile and refresh credentials.",
  });

  await page.locator(".sidebar").getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inspect Switched Claude Code" })).toBeVisible();

  await page.getByRole("button", { name: "Inspect Switched Claude Code" }).click();
  await expect(page.getByRole("heading", { name: "Switched Claude Code" })).toBeVisible();
  await expect(
    page.getByText("The selected profile needs attention before it can be applied."),
  ).toBeVisible();
  await expect(page.getByText("Open the profile and refresh credentials.")).toBeVisible();
  await page.locator("summary").filter({ hasText: "Recorded Command" }).click();
  await expect(page.getByText("Command details were not recorded for this event.")).toBeVisible();
  await page.locator("summary").filter({ hasText: "Redacted Result" }).click();
  await expect(page.getByText("No redacted result payload was recorded for this event.")).toBeVisible();

  await page.getByRole("button", { name: "Activity more actions" }).click();
  await page.getByRole("menuitem", { name: "Open Log File" }).click();
  await expect(page.getByText("Opened aisw-desktop-activity-123.json.")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "export_activity_log")).toBe(true);
});

test("persists multiple recorded activity events for the same scope across reloads", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "global",
    id: "settings",
    label: "Saved settings",
    status: "success",
    message: "Updated bundled runtime settings.",
  });
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "global",
    id: "settings",
    label: "Checked for updates",
    status: "error",
    message: "The update endpoint did not respond.",
    remediation: "Try again after verifying the selected update channel.",
  });

  await page.locator(".sidebar").getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inspect Saved settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect Checked for updates" })).toBeVisible();
  await expect(
    page.getByText("Activity is stored locally and credentials are always redacted."),
  ).toBeVisible();

  const storedActivity = await readLocalStorage(page, "ai-switch.desktop.activity-log");
  await page.evaluate((value) => {
    window.sessionStorage.setItem("persisted-activity-log", value ?? "");
  }, storedActivity);
  await page.addInitScript(() => {
    const value = window.sessionStorage.getItem("persisted-activity-log");
    if (value) {
      window.localStorage.setItem("ai-switch.desktop.activity-log", value);
    }
  });

  await page.reload();
  await page.locator(".sidebar").getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inspect Saved settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect Checked for updates" })).toBeVisible();
  await expect(page.locator(".activity-event-row").first()).toContainText("Checked for updates");

  const restoredActivity = await readLocalStorage(page, "ai-switch.desktop.activity-log");
  expect(restoredActivity).toContain("Checked for updates");
  expect(restoredActivity).toContain("Saved settings");
});

test("filters recorded activity by status and search query", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "global",
    id: "settings",
    label: "Saved settings",
    status: "success",
    message: "Updated bundled runtime settings.",
  });
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "global",
    id: "settings",
    label: "Checked for updates",
    status: "error",
    message: "The update endpoint did not respond.",
    remediation: "Try again after verifying the selected update channel.",
  });

  await page.locator(".sidebar").getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inspect Saved settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect Checked for updates" })).toBeVisible();

  const activityFilters = page.locator('.segmented-control[aria-label="Activity filters"]');
  await activityFilters.getByRole("button", { name: "Failed" }).click();
  await expect(page.getByRole("button", { name: "Inspect Checked for updates" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect Saved settings" })).toHaveCount(0);

  const search = page.getByRole("searchbox", { name: "Search activity" });
  await search.fill("selected update channel");
  await expect(page.getByRole("button", { name: "Inspect Checked for updates" })).toBeVisible();

  await search.fill("bundled runtime");
  await expect(page.getByText("No recent activity")).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect Checked for updates" })).toHaveCount(0);

  await page.getByRole("button", { name: "Clear Search activity" }).click();
  await activityFilters.getByRole("button", { name: "All" }).click();
  await expect(page.getByRole("button", { name: "Inspect Saved settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inspect Checked for updates" })).toBeVisible();
});

test("refreshes activity state from the toolbar overflow menu", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "tray-command-result", {
    scope: "tool",
    tool: "claude",
    label: "Switch profile",
    status: "success",
    message: "Switched claude to work.",
  });

  await page.locator(".sidebar").getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.locator(".activity-event-row").first()).toBeVisible();

  const bootstrapReadsBefore = await expectCommandCount(page, "get_bootstrap");

  await page.getByRole("button", { name: "Activity more actions" }).click();
  await page.getByRole("menuitem", { name: "Refresh" }).click();

  await expect
    .poll(async () => await expectCommandCount(page, "get_bootstrap"))
    .toBeGreaterThan(bootstrapReadsBefore);
  await expect(page.locator(".activity-event-row").first()).toBeVisible();
});

test("uses the saved default section on launch", async ({ page }) => {
  await installDesktopMock(page, "switching");
  await page.addInitScript(() => {
    window.localStorage.setItem("ai-switch.desktop.default-section", "profiles");
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search Profiles" })).toBeVisible();
});

test("manages launch, shell, update, and app-data actions from settings", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const launchAtLogin = page.getByRole("switch", { name: "Launch at login" });
  await expect(launchAtLogin).toHaveAttribute("aria-checked", "false");
  await launchAtLogin.click();
  await expect(launchAtLogin).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Launch at login enabled.")).toBeVisible();

  const settingsNav = page.locator(".settings-category-pane");
  await settingsNav.getByRole("button", { name: "Terminal Integration" }).click();
  await page.getByRole("button", { name: "Copy Install" }).click();
  await page.getByRole("button", { name: "Copy Verify" }).click();

  await settingsNav.getByRole("button", { name: "Updates" }).click();
  await page.getByLabel("Update channel").selectOption("beta");
  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "update_settings" &&
          entry.args?.request?.update_channel === "beta",
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Check for Updates" }).click();
  await expect(page.getByText("Update available: 0.3.0-beta.1")).toBeVisible();
  await page.getByRole("button", { name: "Install Update" }).click();
  await expect(page.getByText("Update installed. Restart has been requested.")).toBeVisible();

  await settingsNav.getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Open App Data Folder" }).click();
  await expect(page.getByText("Opened /Users/burakdede/.local/share/ai-switcher.")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "set_launch_at_login")).toBe(true);
  expect(commandLog.some((entry) => entry.command === "check_for_updates")).toBe(true);
  expect(commandLog.some((entry) => entry.command === "install_update")).toBe(true);
  expect(commandLog.some((entry) => entry.command === "open_app_data_folder")).toBe(true);
  expect(await readClipboardWrites(page)).toContain(
    "echo 'eval \"$(aisw shell-hook zsh)\"' >> ~/.zshrc",
  );
  expect(await readClipboardWrites(page)).toContain('echo "$AISW_SHELL_HOOK"');
});

test("shows installed app and engine versions in updates settings", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Updates" }).click();

  await expect(page.getByText("Current version")).toBeVisible();
  await expect(page.getByText("0.1.11", { exact: true })).toBeVisible();
  await expect(page.getByText("Bundled AISW Engine")).toBeVisible();
  await expect(page.getByText("0.3.8", { exact: true })).toBeVisible();
  await expect(page.getByText("Compatibility")).toBeVisible();
  await expect(page.getByText("Supported")).toBeVisible();
});

test("shows desktop-first terminal guidance in settings", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Terminal Integration" }).click();

  const settingsPane = page.locator(".settings-form-pane");
  await expect(settingsPane.getByText("Detected shell")).toBeVisible();
  await expect(settingsPane.getByText("Zsh", { exact: true })).toBeVisible();
  await expect(settingsPane.getByText("Shell hook", { exact: true })).toBeVisible();
  await expect(settingsPane.getByText("Config file", { exact: true })).toBeVisible();
  await expect(settingsPane.getByText("~/.zshrc", { exact: true })).toBeVisible();
  await expect(settingsPane.getByText("Completion scripts", { exact: true })).toBeVisible();
  await expect(settingsPane.getByRole("button", { name: "Copy Install" })).toBeVisible();
  await expect(settingsPane.getByRole("button", { name: "Copy Verify" })).toBeVisible();
  await expect(
    settingsPane.getByText(
      "Current terminal sessions only need the hook when they must receive live environment changes immediately.",
    ),
  ).toBeVisible();
});

test("shows when no desktop update is available in settings", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await overrideDesktopCommand(page, "check_for_updates", {
    result: {
      configured: true,
      channel: "stable",
      current_version: "0.1.11",
      endpoint: "https://updates.example.com/stable.json",
      update: null,
      message: "No update is currently available.",
    },
  });

  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Updates" }).click();
  await page.getByRole("button", { name: "Check for Updates" }).click();

  await expect(page.getByText("Channel: stable")).toBeVisible();
  await expect(page.getByText("Endpoint: https://updates.example.com/stable.json")).toBeVisible();
  await expect(page.getByText("No update is currently available.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Install Update" })).toBeDisabled();
});

test("clears stale updater results when the release channel changes", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const settingsNav = page.locator(".settings-category-pane");
  await settingsNav.getByRole("button", { name: "Updates" }).click();
  const updateResults = page.locator(".settings-result-list");

  await page.getByRole("button", { name: "Check for Updates" }).click();
  await expect(page.getByText("Update available: 0.2.0")).toBeVisible();
  await expect(page.getByText("Endpoint: https://updates.example.com/stable.json")).toBeVisible();
  await expect(updateResults.getByText("Faster switching and signed updater artifacts.")).toBeVisible();

  await page.getByLabel("Update channel").selectOption("beta");
  await expect(
    page.getByText("Check for a signed desktop release on the selected beta channel."),
  ).toBeVisible();
  await expect(page.getByText("Update available: 0.2.0")).toHaveCount(0);
  await expect(page.getByText("Endpoint: https://updates.example.com/stable.json")).toHaveCount(0);

  await page.getByRole("button", { name: "Check for Updates" }).click();
  await expect(page.getByText("Channel: beta")).toBeVisible();
  await expect(page.getByText("Update available: 0.3.0-beta.1")).toBeVisible();
  await expect(page.getByText("Endpoint: https://updates.example.com/beta.json")).toBeVisible();
  await expect(updateResults.getByText("Preview release candidate.")).toBeVisible();

  const checkRuns = await expectCommandCount(page, "check_for_updates");
  expect(checkRuns).toBeGreaterThanOrEqual(2);
});

test("saves the selected update channel before checking for updates", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const settingsNav = page.locator(".settings-category-pane");
  await settingsNav.getByRole("button", { name: "Updates" }).click();

  await page.getByLabel("Update channel").selectOption("beta");
  const checkCountBefore = await expectCommandCount(page, "check_for_updates");
  await page.getByRole("button", { name: "Check for Updates" }).click();

  await expect(page.getByText("Channel: beta")).toBeVisible();
  await expect(page.getByText("Endpoint: https://updates.example.com/beta.json")).toBeVisible();
  await expect(page.getByText("Update available: 0.3.0-beta.1")).toBeVisible();
  await expect
    .poll(async () => expectCommandCount(page, "check_for_updates"))
    .toBe(checkCountBefore + 1);

  const commandLog = await readCommandLog(page);
  const updateSettingsIndex = commandLog.findIndex(
    (entry) =>
      entry.command === "update_settings" && entry.args?.request?.update_channel === "beta",
  );
  const checkForUpdatesIndex = commandLog.findLastIndex(
    (entry) => entry.command === "check_for_updates",
  );

  expect(updateSettingsIndex).toBeGreaterThanOrEqual(0);
  expect(checkForUpdatesIndex).toBeGreaterThan(updateSettingsIndex);
});

test("shows updater remediation when update checks fail in settings", async ({ page }) => {
  await installDesktopMock(page, "updaterError");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Updates" }).click();
  await page.getByRole("button", { name: "Check for Updates" }).click();

  await expect(page.getByText("Update check failed")).toBeVisible();
  await expect(page.getByText("Desktop update failed: invalid endpoint")).toBeVisible();
  await expect(
    page.getByText(
      "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
    ),
  ).toBeVisible();
});

test("shows updater remediation when install fails in settings", async ({ page }) => {
  await installDesktopMock(page, "updaterInstallError");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Updates" }).click();
  await page.getByRole("button", { name: "Check for Updates" }).click();
  await expect(page.getByText("Update available: 0.2.0")).toBeVisible();

  await page.getByRole("button", { name: "Install Update" }).click();

  await expect(page.getByText("Update install failed")).toBeVisible();
  await expect(page.getByText("Desktop update failed: signature mismatch")).toBeVisible();
  await expect(
    page.getByText(
      "Verify the updater endpoint, signing key, and generated updater artifacts for this release.",
    ),
  ).toBeVisible();
});

test("persists general preferences and runs security and advanced settings actions", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const launchAtLogin = page.getByRole("switch", { name: "Launch at login" });
  const showMenuBarIcon = page.getByRole("switch", { name: "Show menu bar icon" });
  const restoreWindowState = page.getByRole("switch", {
    name: "Restore previous window size and position",
  });

  await expect(launchAtLogin).toHaveAttribute("aria-checked", "false");
  await expect(showMenuBarIcon).toHaveAttribute("aria-checked", "true");
  await expect(restoreWindowState).toHaveAttribute("aria-checked", "true");

  await launchAtLogin.click();
  await page.getByLabel("Appearance").selectOption("dark");
  await showMenuBarIcon.click();
  await restoreWindowState.click();
  await page.getByLabel("Default section").selectOption("profiles");

  await expect(launchAtLogin).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => ({
      appearance: await readLocalStorage(page, "ai-switch.desktop.appearance"),
      defaultSection: await readLocalStorage(page, "ai-switch.desktop.default-section"),
      showMenuBarIcon: await readLocalStorage(page, "ai-switch.desktop.show-menu-bar-icon"),
      restoreWindowState: await readLocalStorage(page, "ai-switch.desktop.restore-window-state"),
      rootAppearance: await page.evaluate(() => document.documentElement.dataset.appearance ?? null),
      colorScheme: await page.evaluate(() => document.documentElement.style.colorScheme),
    }))
    .toEqual({
      appearance: "dark",
      defaultSection: "profiles",
      showMenuBarIcon: "false",
      restoreWindowState: "false",
      rootAppearance: "dark",
      colorScheme: "dark",
    });

  await page.getByRole("button", { name: "Security" }).click();
  await page.getByRole("button", { name: "Copy Redacted Report…" }).click();
  await expect(page.getByText("Saved aisw-desktop-diagnostics-789.json.")).toBeVisible();

  await page.evaluate(() =>
    window.localStorage.setItem(
      "ai-switch.desktop.window-state",
      JSON.stringify({ width: 1280, height: 820, x: 64, y: 96 }),
    ),
  );

  await page.getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Reset Window Layout" }).click();
  await expect(page.getByText("Cleared the saved window size and position.")).toBeVisible();
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.window-state"))
    .toBeNull();

  await page.getByRole("button", { name: "Reopen Setup Assistant" }).click();
  await expect(page.getByRole("button", { name: "Close setup" })).toBeVisible();
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.reopen-setup-assistant"))
    .toBe("true");

  await page.getByRole("button", { name: "Close setup" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.reopen-setup-assistant"))
    .toBe("false");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Reset Onboarding" }).click();
  await expect(page.getByRole("button", { name: "Close setup" })).toBeVisible();
  await expect
    .poll(async () => ({
      defaultSection: await readLocalStorage(page, "ai-switch.desktop.default-section"),
      reopenSetupAssistant: await readLocalStorage(page, "ai-switch.desktop.reopen-setup-assistant"),
    }))
    .toEqual({
      defaultSection: "overview",
      reopenSetupAssistant: "true",
    });

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "set_launch_at_login")).toBe(true);
  expect(commandLog.some((entry) => entry.command === "export_diagnostic_bundle")).toBe(true);
});

test("closes the reopened setup assistant after resetting onboarding", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Reset Onboarding" }).click();

  await expect(page.getByRole("button", { name: "Close setup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Get started" }).first()).toBeVisible();
  await expect(
    page.getByText("Set up AI Switch on this computer before you switch coding-agent profiles."),
  ).toBeVisible();
  await expect
    .poll(async () => ({
      defaultSection: await readLocalStorage(page, "ai-switch.desktop.default-section"),
      reopenSetupAssistant: await readLocalStorage(page, "ai-switch.desktop.reopen-setup-assistant"),
    }))
    .toEqual({
      defaultSection: "overview",
      reopenSetupAssistant: "true",
    });

  await page.getByRole("button", { name: "Close setup" }).click();

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close setup" })).toHaveCount(0);
  await expect
    .poll(async () => readLocalStorage(page, "ai-switch.desktop.reopen-setup-assistant"))
    .toBe("false");
});

test("saves AISW home and exports the support bundle from advanced settings", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Advanced" }).click();

  const aiswHome = page.getByRole("textbox", { name: "AISW home" });
  await expect(aiswHome).toHaveValue("");

  await aiswHome.fill("/tmp/aisw-home-custom");
  await page.getByRole("button", { name: "Open App Data Folder" }).click();
  await expect(page.getByText("Opened /Users/burakdede/.local/share/ai-switcher.")).toBeVisible();
  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "update_settings" &&
          entry.args?.request?.aisw_home === "/tmp/aisw-home-custom",
      ),
    )
    .toBe(true);

  await expect(aiswHome).toHaveValue("/tmp/aisw-home-custom");

  await aiswHome.fill("");
  await page.getByRole("button", { name: "Reset Window Layout" }).click();
  await expect(page.getByText("Cleared the saved window size and position.")).toBeVisible();
  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "update_settings" && entry.args?.request?.aisw_home === null,
      ),
    )
    .toBe(true);

  await expect(aiswHome).toHaveValue("");

  await page.getByRole("button", { name: "Export Redacted Support Bundle…" }).click();
  await expect(page.getByText("Saved aisw-desktop-diagnostics-789.json.")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "open_app_data_folder")).toBe(true);
  expect(commandLog.some((entry) => entry.command === "export_diagnostic_bundle")).toBe(true);
});

test("supports arrow-key navigation in settings sections", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const settingsNav = page.locator(".settings-category-pane");
  const generalButton = settingsNav.getByRole("button", { name: "General" });
  await generalButton.focus();
  await expect(generalButton).toBeFocused();

  await generalButton.press("ArrowDown");

  const engineButton = settingsNav.getByRole("button", { name: "Engine" });
  await expect(engineButton).toBeFocused();
  await expect(engineButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Engine" })).toBeVisible();

  await engineButton.press("End");

  const advancedButton = settingsNav.getByRole("button", { name: "Advanced" });
  await expect(advancedButton).toBeFocused();
  await expect(advancedButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Advanced" })).toBeVisible();
});

test("shows runtime detection details in settings", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Engine" }).click();

  const runtimeGroup = page.locator(".settings-group").filter({ hasText: "AISW Runtime" }).first();
  await expect(runtimeGroup).toBeVisible();
  await expect(runtimeGroup.getByText("Bundled runtime")).toBeVisible();
  await expect(runtimeGroup.getByText("0.3.8", { exact: true })).toBeVisible();
  await expect(runtimeGroup.getByText("Status")).toBeVisible();
  await expect(runtimeGroup.getByText("Ready")).toBeVisible();
  await expect(runtimeGroup.getByText("Current path")).toBeVisible();
  await expect(
    runtimeGroup.getByText("/Applications/AI Switch.app/Contents/Resources/aisw"),
  ).toBeVisible();
  await expect(runtimeGroup.getByText("System runtime")).toBeVisible();
  await expect(runtimeGroup.getByText("/opt/homebrew/bin/aisw")).toBeVisible();
});

test("shows keyring guidance details in security settings", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Security" }).click();

  const securityPane = page.locator(".settings-form-pane");
  await expect(securityPane.getByText("Credential Storage")).toBeVisible();
  await expect(securityPane.getByText("macOS Keychain")).toBeVisible();
  await expect(securityPane.getByText("Available")).toBeVisible();
  await expect(securityPane.getByText("File permissions")).toBeVisible();
  await expect(securityPane.getByText("Correct")).toBeVisible();
  await expect(securityPane.getByText("Remote sync")).toBeVisible();
  await expect(securityPane.getByText("Disabled")).toHaveCount(2);
  await expect(securityPane.getByText("Telemetry")).toBeVisible();
  await expect(securityPane.getByText("Local Data")).toBeVisible();
  await expect(securityPane.getByText("~/.aisw")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal in Finder" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Redacted Report…" })).toBeVisible();
});

test("captures a profile through the OAuth flow and shows progress steps", async ({ page }) => {
  await installDesktopMock(page, "switching", {
    claude: {
      auth_methods: ["oauth", "from_live"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["system-keyring", "file"],
    },
    codex: { state_modes: ["isolated", "shared"] },
    gemini: { state_modes: [] },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("button", { name: "Add Profile" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Profile" });
  await page.evaluate(() => {
    const currentMock = (
      window as typeof window & {
        __AISW_DESKTOP_MOCK__?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
        __AISW_COMMAND_LOG__?: Array<{ command: string; args: Record<string, unknown> | null }>;
        __AISW_DESKTOP_SCENARIO_STATE__?: {
          snapshot?: {
            profiles: Record<
              string,
              { active: string | null; profiles: Array<{ name: string; auth: string; label: string | null }> }
            >;
            statuses: Array<{
              tool: string;
              binary_found: boolean;
              stored_profiles: number;
              active_profile: string | null;
              auth_method: string | null;
              credential_backend: string | null;
              state_mode: string | null;
              active_profile_applied: boolean | null;
              credentials_present: boolean;
              permissions_ok: boolean;
            }>;
          };
        };
      }
    ).__AISW_DESKTOP_MOCK__;
    if (!currentMock) {
      return;
    }

    (
      window as typeof window & {
        __AISW_DESKTOP_MOCK__?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
        __AISW_COMMAND_LOG__?: Array<{ command: string; args: Record<string, unknown> | null }>;
        __AISW_DESKTOP_SCENARIO_STATE__?: {
          snapshot?: {
            profiles: Record<
              string,
              { active: string | null; profiles: Array<{ name: string; auth: string; label: string | null }> }
            >;
            statuses: Array<{
              tool: string;
              binary_found: boolean;
              stored_profiles: number;
              active_profile: string | null;
              auth_method: string | null;
              credential_backend: string | null;
              state_mode: string | null;
              active_profile_applied: boolean | null;
              credentials_present: boolean;
              permissions_ok: boolean;
            }>;
          };
        };
      }
    ).__AISW_DESKTOP_MOCK__ = async (command, args) => {
      if (command !== "add_profile_oauth") {
        return currentMock(command, args);
      }

      (
        window as typeof window & {
          __AISW_COMMAND_LOG__?: Array<{ command: string; args: Record<string, unknown> | null }>;
        }
      ).__AISW_COMMAND_LOG__?.push({
        command,
        args: JSON.parse(JSON.stringify(args ?? null)) as Record<string, unknown> | null,
      });

      const emit = (
        window as typeof window & {
          __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
        }
      ).__AISW_DESKTOP_EVENT_HANDLERS__?.["oauth-progress"];
      emit?.({ seq: 1, phase: "browser_launch", message: "Launching browser" });
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      emit?.({ seq: 2, phase: "waiting_for_login", message: "Waiting for login" });
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const request = args?.request as
        | {
            tool?: string;
            profile?: string;
            label?: string | null;
            state_mode?: string | null;
          }
        | undefined;
      const scenarioState = (
        window as typeof window & {
          __AISW_DESKTOP_SCENARIO_STATE__?: {
            snapshot?: {
              profiles: Record<
                string,
                {
                  active: string | null;
                  profiles: Array<{ name: string; auth: string; label: string | null }>;
                }
              >;
              statuses: Array<{
                tool: string;
                binary_found: boolean;
                stored_profiles: number;
                active_profile: string | null;
                auth_method: string | null;
                credential_backend: string | null;
                state_mode: string | null;
                active_profile_applied: boolean | null;
                credentials_present: boolean;
                permissions_ok: boolean;
              }>;
            };
          };
        }
      ).__AISW_DESKTOP_SCENARIO_STATE__;

      if (!request?.tool || !request.profile || !scenarioState?.snapshot) {
        return currentMock(command, args);
      }

      const snapshot = scenarioState.snapshot;
      snapshot.profiles[request.tool] ??= { active: null, profiles: [] };
      let statusEntry = snapshot.statuses.find((entry) => entry.tool === request.tool);
      if (!statusEntry) {
        statusEntry = {
          tool: request.tool,
          binary_found: true,
          stored_profiles: 0,
          active_profile: null,
          auth_method: null,
          credential_backend: "system_keyring",
          state_mode: "isolated",
          active_profile_applied: null,
          credentials_present: false,
          permissions_ok: true,
        };
        snapshot.statuses.push(statusEntry);
      }

      snapshot.profiles[request.tool].profiles.push({
        name: request.profile,
        auth: "oauth",
        label: request.label ?? null,
      });
      snapshot.profiles[request.tool].active = request.profile;
      statusEntry.stored_profiles = snapshot.profiles[request.tool].profiles.length;
      statusEntry.active_profile = request.profile;
      statusEntry.auth_method = "oauth";
      statusEntry.active_profile_applied = true;
      statusEntry.credentials_present = true;
      statusEntry.state_mode = request.state_mode ?? statusEntry.state_mode;
      emit?.({ seq: 3, phase: "profile_saved", message: "Profile saved" });

      return {
        command,
        snapshot: await currentMock("get_snapshot"),
      };
    };
  });
  await dialog.getByLabel("Tool").selectOption("claude");
  await dialog.getByLabel("Profile name").fill("browser-login");
  await dialog.getByLabel("Import mode").selectOption("oauth");
  await dialog.getByRole("button", { name: "Start Sign In" }).click();

  await expect(dialog.getByRole("button", { name: "Waiting for sign-in…" })).toBeVisible();
  await expect(dialog.getByText("2. Browser opens")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(
    page.locator(".profiles-table-row-button").filter({ hasText: "browser-login" }).first(),
  ).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "add_profile_oauth")).toBe(true);
});

test("routes diagnostics import recovery into profile setup", async ({ page }) => {
  await installDesktopMock(page, "diagnosticFixes", {
    claude: {
      auth_methods: ["from_live", "oauth"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["system-keyring", "file"],
    },
    codex: {
      auth_methods: ["from_live", "oauth"],
      state_modes: ["isolated", "shared"],
      credential_backends: ["system-keyring", "file"],
    },
    gemini: { state_modes: [] },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Diagnostics" }).click();
  await page.getByRole("button", { name: /Inspect .*live mismatch/i }).click();
  const inspector = page.locator(".diagnostics-inspector-surface");
  await inspector.getByRole("button", { name: "More finding actions" }).click();

  const menu = page.getByRole("menu", { name: "Finding actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Import Current…" })).toBeVisible();
  await expectMenuToFitWithin(menu, inspector);
  await menu.getByRole("menuitem", { name: "Import Current…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tool")).toHaveValue("claude");
  await expect(dialog.getByLabel("Import mode")).toHaveValue("from_live");
});

test("opens matching profile details from a diagnostics quick fix", async ({ page }) => {
  await installDesktopMock(page, "diagnosticFixes");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Diagnostics" }).click();
  await expect(page.getByRole("button", { name: /Inspect .*live mismatch/i })).toBeVisible();

  await page.getByRole("button", { name: /Inspect .*live mismatch/i }).click();
  await page.getByRole("button", { name: "Open Profile Details" }).click();

  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(
    page.getByLabel("Profile filters").getByRole("button", { name: "Claude", pressed: true }),
  ).toBeVisible();
  await expect(page.locator(".profiles-inspector")).toContainText("Work");
  await expect(page.getByRole("button", { name: "Storage Details" })).toBeVisible();
  await page.getByRole("button", { name: "Storage Details" }).click();
  await expect(page.getByRole("button", { name: "Hide Storage Details" })).toBeVisible();
  await expect(page.locator(".profiles-inspector")).toContainText("Keychain");
  await expect(page.locator(".profiles-inspector")).toContainText("Needs Attention");
});

test("opens install guidance and refreshes missing-tool diagnostics", async ({ page }) => {
  await installDesktopMock(page, "missingTool");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Diagnostics" }).click();

  await expect(page.getByRole("button", { name: "Open installation guide" })).toBeVisible();
  await page.getByRole("button", { name: "Open installation guide" }).click();
  await page.getByRole("button", { name: "Refresh diagnostics" }).click();

  expect(await readOpenedGuides(page)).toContain("https://www.npmjs.com/package/@google/gemini-cli");

  const commandLog = await readCommandLog(page);
  expect(commandLog.filter((entry) => entry.command === "run_doctor").length).toBeGreaterThan(1);
  expect(commandLog.filter((entry) => entry.command === "get_snapshot").length).toBeGreaterThan(1);
});

test("opens terminal setup from diagnostics when the shell hook is inactive", async ({
  page,
}) => {
  await installDesktopMock(page, "diagnosticsRepair");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Diagnostics" }).click();
  await expect(page.getByRole("button", { name: "Inspect Shell hook not installed" })).toBeVisible();

  await page.getByRole("button", { name: "Inspect Shell hook not installed" }).click();
  await page.getByRole("button", { name: "Open terminal setup" }).click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.locator(".settings-category-pane").getByRole("button", {
      name: "Terminal Integration",
      pressed: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Detected shell")).toBeVisible();
  await expect(page.getByText("~/.zshrc")).toBeVisible();
});

test("keeps imported CLI contexts collapsed until the disclosure is opened", async ({ page }) => {
  await installDesktopMock(page, "matchingContextSet");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();

  const disclosure = page.locator(".sets-imported-disclosure");
  await expect(disclosure).toBeVisible();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(disclosure.getByRole("button", { name: "Use CLI Context Client Acme" })).toHaveCount(0);

  await disclosure.locator("summary").click();

  await expect(disclosure).toHaveAttribute("open", "");
  await expect(
    disclosure.getByText("Use an imported CLI context directly without turning it into a saved set."),
  ).toBeVisible();
  await expect(disclosure.getByRole("button", { name: "Use CLI Context Client Acme" })).toBeVisible();
});

test("uses saved profile labels in set and imported-context summaries", async ({ page }) => {
  await installDesktopMock(page, "matchingContextSet", undefined, {
    settings: {
      profile_labels: {
        claude: { work: "Office" },
        codex: { work: "Code Work" },
      },
    },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();

  await expect(page.getByText("2 profiles mapped")).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Inspect set Client Acme", exact: true })
      .locator(".sets-library-row-summary"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Inspect set Client Acme", exact: true })
      .locator(".sets-library-row-summary"),
  ).toContainText("Claude: Office · Codex: Code Work · Gemini: — · Antigravity: —");

  const disclosure = page.locator(".sets-imported-disclosure");
  await disclosure.locator("summary").click();
  await expect(
    disclosure.locator(".sets-cli-row .sets-library-row-summary"),
  ).toBeVisible();
  await expect(disclosure.locator(".sets-cli-row .sets-library-row-summary")).toContainText(
    "Claude: Office · Codex: Code Work · Gemini: — · Antigravity: —",
  );

  await page.getByRole("button", { name: "New Set…" }).click();
  const dialog = page.getByRole("dialog", { name: "New Set" });
  await expect(dialog).toBeVisible();
  const dialogOptions = await dialog.locator("option").allTextContents();
  expect(dialogOptions).toContain("Office");
  expect(dialogOptions).toContain("Code Work");
});

test("activates an imported CLI context and marks it current", async ({ page }) => {
  await installDesktopMock(page, "matchingContextSet");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();

  const importedDisclosure = page.locator(".sets-imported-disclosure");
  await importedDisclosure.locator("summary").click();
  await importedDisclosure.getByRole("button", { name: "Use CLI Context Client Acme" }).click();
  await expect(importedDisclosure.getByRole("button", { name: "Current" })).toBeDisabled();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "use_context" &&
        entry.args?.request?.context === "client-acme",
    ),
  ).toBe(true);
});

test("uses the saved set label in imported CLI context activation results", async ({ page }) => {
  await installDesktopMock(page, "matchingContextSet");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();

  const importedDisclosure = page.locator(".sets-imported-disclosure");
  await importedDisclosure.locator("summary").click();
  await importedDisclosure.getByRole("button", { name: "Use CLI Context Client Acme" }).click();

  await expect(page.getByText("Last set result: Activated set Client Acme.")).toBeVisible();
});

test("shows workspace mismatch details and activates the expected set", async ({
  page,
}) => {
  await installDesktopMock(page, "workspaceContext", undefined, {
    settings: {
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();

  await expect(page.getByText("Project mismatch")).toBeVisible();
  await expect(page.getByText("Expected set: Client Acme")).toBeVisible();
  await expect(page.getByText("Current set: work")).toBeVisible();
  await expect(page.getByText("Matched by this folder rule: /code/acme")).toBeVisible();

  await page.getByRole("button", { name: "Use Expected Set" }).click();

  await expect(page.getByText("Last project-rule result: Switched to Client Acme for /code/acme.")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(
    commandLog.some(
      (entry) =>
        entry.command === "activate_profile_set" && entry.args?.name === "client-acme",
    ),
  ).toBe(true);
});

test("dismisses the workspace mismatch banner without switching sets", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext", undefined, {
    settings: {
      profile_sets: [
        {
          name: "client-acme",
          label: "Client Acme",
          profiles: { claude: "work", codex: "work", gemini: null },
        },
      ],
    },
  });

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();

  await expect(page.getByText("Project mismatch")).toBeVisible();
  await page.getByRole("button", { name: "Keep current set" }).click();

  await expect(page.getByText("Project mismatch")).toHaveCount(0);
  await expect(page.getByText("Expected set: Client Acme")).toHaveCount(0);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "activate_profile_set")).toBe(false);
  expect(commandLog.some((entry) => entry.command === "use_context")).toBe(false);
});

test("excludes duplicate imported CLI contexts from project-rule options when a saved set exists", async ({
  page,
}) => {
  await installDesktopMock(page, "matchingContextSet");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();
  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  await page.getByRole("button", { name: "Add Rule…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Rule" });
  const dialogOptions = await dialog.locator("option").allTextContents();
  expect(dialogOptions).toContain("Saved set: Client Acme");
  expect(dialogOptions).not.toContain("Detected set: client-acme");
});

test("marks the matched project rule for the current workspace", async ({ page }) => {
  await installDesktopMock(page, "workspaceContext");

  await page.goto("/");
  await page.locator(".sidebar").getByRole("button", { name: "Sets", exact: true }).click();

  await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
  const matchedRule = page.locator(".sets-rule-table-row").filter({ hasText: "/code/acme" }).first();
  await expect(matchedRule).toContainText("Active");
  await matchedRule.click();
  await expect(page.locator(".sets-rules-inspector")).toContainText("Current project");
});

test("drops the saved custom engine path when switching back to the bundled engine", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", undefined, {
    settings: {
      runtime_kind: "custom",
      runtime_path: "/opt/aisw/bin/aisw",
    },
    runtime_status: {
      resolved_path: "/opt/aisw/bin/aisw",
      inventory: {
        configured_path: "/opt/aisw/bin/aisw",
      },
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Engine" }).click();

  const runtimeSource = page.getByLabel("Runtime source");
  const runtimePath = page.getByLabel("Engine path");
  await expect(runtimeSource).toHaveValue("custom");
  await expect(runtimePath).toHaveValue("/opt/aisw/bin/aisw");
  await expect(runtimePath).toBeEnabled();

  await runtimeSource.selectOption("bundled");

  await expect(runtimeSource).toHaveValue("bundled");
  await expect(runtimePath).toBeDisabled();
  await expect(runtimePath).toHaveValue("");
  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "update_settings" &&
          entry.args?.request?.runtime_kind === "bundled" &&
          entry.args?.request?.runtime_path === null,
      ),
    )
    .toBe(true);
});

test("saves a custom engine path and opens the local data folder from runtime settings", async ({
  page,
}) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Engine" }).click();

  const runtimeSource = page.getByLabel("Runtime source");
  const runtimePath = page.getByLabel("Engine path");

  await expect(runtimeSource).toHaveValue("bundled");
  await expect(runtimePath).toBeDisabled();
  await expect(runtimePath).toHaveValue("");

  await runtimeSource.selectOption("custom");
  await expect(runtimeSource).toHaveValue("custom");
  await expect(runtimePath).toBeEnabled();

  await runtimePath.fill("/opt/custom/bin/aisw");
  await page.getByRole("button", { name: "Reveal in Finder" }).click();

  await expect(page.getByText("Opened /Users/burakdede/.local/share/ai-switcher.")).toBeVisible();
  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "update_settings" &&
          entry.args?.request?.runtime_kind === "custom" &&
          entry.args?.request?.runtime_path === "/opt/custom/bin/aisw",
      ),
    )
    .toBe(true);

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "open_app_data_folder")).toBe(true);
});

test("drops the saved custom engine path when switching to the system engine", async ({
  page,
}) => {
  await installDesktopMock(page, "switching", undefined, {
    settings: {
      runtime_kind: "custom",
      runtime_path: "/opt/aisw/bin/aisw",
    },
    runtime_status: {
      resolved_path: "/opt/aisw/bin/aisw",
      inventory: {
        configured_path: "/opt/aisw/bin/aisw",
      },
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator(".settings-category-pane").getByRole("button", { name: "Engine" }).click();

  const runtimeSource = page.getByLabel("Runtime source");
  const runtimePath = page.getByLabel("Engine path");
  await expect(runtimeSource).toHaveValue("custom");
  await expect(runtimePath).toHaveValue("/opt/aisw/bin/aisw");
  await expect(runtimePath).toBeEnabled();

  await runtimeSource.selectOption("system");

  await expect(runtimeSource).toHaveValue("system");
  await expect(runtimePath).toBeDisabled();
  await expect(runtimePath).toHaveValue("");
  await expect
    .poll(async () =>
      (await readCommandLog(page)).some(
        (entry) =>
          entry.command === "update_settings" &&
          entry.args?.request?.runtime_kind === "system" &&
          entry.args?.request?.runtime_path === null,
      ),
    )
    .toBe(true);
});

async function expectMenuToFitWithin(menu: Locator, container: Locator) {
  await expect
    .poll(async () => (await menu.boundingBox())?.x ?? 0)
    .toBeGreaterThan(0);

  const menuBox = await menu.boundingBox();
  const containerBox = await container.boundingBox();

  expect(menuBox).not.toBeNull();
  expect(containerBox).not.toBeNull();

  expect(menuBox!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 1);
  expect(menuBox!.y).toBeGreaterThanOrEqual(containerBox!.y - 1);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(containerBox!.y + containerBox!.height + 1);
}

async function expectMenuToFitViewport(menu: Locator, page: Page) {
  await expect
    .poll(async () => (await menu.boundingBox())?.x ?? 0)
    .toBeGreaterThan(0);

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.y).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function dispatchDesktopEvent(
  page: Page,
  eventName: string,
  payload: Record<string, unknown> = {},
) {
  await page.waitForFunction(
    (name) =>
      Boolean(
        (
          window as typeof window & {
            __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
          }
        ).__AISW_DESKTOP_EVENT_HANDLERS__?.[name],
      ),
    eventName,
  );
  await page.evaluate(
    ({ name, eventPayload }) => {
      (
        window as typeof window & {
          __AISW_DESKTOP_EVENT_HANDLERS__?: Record<string, (payload: unknown) => void>;
        }
      ).__AISW_DESKTOP_EVENT_HANDLERS__?.[name]?.(eventPayload);
    },
    { name: eventName, eventPayload: payload },
  );
}

async function overrideDesktopCommand(
  page: Page,
  commandName: string,
  options: { result?: unknown; error?: Record<string, unknown> },
) {
  await page.evaluate(
    ({ name, result, error }) => {
      const currentMock = (
        window as typeof window & {
          __AISW_DESKTOP_MOCK__?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        }
      ).__AISW_DESKTOP_MOCK__;
      if (!currentMock) {
        return;
      }

      (
        window as typeof window & {
          __AISW_DESKTOP_MOCK__?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        }
      ).__AISW_DESKTOP_MOCK__ = async (command, args) => {
        if (command === name) {
          const commandLog = (
            window as typeof window & {
              __AISW_COMMAND_LOG__?: Array<{ command: string; args?: Record<string, unknown> | null }>;
            }
          ).__AISW_COMMAND_LOG__;
          commandLog?.push({ command, args: args ?? null });
          if (error) {
            throw error;
          }
          return result;
        }

        return currentMock(command, args);
      };
    },
    {
      name: commandName,
      result: options.result ?? null,
      error: options.error ?? null,
    },
  );
}

async function readCommandLog(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __AISW_COMMAND_LOG__?: Array<{ command: string; args?: Record<string, unknown> }>;
        }
      ).__AISW_COMMAND_LOG__ ?? [],
  );
}

async function expectCommandCount(page: Page, commandName: string) {
  const commandLog = await readCommandLog(page);
  return commandLog.filter((entry) => entry.command === commandName).length;
}

async function readClipboardWrites(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __AISW_CLIPBOARD_WRITES__?: string[];
        }
      ).__AISW_CLIPBOARD_WRITES__ ?? [],
  );
}

async function readNotifications(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __AISW_NOTIFICATIONS__?: Array<{ title?: string; body?: string }>;
        }
      ).__AISW_NOTIFICATIONS__ ?? [],
  );
}

async function readLocalStorage(page: Page, key: string) {
  return page.evaluate((storageKey) => window.localStorage.getItem(storageKey), key);
}

async function readOpenedGuides(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __AISW_OPENED_GUIDES__?: string[];
        }
      ).__AISW_OPENED_GUIDES__ ?? [],
  );
}
