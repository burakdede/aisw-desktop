type PersistedWindowState = {
  width: number;
  height: number;
  x: number;
  y: number;
};

type Unlisten = () => void;

type WindowGeometryHandle = {
  setSize: (size: unknown) => Promise<void>;
  setPosition: (position: unknown) => Promise<void>;
  innerSize: () => Promise<{ width: number; height: number }>;
  outerPosition: () => Promise<{ x: number; y: number }>;
  isMaximized: () => Promise<boolean>;
  onResized: (handler: () => void) => Promise<Unlisten>;
  onMoved: (handler: () => void) => Promise<Unlisten>;
};

type WindowModule = {
  getCurrentWindow: () => WindowGeometryHandle;
  LogicalPosition: new (x: number, y: number) => unknown;
  LogicalSize: new (width: number, height: number) => unknown;
};

const WINDOW_STATE_KEY = "ai-switch.desktop.window-state";
const MIN_WIDTH = 820;
const MIN_HEIGHT = 560;

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
    }, 160);
  };

  const unlistenResize = await appWindow.onResized(schedulePersist);
  const unlistenMove = await appWindow.onMoved(schedulePersist);

  return () => {
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer);
    }
    unlistenResize();
    unlistenMove();
  };
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
  try {
    if (await appWindow.isMaximized()) {
      return;
    }

    const [size, position] = await Promise.all([
      appWindow.innerSize(),
      appWindow.outerPosition(),
    ]);

    const nextState: PersistedWindowState = {
      width: Math.max(Math.round(size.width), MIN_WIDTH),
      height: Math.max(Math.round(size.height), MIN_HEIGHT),
      x: Math.round(position.x),
      y: Math.round(position.y),
    };

    window.localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore persistence failures and keep the window interactive.
  }
}

function loadWindowState(): PersistedWindowState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(WINDOW_STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedWindowState> | null;
    if (
      !parsed ||
      !isFiniteNumber(parsed.width) ||
      !isFiniteNumber(parsed.height) ||
      !isFiniteNumber(parsed.x) ||
      !isFiniteNumber(parsed.y)
    ) {
      return null;
    }

    return {
      width: Math.max(parsed.width, MIN_WIDTH),
      height: Math.max(parsed.height, MIN_HEIGHT),
      x: parsed.x,
      y: parsed.y,
    };
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function resolveWindowModule(): Promise<WindowModule | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.__AISW_WINDOW_MOCK__) {
    class MockLogicalSize {
      constructor(
        public width: number,
        public height: number,
      ) {}
    }

    class MockLogicalPosition {
      constructor(
        public x: number,
        public y: number,
      ) {}
    }

    return {
      getCurrentWindow: () => window.__AISW_WINDOW_MOCK__ as WindowGeometryHandle,
      LogicalPosition: MockLogicalPosition,
      LogicalSize: MockLogicalSize,
    };
  }

  if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    return null;
  }

  try {
    const module = await import("@tauri-apps/api/window");
    return {
      getCurrentWindow: module.getCurrentWindow as () => WindowGeometryHandle,
      LogicalPosition: module.LogicalPosition,
      LogicalSize: module.LogicalSize,
    };
  } catch {
    return null;
  }
}
