import {
  APP_NAV_IDS,
  DEFAULT_APP_SECTIONS,
  type DefaultAppSection,
} from "./app-navigation";

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

const APPEARANCE_KEY = "ai-switch.desktop.appearance";
const DEFAULT_SECTION_KEY = "ai-switch.desktop.default-section";
const SHOW_MENU_BAR_ICON_KEY = "ai-switch.desktop.show-menu-bar-icon";
const RESTORE_WINDOW_STATE_KEY = "ai-switch.desktop.restore-window-state";
const REOPEN_SETUP_ASSISTANT_KEY = "ai-switch.desktop.reopen-setup-assistant";
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

  const storedAppearance = storage.getItem(APPEARANCE_KEY);
  const storedSection = storage.getItem(DEFAULT_SECTION_KEY);
  const storedShowMenuBarIcon = storage.getItem(SHOW_MENU_BAR_ICON_KEY);
  const storedRestoreWindowState = storage.getItem(RESTORE_WINDOW_STATE_KEY);
  const storedReopenSetupAssistant = storage.getItem(REOPEN_SETUP_ASSISTANT_KEY);

  return {
    appearance: isDesktopAppearance(storedAppearance)
      ? storedAppearance
      : DEFAULT_DESKTOP_PREFERENCES.appearance,
    defaultSection: isDefaultSection(storedSection)
      ? storedSection
      : DEFAULT_DESKTOP_PREFERENCES.defaultSection,
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

  storage.setItem(APPEARANCE_KEY, preferences.appearance);
  storage.setItem(DEFAULT_SECTION_KEY, preferences.defaultSection);
  storage.setItem(SHOW_MENU_BAR_ICON_KEY, String(preferences.showMenuBarIcon));
  storage.setItem(
    RESTORE_WINDOW_STATE_KEY,
    String(preferences.restoreWindowState),
  );
  storage.setItem(
    REOPEN_SETUP_ASSISTANT_KEY,
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

function isDesktopAppearance(value: string | null): value is DesktopAppearance {
  return Boolean(value && DESKTOP_APPEARANCES.includes(value as DesktopAppearance));
}

function isDefaultSection(value: string | null): value is DefaultSection {
  return Boolean(value && DEFAULT_SECTIONS.includes(value as DefaultSection));
}

function getStorage(): Pick<Storage, "getItem" | "setItem" | "clear" | "removeItem"> | null {
  if (typeof window === "undefined") {
    return memoryStorage;
  }

  try {
    return window.localStorage ?? memoryStorage;
  } catch {
    return memoryStorage;
  }
}

function createMemoryStorage() {
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
  if (typeof window === "undefined") {
    return;
  }

  if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
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
