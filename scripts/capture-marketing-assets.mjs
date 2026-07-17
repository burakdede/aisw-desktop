import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const repoRoot = process.cwd();
const marketingSiteRoot = path.resolve(repoRoot, "../aiswitcher-dev");
const mediaDir = path.join(marketingSiteRoot, "public/media");
const tempDir = path.join(repoRoot, ".tmp/marketing-capture");
const videoDir = path.join(tempDir, "videos");
const frameDir = path.join(tempDir, "frames");
const host = "127.0.0.1";
const port = 4329;
const baseUrl = `http://${host}:${port}/marketing-capture.html`;
const SCREENSHOT_VIEWPORT = { width: 1600, height: 1100 };
const GIF_VIEWPORT = { width: 1440, height: 980 };
const DEVICE_SCALE_FACTOR = 2;
const CAPTURE_COLOR_SCHEME = "light";
const DEFAULT_SCREENSHOT_SETTLE_MS = 250;
const WORKSPACE_RULES_SETTLE_MS = 300;
const SERVER_READY_TIMEOUT_MS = 30_000;
const SERVER_READY_POLL_MS = 250;
const GIF_FPS = 18;
const GIF_LOOP = "0";
const OVERLAY_BOTTOM_OFFSET_PX = 24;
const OVERLAY_CARD_SIZE = { width: 640, height: 104 };
const OVERLAY_CARD_FRAME = {
  left: 1,
  top: 1,
  right: 638,
  bottom: 102,
  radius: 24,
};
const OVERLAY_TITLE = {
  font: "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  pointSize: 36,
  offsetY: 14,
  color: "#ffffff",
};
const OVERLAY_DETAIL = {
  font: "/System/Library/Fonts/Supplemental/Arial.ttf",
  pointSize: 24,
  offsetY: 56,
  color: "#f3f6fb",
  interlineSpacing: 4,
};
const OVERLAY_CARD_COLORS = {
  fill: "rgba(14,18,26,0.94)",
  stroke: "rgba(115,153,255,0.28)",
  strokeWidth: "2",
};
const QUICK_SWITCH_CAPTURE = {
  openDelayMs: 700,
  searchReadyDelayMs: 450,
  typingDelayMs: 120,
  afterSearchDelayMs: 650,
  afterSubmitDelayMs: 1200,
  trimStartSeconds: 0.45,
  searchText: "personal",
};
const WORKSPACE_SWITCH_CAPTURE = {
  initialDelayMs: 650,
  rulePanelDelayMs: 900,
  afterSwitchDelayMs: 1300,
  trimStartSeconds: 0.85,
};

async function main() {
  await fs.mkdir(mediaDir, { recursive: true });
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(videoDir, { recursive: true });
  await fs.mkdir(frameDir, { recursive: true });

  const server = spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      BROWSER: "none",
    },
  });

  try {
    server.stdout.on("data", (chunk) => process.stdout.write(chunk));
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));

    await waitForServer(`${baseUrl}?scene=overview&nav=overview`);

    const browser = await chromium.launch({
      headless: true,
      args: ["--force-device-scale-factor=2"],
    });

    try {
      await captureScreenshots(browser);
      await captureGifs(browser);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
}

