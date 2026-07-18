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

test("opens quick switch from the app menu and focuses search", async ({ page }) => {
  await installDesktopMock(page, "switching");

  await page.goto("/");
  await dispatchDesktopEvent(page, "menu-open-quick-switch");

  const dialog = page.getByRole("dialog", { name: "Quick Switch" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Search Quick Switch")).toBeFocused();
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
  await page.getByRole("menuitem", { name: "Export Report" }).click();

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
  await page.getByRole("menuitem", { name: "Export Redacted Activity…" }).click();
  await expect(page.getByText("Opened aisw-desktop-activity-123.json.")).toBeVisible();

  await page.getByRole("button", { name: "Activity more actions" }).click();
  await page.getByRole("menuitem", { name: "Clear Activity History…" }).click();

  const clearDialog = page.getByRole("dialog", { name: "Clear Activity History" });
  await clearDialog.getByRole("button", { name: "Clear History" }).click();
  await expect(clearDialog).toBeHidden();
  await expect(page.getByText("No recent activity")).toBeVisible();

  const commandLog = await readCommandLog(page);
  expect(commandLog.some((entry) => entry.command === "export_activity_log")).toBe(true);
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
  await dialog.getByLabel("Tool").selectOption("claude");
  await dialog.getByLabel("Profile name").fill("browser-login");
  await dialog.getByLabel("Import mode").selectOption("oauth");
  await dialog.getByRole("button", { name: "Start Sign In" }).click();

  await expect(dialog.getByText("2. Browser opens")).toBeVisible();
  await expect(dialog.getByText("5. Profile saved")).toBeVisible();
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
  await page.getByRole("button", { name: "More finding actions" }).click();
  await page.getByRole("menuitem", { name: "Import Current…" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Profile" });
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tool")).toHaveValue("claude");
  await expect(dialog.getByLabel("Import mode")).toHaveValue("from_live");
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
