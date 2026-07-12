import { useSyncExternalStore } from "react";

export type CommandResultScope =
  | { type: "tool"; tool: string }
  | { type: "global"; id: string };

export type LastCommandResult = {
  label: string;
  status: "success" | "error";
  message: string;
  kind?: string;
  remediation?: string;
  command?: string;
  resultSummary?: string;
  at: number;
};

export type ActivityTimelineEntry = LastCommandResult & {
  key: string;
  scope: CommandResultScope;
};

type CommandResultStore = {
  tool: Record<string, LastCommandResult | undefined>;
  global: Record<string, LastCommandResult | undefined>;
  timeline: ActivityTimelineEntry[];
};

const ACTIVITY_STORE_KEY = "ai-switch.desktop.activity-log";
const MAX_ACTIVITY_ENTRIES = 100;

let currentStore: CommandResultStore = loadStore();

const listeners = new Set<() => void>();

function emitChange() {
  persistStore(currentStore);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentStore;
}

export function useLastCommandResults() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function recordCommandResult(scope: CommandResultScope, result: Omit<LastCommandResult, "at">) {
  const nextAt = Date.now();
  const next: LastCommandResult = {
    ...result,
    at: nextAt,
  };
  const timelineEntry: ActivityTimelineEntry = {
    ...next,
    key: `${scope.type}:${scope.type === "tool" ? scope.tool : scope.id}:${nextAt}:${Math.random()
      .toString(16)
      .slice(2, 8)}`,
    scope,
  };

  currentStore =
    scope.type === "tool"
      ? {
          ...currentStore,
          tool: {
            ...currentStore.tool,
            [scope.tool]: next,
          },
          timeline: [timelineEntry, ...currentStore.timeline].slice(0, MAX_ACTIVITY_ENTRIES),
        }
      : {
          ...currentStore,
          global: {
            ...currentStore.global,
            [scope.id]: next,
          },
          timeline: [timelineEntry, ...currentStore.timeline].slice(0, MAX_ACTIVITY_ENTRIES),
        };

  emitChange();
}

export function resetLastCommandResultsForTests() {
  currentStore = emptyStore();
  emitChange();
}

export function clearLastCommandResults() {
  currentStore = emptyStore();
  emitChange();
}

function emptyStore(): CommandResultStore {
  return {
    tool: {},
    global: {},
    timeline: [],
  };
}

function loadStore(): CommandResultStore {
  const storage = resolveStorage();
  if (!storage) {
    return emptyStore();
  }

  const raw = storage.getItem(ACTIVITY_STORE_KEY);
  if (!raw) {
    return emptyStore();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CommandResultStore> | null;
    const tool = asResultMap(parsed?.tool);
    const global = asResultMap(parsed?.global);
    const timeline = asTimeline(parsed?.timeline);

    if (timeline.length > 0) {
      return {
        tool,
        global,
        timeline,
      };
    }

    const migratedTimeline = [
      ...Object.entries(global).flatMap(([id, result]) =>
        result
          ? [
              {
                ...result,
                key: `global:${id}:${result.at}`,
                scope: { type: "global" as const, id },
              },
            ]
          : [],
      ),
      ...Object.entries(tool).flatMap(([entryTool, result]) =>
        result
          ? [
              {
                ...result,
                key: `tool:${entryTool}:${result.at}`,
                scope: { type: "tool" as const, tool: entryTool },
              },
            ]
          : [],
      ),
    ]
      .sort((left, right) => right.at - left.at)
      .slice(0, MAX_ACTIVITY_ENTRIES);

    return {
      tool,
      global,
      timeline: migratedTimeline,
    };
  } catch {
    return emptyStore();
  }
}

function persistStore(store: CommandResultStore) {
  const storage = resolveStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(ACTIVITY_STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore persistence failures so command recording still works in restricted environments.
  }
}

function resolveStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function asResultMap(value: unknown): Record<string, LastCommandResult | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, result]) => {
      const parsed = asLastCommandResult(result);
      return parsed ? [[key, parsed]] : [];
    }),
  );
}

function asTimeline(value: unknown): ActivityTimelineEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((entry) => {
      const parsed = asTimelineEntry(entry);
      return parsed ? [parsed] : [];
    })
    .sort((left, right) => right.at - left.at)
    .slice(0, MAX_ACTIVITY_ENTRIES);
}

function asLastCommandResult(value: unknown): LastCommandResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<LastCommandResult>;
  if (
    typeof candidate.label !== "string" ||
    (candidate.status !== "success" && candidate.status !== "error") ||
    typeof candidate.message !== "string" ||
    typeof candidate.at !== "number"
  ) {
    return null;
  }

  return {
    label: candidate.label,
    status: candidate.status,
    message: candidate.message,
    kind: typeof candidate.kind === "string" ? candidate.kind : undefined,
    remediation: typeof candidate.remediation === "string" ? candidate.remediation : undefined,
    command: typeof candidate.command === "string" ? candidate.command : undefined,
    resultSummary:
      typeof candidate.resultSummary === "string" ? candidate.resultSummary : undefined,
    at: candidate.at,
  };
}

function asTimelineEntry(value: unknown): ActivityTimelineEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<ActivityTimelineEntry>;
  const result = asLastCommandResult(candidate);
  if (!result || typeof candidate.key !== "string") {
    return null;
  }

  const scope = candidate.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return null;
  }

  if (
    (scope as Partial<CommandResultScope>).type === "tool" &&
    typeof (scope as { tool?: unknown }).tool === "string"
  ) {
    return {
      ...result,
      key: candidate.key,
      scope: { type: "tool", tool: (scope as { tool: string }).tool },
    };
  }

  if (
    (scope as Partial<CommandResultScope>).type === "global" &&
    typeof (scope as { id?: unknown }).id === "string"
  ) {
    return {
      ...result,
      key: candidate.key,
      scope: { type: "global", id: (scope as { id: string }).id },
    };
  }

  return null;
}
