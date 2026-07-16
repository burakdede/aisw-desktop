import { bootstrapApplication } from "./bootstrap";
import { ACTIVITY_STORE_KEY } from "./features/shared/activity-store";
import {
  createMarketingDesktopMock,
  buildMarketingActivityStore,
  MARKETING_SCENES,
  type MarketingSceneName,
} from "./marketing/desktop-marketing-fixtures";
import {
  DESKTOP_PREFERENCE_STORAGE_KEYS,
  type DesktopPreferences,
} from "./lib/desktop-preferences";
import { APP_NAV_IDS, type AppNavId } from "./lib/app-navigation";
import "./styles/global.css";

declare global {
  interface Window {
    __AISW_MARKETING_SCENE__?: MarketingSceneName;
  }
}

const APP_SECTIONS = new Set<AppNavId>(Object.values(APP_NAV_IDS));

const root = document.getElementById("root");

if (!root) {
  throw new Error("Marketing capture root element is missing.");
}

const params = new URLSearchParams(window.location.search);
const scene = normalizeScene(params.get("scene"));
const nav = normalizeNav(params.get("nav"));

window.__AISW_MARKETING_SCENE__ = scene;
window.__AISW_DESKTOP_MOCK__ = createMarketingDesktopMock(scene);

seedMarketingStorage(scene, nav);

bootstrapApplication(root);

function normalizeScene(value: string | null): MarketingSceneName {
  return MARKETING_SCENES.find((entry) => entry === value) ?? "overview";
}

function normalizeNav(value: string | null): AppNavId {
  return value && APP_SECTIONS.has(value as AppNavId)
    ? (value as AppNavId)
    : APP_NAV_IDS.overview;
}

function seedMarketingStorage(sceneName: MarketingSceneName, navId: AppNavId) {
  window.localStorage.clear();

  const preferences: DesktopPreferences = {
    appearance: "light",
    defaultSection: navId === APP_NAV_IDS.settings ? APP_NAV_IDS.overview : navId,
    showMenuBarIcon: true,
    restoreWindowState: false,
    reopenSetupAssistant: false,
  };

  window.localStorage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.appearance,
    preferences.appearance,
  );
  window.localStorage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.defaultSection,
    preferences.defaultSection,
  );
  window.localStorage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.showMenuBarIcon,
    String(preferences.showMenuBarIcon),
  );
  window.localStorage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.restoreWindowState,
    String(preferences.restoreWindowState),
  );
  window.localStorage.setItem(
    DESKTOP_PREFERENCE_STORAGE_KEYS.reopenSetupAssistant,
    String(preferences.reopenSetupAssistant),
  );
  window.localStorage.setItem(
    ACTIVITY_STORE_KEY,
    JSON.stringify(buildMarketingActivityStore(sceneName)),
  );
}
