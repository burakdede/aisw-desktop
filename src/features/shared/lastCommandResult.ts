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

type CommandResultStore = {
  tool: Record<string, LastCommandResult | undefined>;
  global: Record<string, LastCommandResult | undefined>;
};

let currentStore: CommandResultStore = {
  tool: {},
  global: {},
};

const listeners = new Set<() => void>();

function emitChange() {
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
  const next: LastCommandResult = {
    ...result,
    at: Date.now(),
  };

  currentStore =
    scope.type === "tool"
      ? {
          ...currentStore,
          tool: {
            ...currentStore.tool,
            [scope.tool]: next,
          },
        }
      : {
          ...currentStore,
          global: {
            ...currentStore.global,
            [scope.id]: next,
          },
        };

  emitChange();
}

export function resetLastCommandResultsForTests() {
  currentStore = {
    tool: {},
    global: {},
  };
  emitChange();
}

export function clearLastCommandResults() {
  currentStore = {
    tool: {},
    global: {},
  };
  emitChange();
}
