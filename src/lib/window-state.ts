import {
  LogicalPosition,
  LogicalSize,
  type PhysicalPosition,
  type PhysicalSize,
  type Position,
  type Size,
} from "@tauri-apps/api/dpi";
import type { Window as TauriWindow } from "@tauri-apps/api/window";
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from "./layout";
import { disposeSafely, type AsyncDispose } from "./async-dispose";
import { resolveBrowserStorage } from "./browser-storage";
import { WINDOW_STATE_PERSIST_DELAY_MS } from "./desktop-timing";
import { hasDesktopRuntime } from "./runtime-environment";
import { asFiniteNumber, parseJsonObject } from "./parse-guards";

type PersistedWindowState = {
  width: number;
  height: number;
  x: number;
  y: number;
};

type Unlisten = AsyncDispose;

type WindowGeometryHandle = {
  setSize: (size: LogicalSize | PhysicalSize | Size) => Promise<void>;
  setPosition: (position: LogicalPosition | PhysicalPosition | Position) => Promise<void>;
  innerSize: () => Promise<PhysicalSize | { width: number; height: number }>;
  outerPosition: () => Promise<PhysicalPosition | { x: number; y: number }>;
  isMaximized: () => Promise<boolean>;
  onResized: TauriWindow["onResized"];
  onMoved: TauriWindow["onMoved"];
};

type WindowModule = {
  getCurrentWindow: () => WindowGeometryHandle;
  LogicalPosition: typeof LogicalPosition;
  LogicalSize: typeof LogicalSize;
};

export const WINDOW_STATE_STORAGE_KEY = "ai-switch.desktop.window-state";

declare global {
  interface Window {
    __AISW_WINDOW_MOCK__?: WindowGeometryHandle;
  }
}

export async function syncWindowState(): Promise<Unlisten> {
  const module = await resolveWindowModule();
  if (!module) {
    return () => {};
  }

  const appWindow = module.getCurrentWindow();
  await restoreWindowState(module, appWindow);

  let persistTimer: number | null = null;

  const schedulePersist = () => {
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer);
    }
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      void persistWindowState(appWindow);
    }, WINDOW_STATE_PERSIST_DELAY_MS);
  };

  const unlistenResize = await appWindow.onResized(schedulePersist);
  const unlistenMove = await appWindow.onMoved(schedulePersist);

  return () => {
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer);
    }
    disposeSafely(unlistenResize);
    disposeSafely(unlistenMove);
  };
}

export function clearPersistedWindowState() {
  const storage = resolveBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(WINDOW_STATE_STORAGE_KEY);
  } catch {
    // Ignore storage failures and allow the app to continue.
  }
}

async function restoreWindowState(module: WindowModule, appWindow: WindowGeometryHandle) {
  const state = loadWindowState();
  if (!state) {
    return;
  }

  try {
    await appWindow.setSize(new module.LogicalSize(state.width, state.height));
    await appWindow.setPosition(new module.LogicalPosition(state.x, state.y));
  } catch {
    // Ignore restore failures and allow the platform default window frame to win.
  }
}

async function persistWindowState(appWindow: WindowGeometryHandle) {
  const storage = resolveBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    if (await appWindow.isMaximized()) {
      return;
    }

    const [size, position] = await Promise.all([
      appWindow.innerSize(),
      appWindow.outerPosition(),
    ]);

    const nextState: PersistedWindowState = {
      width: Math.max(Math.round(size.width), MIN_WINDOW_WIDTH),
      height: Math.max(Math.round(size.height), MIN_WINDOW_HEIGHT),
      x: Math.round(position.x),
      y: Math.round(position.y),
    };

    storage.setItem(WINDOW_STATE_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore persistence failures and keep the window interactive.
  }
}

function loadWindowState(): PersistedWindowState | null {
  const storage = resolveBrowserStorage();
  if (!storage) {
    return null;
  }

  const parsed = parseJsonObject(storage.getItem(WINDOW_STATE_STORAGE_KEY));
  if (!parsed) {
    return null;
  }

  const width = asFiniteNumber(parsed.width);
  const height = asFiniteNumber(parsed.height);
  const x = asFiniteNumber(parsed.x);
  const y = asFiniteNumber(parsed.y);
  if (
    width === undefined ||
    height === undefined ||
    x === undefined ||
    y === undefined
  ) {
    return null;
  }

  return {
    width: Math.max(width, MIN_WINDOW_WIDTH),
    height: Math.max(height, MIN_WINDOW_HEIGHT),
    x,
    y,
  };
}

async function resolveWindowModule(): Promise<WindowModule | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.__AISW_WINDOW_MOCK__) {
    const mockWindow = window.__AISW_WINDOW_MOCK__;
    return {
      getCurrentWindow: () => mockWindow,
      LogicalPosition,
      LogicalSize,
    };
  }

  if (!hasDesktopRuntime()) {
    return null;
  }

  try {
    const module = await import("@tauri-apps/api/window");
    return {
      getCurrentWindow: () => module.getCurrentWindow(),
      LogicalPosition: module.LogicalPosition,
      LogicalSize: module.LogicalSize,
    };
  } catch {
    return null;
  }
}
