import { useSyncExternalStore } from "react";

type MutationQueueSnapshot = {
  activeLabel: string | null;
  queuedCount: number;
  isBusy: boolean;
};

let activeLabel: string | null = null;
let queuedCount = 0;
let tail: Promise<void> = Promise.resolve();
let currentSnapshot: MutationQueueSnapshot = {
  activeLabel: null,
  queuedCount: 0,
  isBusy: false,
};
const listeners = new Set<() => void>();

function refreshSnapshot() {
  currentSnapshot = {
    activeLabel,
    queuedCount,
    isBusy: queuedCount > 0 || activeLabel !== null,
  };
}

function emitChange() {
  refreshSnapshot();
  listeners.forEach((listener) => listener());
}

function snapshot(): MutationQueueSnapshot {
  return currentSnapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMutationQueueState() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useMutationAwareQueryEnabled(enabled = true) {
  const state = useMutationQueueState();
  return enabled && !state.isBusy;
}

export function enqueueMutation<T>(label: string, task: () => Promise<T>): Promise<T> {
  queuedCount += 1;
  emitChange();

  const runTask = async () => {
    activeLabel = label;
    emitChange();

    try {
      return await task();
    } finally {
      activeLabel = null;
      queuedCount = Math.max(0, queuedCount - 1);
      emitChange();
    }
  };

  const result = tail.then(runTask, runTask);
  tail = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

export function resetMutationQueueForTests() {
  activeLabel = null;
  queuedCount = 0;
  tail = Promise.resolve();
  emitChange();
}
