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

    await page.getByRole("button", { name: "Inspect Codex CLI" }).click();
    await page.waitForTimeout(250);
    await screenshotApp(page, "desktop-current-state.png");
  });

  await withPage(browser, async (page) => {
    await openScene(page, { scene: "profiles", nav: "profiles" });
    await waitForApp(page, "Profiles");
    await page.getByRole("row", { name: /Release Review/i }).first().click();
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
    await page.getByRole("button", { name: "Inspect rule for Acme Product" }).click();
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
      await page.waitForTimeout(300);
      await page.keyboard.press("Meta+K");
      await page.waitForSelector('[role="dialog"][aria-label="Quick Switch"]');
      await page.getByLabel("Search Quick Switch").fill("personal");
      await page.waitForTimeout(300);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(250);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
    },
  );

  await transcodeGif(videoPath, path.join(mediaDir, "desktop-quick-switch.gif"));
}

async function captureWorkspaceSwitchGif(browser) {
  const videoPath = await withRecordedPage(
    browser,
    "workspace-switch",
    async (page) => {
      await openScene(page, { scene: "workspace", nav: "sets" });
      await waitForApp(page, "Sets");
      await page.getByLabel("Sets mode").getByRole("button", { name: "Project Rules" }).click();
      await page.waitForTimeout(350);
      await page.getByRole("button", { name: "Use Expected Set" }).click();
      await page.waitForTimeout(900);
    },
  );

  await transcodeGif(videoPath, path.join(mediaDir, "desktop-workspace-switch.gif"));
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

async function transcodeGif(videoPath, outputPath) {
  const palettePath = path.join(frameDir, `${path.basename(outputPath, ".gif")}-palette.png`);
  await runCommand("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    "fps=15,scale=1440:-1:flags=lanczos,palettegen=stats_mode=diff",
    palettePath,
  ]);
  await runCommand("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-i",
    palettePath,
    "-lavfi",
    "fps=15,scale=1440:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    outputPath,
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
