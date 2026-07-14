import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "ai-switch.desktop.activity-log";

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  clear: () => void;
};

function createStorageMock(seed: Record<string, string> = {}): StorageMock {
  const state = new Map(Object.entries(seed));
  return {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => {
      state.set(key, value);
    },
    clear: () => {
      state.clear();
    },
  };
}

describe("lastCommandResult store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock(),
    });
  });

  it("records tool and global results into persisted maps and timeline order", async () => {
    const dateNow = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200);

    const module = await import("./lastCommandResult");

    module.recordCommandResult(
      { type: "tool", tool: "claude" },
      { label: "Switch profile", status: "success", message: "Switched Claude." },
    );
    module.recordCommandResult(
      { type: "global", id: "workspace" },
      { label: "Use set", status: "error", message: "Workspace mismatch.", remediation: "Open Sets." },
    );

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");

    expect(stored.tool.claude.message).toBe("Switched Claude.");
    expect(stored.global.workspace.message).toBe("Workspace mismatch.");
    expect(stored.timeline).toHaveLength(2);
    expect(stored.timeline[0].scope).toEqual({ type: "global", id: "workspace" });
    expect(stored.timeline[1].scope).toEqual({ type: "tool", tool: "claude" });

    dateNow.mockRestore();
  });

  it("clears persisted state", async () => {
    const module = await import("./lastCommandResult");

    module.recordCommandResult(
      { type: "tool", tool: "codex" },
      { label: "Switch profile", status: "success", message: "Switched Codex." },
    );

    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    module.clearLastCommandResults();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ tool: {}, global: {}, timeline: [] }),
    );
  });

  it("loads legacy map-only entries and ignores malformed persisted data", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock({
        [STORAGE_KEY]: JSON.stringify({
          tool: {
            claude: {
              label: "Switch profile",
              status: "success",
              message: "Switched Claude.",
              at: 100,
            },
          },
          global: {
            context: {
              label: "Use set",
              status: "error",
              message: "Missing context.",
              kind: "ContextMissing",
              at: 120,
            },
          },
        }),
      }),
    });

    const migratedModule = await import("./lastCommandResult");

    migratedModule.recordCommandResult(
      { type: "tool", tool: "gemini" },
      { label: "Switch profile", status: "success", message: "Switched Gemini." },
    );

    const migrated = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(migrated.timeline[0].scope).toEqual({ type: "tool", tool: "gemini" });
    expect(migrated.timeline.some((entry: { scope: { type: string; id?: string } }) => entry.scope.id === "context")).toBe(
      true,
    );

    vi.resetModules();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock({ [STORAGE_KEY]: "{not json" }),
    });
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    const invalidModule = await import("./lastCommandResult");
    invalidModule.recordCommandResult(
      { type: "global", id: "switch-all" },
      { label: "Switch all tools", status: "success", message: "Switched all." },
    );

    const recovered = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(recovered.timeline).toHaveLength(1);
    expect(recovered.global["switch-all"].message).toBe("Switched all.");
  });

  it("caps timeline history to the configured maximum", async () => {
    const times = Array.from({ length: 105 }, (_, index) => index + 1);
    vi.spyOn(Date, "now").mockImplementation(() => times.shift() ?? 999);

    const module = await import("./lastCommandResult");

    for (let index = 0; index < 105; index += 1) {
      module.recordCommandResult(
        { type: "tool", tool: `tool-${index}` },
        { label: "Record", status: "success", message: `Message ${index}` },
      );
    }

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.timeline).toHaveLength(100);
    expect(stored.timeline[0].message).toBe("Message 104");
    expect(stored.timeline.at(-1).message).toBe("Message 5");
  });

  it("survives localStorage write failures without throwing", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        ...createStorageMock(),
        setItem: () => {
          throw new Error("quota");
        },
      },
    });

    const module = await import("./lastCommandResult");

    expect(() =>
      module.recordCommandResult(
        { type: "tool", tool: "claude" },
        { label: "Switch profile", status: "success", message: "Switched Claude." },
      ),
    ).not.toThrow();
  });
});
