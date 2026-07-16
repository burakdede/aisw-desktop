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
    await page.waitForTimeout(250);
    await screenshotApp(page, "desktop-current-state.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "profiles", nav: "profiles" });
    await waitForApp(page, "Profiles");
    await page.getByRole("option", { name: "Inspect Codex CLI Release Review" }).click();
    await page.waitForTimeout(250);
    await screenshotApp(page, "desktop-profiles.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "sets", nav: "sets" });
    await waitForApp(page, "Sets");
    await page.getByRole("button", { name: "Inspect set Release Review" }).click();
    await page.waitForTimeout(250);
    await screenshotApp(page, "desktop-sets.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "workspace", nav: "sets" });
    await waitForApp(page, "Sets");
    await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
    await page.getByRole("button", { name: "Inspect rule for Acme Product" }).first().click();
    await page.waitForTimeout(300);
    await screenshotApp(page, "desktop-workspace-rules.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "diagnostics", nav: "diagnostics" });
    await waitForApp(page, "Diagnostics");
    await page.getByRole("button", { name: "Inspect Keyring unavailable" }).click();
    await page.waitForTimeout(250);
    await screenshotApp(page, "desktop-diagnostics.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "operations", nav: "backups" });
    await waitForApp(page, "Backups");
    await page.waitForTimeout(250);
    await screenshotApp(page, "desktop-backups.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "operations", nav: "activity" });
    await waitForApp(page, "Activity");
    await page.waitForTimeout(250);
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
      await page.waitForTimeout(700);
      await page.keyboard.press("Meta+K");
      await page.waitForSelector('[role="dialog"][aria-label="Quick Switch"]');
      await page.waitForTimeout(450);
      await page.getByLabel("Search Quick Switch").type("personal", { delay: 120 });
      await page.waitForTimeout(650);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1200);
    },
  );

  await transcodeGif(
    videoPath,
    path.join(mediaDir, "desktop-quick-switch.gif"),
    {
      title: "Quick Switch",
      detail: "Command-K. Type a profile. Press Enter.",
      trimStartSeconds: 0.45,
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
      await page.waitForTimeout(650);
      await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: "Use Expected Set" }).click();
      await page.waitForTimeout(1300);
    },
  );

  await transcodeGif(
    videoPath,
    path.join(mediaDir, "desktop-workspace-switch.gif"),
    {
      title: "Project Rules",
      detail: "Use Expected Set to restore this repository context.",
      trimStartSeconds: 0.85,
    },
  );
}

async function withPage(browser, callback) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 2,
    colorScheme: "light",
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
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    recordVideo: {
      dir: videoDir,
      size: { width: 1440, height: 980 },
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
    "[0:v][1:v]overlay=(main_w-overlay_w)/2:main_h-overlay_h-32,fps=18,scale=1440:-1:flags=lanczos,palettegen=stats_mode=diff",
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
    "0",
    "-filter_complex",
    "[0:v][1:v]overlay=(main_w-overlay_w)/2:main_h-overlay_h-32,fps=18,scale=1440:-1:flags=lanczos[x];[x][2:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    outputPath,
  ]);
}

async function renderOverlayCard(pngPath, { title, detail }) {
  await runCommand("/opt/homebrew/bin/magick", [
    "-size",
    "920x148",
    "xc:none",
    "-fill",
    "rgba(18,20,27,0.9)",
    "-stroke",
    "rgba(255,255,255,0.18)",
    "-strokewidth",
    "2",
    "-draw",
    "roundrectangle 1,1 918,146 28,28",
    "-font",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "-fill",
    "#ffffff",
    "-pointsize",
    "44",
    "-gravity",
    "north",
    "-annotate",
    "+0+22",
    title,
    "-font",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "-fill",
    "#f4f6fb",
    "-pointsize",
    "28",
    "-interline-spacing",
    "6",
    "-gravity",
    "north",
    "-annotate",
    "+0+78",
    detail.replace(/\\n/g, "\n"),
    pngPath,
  ]);
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore until Vite is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
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
