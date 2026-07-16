import { useSyncExternalStore } from "react";
import { resolveBrowserStorage } from "../../lib/browser-storage";
import { ACTIVITY_STORE_KEY, limitActivityTimeline } from "./activity-store";
import {
  COMMAND_RESULT_SCOPE_TYPES,
  commandResultScopeValue,
  isCommandResultGlobalId,
  parseCommandResultScope,
  type CommandResultScope,
  type CommandResultGlobalId,
} from "./command-result-scope";
export type { CommandResultScope } from "./command-result-scope";
import {
  parseStoredCommandResult,
  type CommandResultRecord,
  type CommandResultStatus,
  type ParsedStoredCommandResult,
} from "./command-result-shape";
import { asObject, asOptionalString } from "../../lib/parse-guards";

export type LastCommandResult = ParsedStoredCommandResult;

export type ActivityTimelineEntry = LastCommandResult & {
  key: string;
  scope: CommandResultScope;
};

type CommandResultStore = {
  tool: Record<string, LastCommandResult | undefined>;
  global: Partial<Record<CommandResultGlobalId, LastCommandResult>>;
  timeline: ActivityTimelineEntry[];
};

const TIMELINE_KEY_SEPARATOR = ":";
let nextTimelineNonce = 0;

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

export function recordCommandResult(scope: CommandResultScope, result: CommandResultRecord) {
  const nextAt = Date.now();
  const next: LastCommandResult = {
    ...result,
    at: nextAt,
  };
  const timelineEntry = createTimelineEntry(scope, next);

  currentStore =
    scope.type === "tool"
      ? {
          ...currentStore,
          tool: {
            ...currentStore.tool,
            [scope.tool]: next,
          },
          timeline: limitActivityTimeline([timelineEntry, ...currentStore.timeline]),
        }
      : {
          ...currentStore,
          global: {
            ...currentStore.global,
            [scope.id]: next,
          },
          timeline: limitActivityTimeline([timelineEntry, ...currentStore.timeline]),
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
    const tool = asToolResultMap(parsed?.tool);
    const global = asGlobalResultMap(parsed?.global);
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
              createTimelineEntry(
                { type: "global", id: id as CommandResultGlobalId },
                result,
                "migrated",
              ),
            ]
          : [],
      ),
      ...Object.entries(tool).flatMap(([entryTool, result]) =>
        result
          ? [
              createTimelineEntry({ type: "tool", tool: entryTool }, result, "migrated"),
            ]
          : [],
      ),
    ]
      .sort((left, right) => right.at - left.at);

    return {
      tool,
      global,
      timeline: limitActivityTimeline(migratedTimeline),
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
  return resolveBrowserStorage() as Storage | null;
}

function asToolResultMap(value: unknown): Record<string, LastCommandResult | undefined> {
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

function asGlobalResultMap(value: unknown): Partial<Record<CommandResultGlobalId, LastCommandResult>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, result]) => {
      if (!isCommandResultGlobalId(key)) {
        return [];
      }

      const parsed = asLastCommandResult(result);
      return parsed ? [[key, parsed]] : [];
    }),
  ) as Partial<Record<CommandResultGlobalId, LastCommandResult>>;
}

function asTimeline(value: unknown): ActivityTimelineEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = value
    .flatMap((entry) => {
      const parsed = asTimelineEntry(entry);
      return parsed ? [parsed] : [];
    })
    .sort((left, right) => right.at - left.at);

  return limitActivityTimeline(entries);
}

function asLastCommandResult(value: unknown): LastCommandResult | null {
  return parseStoredCommandResult(value);
}

function asTimelineEntry(value: unknown): ActivityTimelineEntry | null {
  const record = asObject(value);
  if (!record) {
    return null;
  }

  const result = asLastCommandResult(record);
  const key = asOptionalString(record.key);
  const scope = parseCommandResultScope(record.scope);
  if (!result || !key || !scope) {
    return null;
  }

  return {
    ...result,
    key,
    scope,
  };
}

function createTimelineEntry(
  scope: CommandResultScope,
  result: LastCommandResult,
  keySuffix = createTimelineKeySuffix(),
): ActivityTimelineEntry {
  return {
    ...result,
    key: buildTimelineEntryKey(scope, result.at, keySuffix),
    scope,
  };
}

function buildTimelineEntryKey(
  scope: CommandResultScope,
  timestamp: number,
  suffix: string,
) {
  return [
    scope.type,
    commandResultScopeValue(scope),
    String(timestamp),
    suffix,
  ].join(TIMELINE_KEY_SEPARATOR);
}

function createTimelineKeySuffix() {
  nextTimelineNonce += 1;
  return nextTimelineNonce.toString(16);
}
