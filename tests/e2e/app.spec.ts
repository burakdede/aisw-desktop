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

async function expectMenuToFitWithin(menu: Locator, container: Locator) {
  const menuBox = await menu.boundingBox();
  const containerBox = await container.boundingBox();

  expect(menuBox).not.toBeNull();
  expect(containerBox).not.toBeNull();

  expect(menuBox!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 1);
  expect(menuBox!.y).toBeGreaterThanOrEqual(containerBox!.y - 1);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(containerBox!.y + containerBox!.height + 1);
}
