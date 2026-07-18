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