async function captureScreenshots(browser) {
  await withPage(browser, async (page) => {
    await openScene(page, { scene: "overview", nav: "overview" });
    await waitForApp(page, "Overview");
    await screenshotApp(page, "desktop-overview-hero.png");

    await page.getByRole("button", { name: "Inspect Codex" }).click();
    await waitForUiSettle(page);
    await screenshotApp(page, "desktop-current-state.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "profiles", nav: "profiles" });
    await waitForApp(page, "Profiles");
    await page.getByRole("option", { name: "Inspect Codex CLI Release Review" }).click();
    await waitForUiSettle(page);
    await screenshotApp(page, "desktop-profiles.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "sets", nav: "sets" });
    await waitForApp(page, "Sets");
    await page.getByRole("button", { name: "Inspect set Release Review" }).click();
    await waitForUiSettle(page);
    await screenshotApp(page, "desktop-sets.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "workspace", nav: "sets" });
    await waitForApp(page, "Sets");
    await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
    await page.getByRole("button", { name: "Inspect rule for Acme Product" }).first().click();
    await waitForUiSettle(page, WORKSPACE_RULES_SETTLE_MS);
    await screenshotApp(page, "desktop-workspace-rules.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "diagnostics", nav: "diagnostics" });
    await waitForApp(page, "Diagnostics");
    await page.getByRole("button", { name: "Inspect Keyring unavailable" }).click();
    await waitForUiSettle(page);
    await screenshotApp(page, "desktop-diagnostics.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "operations", nav: "backups" });
    await waitForApp(page, "Backups");
    await waitForUiSettle(page);
    await screenshotApp(page, "desktop-backups.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "operations", nav: "activity" });
    await waitForApp(page, "Activity");
    await waitForUiSettle(page);
    await screenshotApp(page, "desktop-activity.png");
  });
}

async function captureGifs(browser) {
  await captureQuickSwitchGif(browser);
  await captureWorkspaceSwitchGif(browser);
}

async function captureQuickSwitchGif(browser) {
  const videoPath = await withRecordedPage(
    browser,
    "quick-switch",
    async (page) => {
      await openScene(page, { scene: "overview", nav: "overview" });
      await waitForApp(page, "Overview");
      await waitForUiSettle(page, QUICK_SWITCH_CAPTURE.openDelayMs);
      await page.keyboard.press("Meta+K");
      await page.waitForSelector('[role="dialog"][aria-label="Quick Switch"]');
      await waitForUiSettle(page, QUICK_SWITCH_CAPTURE.searchReadyDelayMs);
      await page
        .getByLabel("Search Quick Switch")
        .type(QUICK_SWITCH_CAPTURE.searchText, { delay: QUICK_SWITCH_CAPTURE.typingDelayMs });
      await waitForUiSettle(page, QUICK_SWITCH_CAPTURE.afterSearchDelayMs);
      await page.keyboard.press("Enter");
      await waitForUiSettle(page, QUICK_SWITCH_CAPTURE.afterSubmitDelayMs);
    },
  );

  await transcodeGif(
    videoPath,
    path.join(mediaDir, "desktop-quick-switch.gif"),
    {
      title: "Quick switch",
      detail: "Type. Arrow down. Press Enter.",
      trimStartSeconds: QUICK_SWITCH_CAPTURE.trimStartSeconds,
    },
  );
}

async function captureWorkspaceSwitchGif(browser) {
  const videoPath = await withRecordedPage(
    browser,
    "workspace-switch",
    async (page) => {
      await openScene(page, { scene: "workspace", nav: "sets" });
      await waitForApp(page, "Sets");
      await waitForUiSettle(page, WORKSPACE_SWITCH_CAPTURE.initialDelayMs);
      await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
      await waitForUiSettle(page, WORKSPACE_SWITCH_CAPTURE.rulePanelDelayMs);
      await page.getByRole("button", { name: "Use Expected Set" }).click();
      await waitForUiSettle(page, WORKSPACE_SWITCH_CAPTURE.afterSwitchDelayMs);
    },
  );

  await transcodeGif(
    videoPath,
    path.join(mediaDir, "desktop-workspace-switch.gif"),
    {
      title: "Workspace restore",
      detail: "Apply the expected set for this repo.",
      trimStartSeconds: WORKSPACE_SWITCH_CAPTURE.trimStartSeconds,
    },
  );
}

async function withPage(browser, callback) {
  const context = await browser.newContext({
    viewport: SCREENSHOT_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: CAPTURE_COLOR_SCHEME,
  });
  const page = await context.newPage();

  try {
    await callback(page);
  } finally {
    await context.close();
  }
}

async function withRecordedPage(browser, name, callback) {
  const context = await browser.newContext({
    viewport: GIF_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: CAPTURE_COLOR_SCHEME,
    recordVideo: {
      dir: videoDir,
      size: GIF_VIEWPORT,
    },
  });
  const page = await context.newPage();

  try {
    await callback(page);
    const video = page.video();
    if (!video) {
      throw new Error(`Video recording did not start for ${name}.`);
    }
    await context.close();
    return await video.path();
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function openScene(page, { scene, nav }) {
  const url = `${baseUrl}?scene=${scene}&nav=${nav}`;
  await page.goto(url, { waitUntil: "networkidle" });
}

async function waitForApp(page, heading) {
  await page.locator(".app-shell").waitFor({ state: "visible" });
  await page.getByRole("heading", { name: heading }).waitFor({ state: "visible" });
}

async function waitForUiSettle(page, delayMs = DEFAULT_SCREENSHOT_SETTLE_MS) {
  await page.waitForTimeout(delayMs);
}

async function screenshotApp(page, filename) {
  const appShell = page.locator(".app-shell").first();
  await appShell.screenshot({
    path: path.join(mediaDir, filename),
    type: "png",
  });
}

async function transcodeGif(videoPath, outputPath, overlay) {
  const baseName = path.basename(outputPath, ".gif");
  const palettePath = path.join(frameDir, `${baseName}-palette.png`);
  const overlayPngPath = path.join(frameDir, `${baseName}-overlay.png`);
  const trimStart = String(overlay.trimStartSeconds ?? 0);

  await renderOverlayCard(overlayPngPath, overlay);

  await runCommand("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-ss",
    trimStart,
    "-i",
    videoPath,
    "-i",
    overlayPngPath,
    "-filter_complex",
    `[0:v][1:v]overlay=(main_w-overlay_w)/2:main_h-overlay_h-${OVERLAY_BOTTOM_OFFSET_PX},fps=${GIF_FPS},scale=${GIF_VIEWPORT.width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    "-frames:v",
    "1",
    "-update",
    "1",
    palettePath,
  ]);
  await runCommand("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-ss",
    trimStart,
    "-i",
    videoPath,
    "-i",
    overlayPngPath,
    "-i",
    palettePath,
    "-loop",
    GIF_LOOP,
    "-filter_complex",
    `[0:v][1:v]overlay=(main_w-overlay_w)/2:main_h-overlay_h-${OVERLAY_BOTTOM_OFFSET_PX},fps=${GIF_FPS},scale=${GIF_VIEWPORT.width}:-1:flags=lanczos[x];[x][2:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    outputPath,
  ]);
}

async function renderOverlayCard(pngPath, { title, detail }) {
  await runCommand("/opt/homebrew/bin/magick", [
    "-size",
    `${OVERLAY_CARD_SIZE.width}x${OVERLAY_CARD_SIZE.height}`,
    "xc:none",
    "-fill",
    OVERLAY_CARD_COLORS.fill,
    "-stroke",
    OVERLAY_CARD_COLORS.stroke,
    "-strokewidth",
    OVERLAY_CARD_COLORS.strokeWidth,
    "-draw",
    `roundrectangle ${OVERLAY_CARD_FRAME.left},${OVERLAY_CARD_FRAME.top} ${OVERLAY_CARD_FRAME.right},${OVERLAY_CARD_FRAME.bottom} ${OVERLAY_CARD_FRAME.radius},${OVERLAY_CARD_FRAME.radius}`,
    "-font",
    OVERLAY_TITLE.font,
    "-fill",
    OVERLAY_TITLE.color,
    "-pointsize",
    String(OVERLAY_TITLE.pointSize),
    "-gravity",
    "north",
    "-annotate",
    `+0+${OVERLAY_TITLE.offsetY}`,
    title,
    "-font",
    OVERLAY_DETAIL.font,
    "-fill",
    OVERLAY_DETAIL.color,
    "-pointsize",
    String(OVERLAY_DETAIL.pointSize),
    "-interline-spacing",
    String(OVERLAY_DETAIL.interlineSpacing),
    "-gravity",
    "north",
    "-annotate",
    `+0+${OVERLAY_DETAIL.offsetY}`,
    detail.replace(/\\n/g, "\n"),
    pngPath,
  ]);
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore until Vite is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, SERVER_READY_POLL_MS));
  }
  throw new Error("Timed out waiting for the marketing capture server.");
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";

    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

await main();
