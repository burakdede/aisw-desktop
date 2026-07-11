export const DESKTOP_APPEARANCES = ["system", "light", "dark"] as const;
export type DesktopAppearance = (typeof DESKTOP_APPEARANCES)[number];

export const DEFAULT_SECTIONS = [
  "overview",
  "profiles",
  "sets",
  "diagnostics",
  "backups",
  "activity",
] as const;
export type DefaultSection = (typeof DEFAULT_SECTIONS)[number];

export type DesktopPreferences = {
  appearance: DesktopAppearance;
  defaultSection: DefaultSection;
};

const APPEARANCE_KEY = "ai-switch.desktop.appearance";
const DEFAULT_SECTION_KEY = "ai-switch.desktop.default-section";
const memoryStorage = createMemoryStorage();

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  appearance: "system",
  defaultSection: "overview",
};

export function loadDesktopPreferences(): DesktopPreferences {
  const storage = getStorage();
  if (!storage) {
    return DEFAULT_DESKTOP_PREFERENCES;
  }

  const storedAppearance = storage.getItem(APPEARANCE_KEY);
  const storedSection = storage.getItem(DEFAULT_SECTION_KEY);

  return {
    appearance: isDesktopAppearance(storedAppearance)
      ? storedAppearance
      : DEFAULT_DESKTOP_PREFERENCES.appearance,
    defaultSection: isDefaultSection(storedSection)
      ? storedSection
      : DEFAULT_DESKTOP_PREFERENCES.defaultSection,
  };
}

export function saveDesktopPreferences(preferences: DesktopPreferences) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(APPEARANCE_KEY, preferences.appearance);
  storage.setItem(DEFAULT_SECTION_KEY, preferences.defaultSection);
}

export function applyAppearancePreference(appearance: DesktopAppearance) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.appearance = appearance;
  root.style.colorScheme = appearance === "system" ? "light dark" : appearance;
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
