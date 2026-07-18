import type { UpdateCheckReport } from "./schemas";
import { resolveBrowserStorage } from "./browser-storage";
import { hasTrimmedText } from "./utils";

export const DESKTOP_UPDATE_STORAGE_KEYS = {
  dismissedVersion: "ai-switch.desktop.update-dismissed-version",
  lastCheckedAt: "ai-switch.desktop.update-last-checked-at",
} as const;

export const AUTOMATIC_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function loadDismissedUpdateVersion() {
  return getStorage()?.getItem(DESKTOP_UPDATE_STORAGE_KEYS.dismissedVersion) ?? null;
}

export function saveDismissedUpdateVersion(version: string | null) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (version) {
    storage.setItem(DESKTOP_UPDATE_STORAGE_KEYS.dismissedVersion, version);
    return;
  }

  storage.removeItem(DESKTOP_UPDATE_STORAGE_KEYS.dismissedVersion);
}

export function loadLastAutomaticUpdateCheckAt() {
  const raw = getStorage()?.getItem(DESKTOP_UPDATE_STORAGE_KEYS.lastCheckedAt);
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function saveLastAutomaticUpdateCheckAt(timestamp: number) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(DESKTOP_UPDATE_STORAGE_KEYS.lastCheckedAt, String(timestamp));
}

export function automaticUpdateCheckDue(
  lastCheckedAt: number | null,
  now = Date.now(),
) {
  if (lastCheckedAt === null) {
    return true;
  }

  return now - lastCheckedAt >= AUTOMATIC_UPDATE_CHECK_INTERVAL_MS;
}

export function updateAnnouncementTitle(version: string) {
  return `AI Switcher ${version} is available`;
}

export function updateAnnouncementBody(report: Pick<UpdateCheckReport, "update">) {
  const notes = report.update?.notes?.trim();
  if (hasTrimmedText(notes)) {
    return notes;
  }

  return "New fixes and improvements are ready. Download the signed update and restart when prompted.";
}

function getStorage() {
  return resolveBrowserStorage();
}
