import {
  APP_NAV_IDS,
  DEFAULT_APP_SECTIONS,
  type DefaultAppSection,
} from "./app-navigation";
import { hasDesktopRuntime } from "./runtime-environment";
import { isOneOf } from "./parse-guards";
import { resolveBrowserStorage, type BrowserStorage } from "./browser-storage";

export const DESKTOP_APPEARANCES = ["system", "light", "dark"] as const;
export type DesktopAppearance = (typeof DESKTOP_APPEARANCES)[number];

export const DEFAULT_SECTIONS = DEFAULT_APP_SECTIONS;
export type DefaultSection = DefaultAppSection;

export type DesktopPreferences = {
  appearance: DesktopAppearance;
  defaultSection: DefaultSection;
  showMenuBarIcon: boolean;
  restoreWindowState: boolean;
  reopenSetupAssistant: boolean;
};

export const DESKTOP_PREFERENCE_STORAGE_KEYS = {
  appearance: "ai-switch.desktop.appearance",
  defaultSection: "ai-switch.desktop.default-section",
  showMenuBarIcon: "ai-switch.desktop.show-menu-bar-icon",
  restoreWindowState: "ai-switch.desktop.restore-window-state",
  reopenSetupAssistant: "ai-switch.desktop.reopen-setup-assistant",
} as const;

const memoryStorage = createMemoryStorage();
let nativeThemeSyncToken = 0;

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  appearance: "system",
  defaultSection: APP_NAV_IDS.overview,
  showMenuBarIcon: true,
  restoreWindowState: true,
  reopenSetupAssistant: false,
};

export function loadDesktopPreferences(): DesktopPreferences {
  const storage = getStorage();
  if (!storage) {
    return DEFAULT_DESKTOP_PREFERENCES;
  }

  const storedAppearance = storage.getItem(DESKTOP_PREFERENCE_STORAGE_KEYS.appearance);
  const storedSection = storage.getItem(DESKTOP_PREFERENCE_STORAGE_KEYS.defaultSection);
  const storedShowMenuBarIcon = storage.getItem(DESKTOP_PREFERENCE_STORAGE_KEYS.showMenuBarIcon);
  const storedRestoreWindowState = storage.getItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.restoreWindowState,
  );
  const storedReopenSetupAssistant = storage.getItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.reopenSetupAssistant,
  );

  return {
    appearance: normalizeDesktopAppearance(storedAppearance),
    defaultSection: normalizeDefaultSection(storedSection),
    showMenuBarIcon:
      storedShowMenuBarIcon === null
        ? DEFAULT_DESKTOP_PREFERENCES.showMenuBarIcon
        : storedShowMenuBarIcon === "true",
    restoreWindowState:
      storedRestoreWindowState === null
        ? DEFAULT_DESKTOP_PREFERENCES.restoreWindowState
        : storedRestoreWindowState === "true",
    reopenSetupAssistant:
      storedReopenSetupAssistant === null
        ? DEFAULT_DESKTOP_PREFERENCES.reopenSetupAssistant
        : storedReopenSetupAssistant === "true",
  };
}

export function saveDesktopPreferences(preferences: DesktopPreferences) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(DESKTOP_PREFERENCE_STORAGE_KEYS.appearance, preferences.appearance);
  storage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.defaultSection,
    preferences.defaultSection,
  );
  storage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.showMenuBarIcon,
    String(preferences.showMenuBarIcon),
  );
  storage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.restoreWindowState,
    String(preferences.restoreWindowState),
  );
  storage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.reopenSetupAssistant,
    String(preferences.reopenSetupAssistant),
  );
}

export function applyAppearancePreference(appearance: DesktopAppearance) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.appearance = appearance;
  root.style.colorScheme = appearance === "system" ? "light dark" : appearance;
  void syncNativeWindowTheme(appearance);
}

export function normalizeDesktopAppearance(
  value: unknown,
  fallback: DesktopAppearance = DEFAULT_DESKTOP_PREFERENCES.appearance,
): DesktopAppearance {
  return isOneOf(DESKTOP_APPEARANCES, value) ? value : fallback;
}

export function normalizeDefaultSection(
  value: unknown,
  fallback: DefaultSection = DEFAULT_DESKTOP_PREFERENCES.defaultSection,
): DefaultSection {
  return isOneOf(DEFAULT_SECTIONS, value) ? value : fallback;
}

function getStorage(): Pick<Storage, "getItem" | "setItem" | "clear" | "removeItem"> | null {
  return resolveBrowserStorage(memoryStorage);
}

function createMemoryStorage(): BrowserStorage {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    clear() {
      values.clear();
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

async function syncNativeWindowTheme(appearance: DesktopAppearance) {
  if (!hasDesktopRuntime()) {
    return;
  }

  const token = nativeThemeSyncToken + 1;
  nativeThemeSyncToken = token;

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    if (nativeThemeSyncToken !== token) {
      return;
    }
    await getCurrentWindow().setTheme(appearance === "system" ? null : appearance);
  } catch {
    // Ignore native theme sync failures and keep the app interactive.
  }
}
