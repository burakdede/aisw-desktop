import { useSyncExternalStore } from "react";
import { resolveBrowserStorage, type BrowserStorage } from "../../lib/browser-storage";
import { ACTIVITY_STORE_KEY, limitActivityTimeline } from "./activity-store";
import {
  COMMAND_RESULT_GLOBAL_IDS,
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
import {
  asObject,
  asOptionalStringField,
  parseJsonObject,
} from "../../lib/parse-guards";

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
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return emptyStore();
  }

  const tool = asToolResultMap(parsed.tool);
  const global = asGlobalResultMap(parsed.global);
  const timeline = asTimeline(parsed.timeline);

  if (timeline.length > 0) {
    return {
      tool,
      global,
      timeline,
    };
  }

  const migratedTimeline = [
    ...getGlobalTimelineEntries(global),
    ...Object.entries(tool).flatMap(([entryTool, result]) =>
      result
        ? [createTimelineEntry({ type: "tool", tool: entryTool }, result, "migrated")]
        : [],
    ),
  ].sort((left, right) => right.at - left.at);

  return {
    tool,
    global,
    timeline: limitActivityTimeline(migratedTimeline),
  };
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

function resolveStorage(): BrowserStorage | null {
  return resolveBrowserStorage();
}

function asToolResultMap(value: unknown): Record<string, LastCommandResult | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const results: Record<string, LastCommandResult | undefined> = {};
  Object.entries(value).forEach(([key, result]) => {
    const parsed = asLastCommandResult(result);
    if (parsed) {
      results[key] = parsed;
    }
  });

  return results;
}

function asGlobalResultMap(value: unknown): Partial<Record<CommandResultGlobalId, LastCommandResult>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const results: Partial<Record<CommandResultGlobalId, LastCommandResult>> = {};
  Object.entries(value).forEach(([key, result]) => {
    if (!isCommandResultGlobalId(key)) {
      return;
    }

    const parsed = asLastCommandResult(result);
    if (parsed) {
      results[key] = parsed;
    }
  });

  return results;
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
  const key = asOptionalStringField(record, "key");
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

function getGlobalTimelineEntries(global: Partial<Record<CommandResultGlobalId, LastCommandResult>>) {
  return Object.values(COMMAND_RESULT_GLOBAL_IDS).flatMap((id) => {
    const result = global[id];
    return result
      ? [createTimelineEntry({ type: "global", id }, result, "migrated")]
      : [];
  });
}
