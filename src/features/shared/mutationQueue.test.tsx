import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  enqueueMutation,
  resetMutationQueueForTests,
  useMutationAwareQueryEnabled,
  useMutationQueueState,
} from "./mutationQueue";

describe("mutationQueue", () => {
  beforeEach(() => {
    resetMutationQueueForTests();
  });

  it("tracks active and queued state while serializing mutations", async () => {
    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<string>((resolve) => {
      resolveSecond = resolve;
    });

    const stateHook = renderHook(() => useMutationQueueState());

    const firstTask = enqueueMutation("First mutation", () => first);
    const secondTask = enqueueMutation("Second mutation", () => second);

    await waitFor(() =>
      expect(stateHook.result.current).toMatchObject({
        activeLabel: "First mutation",
        queuedCount: 2,
        isBusy: true,
      }),
    );

    resolveFirst("first");
    await waitFor(() =>
      expect(stateHook.result.current).toMatchObject({
        activeLabel: "Second mutation",
        queuedCount: 1,
        isBusy: true,
      }),
    );

    await expect(firstTask).resolves.toBe("first");
    resolveSecond("second");
    await expect(secondTask).resolves.toBe("second");
    await waitFor(() =>
      expect(stateHook.result.current).toMatchObject({
        activeLabel: null,
        queuedCount: 0,
        isBusy: false,
      }),
    );
  });

  it("continues the queue after a failure", async () => {
    const firstTask = enqueueMutation("Broken mutation", async () => {
      throw new Error("boom");
    });
    const secondTask = enqueueMutation("Recovered mutation", async () => "ok");

    await expect(firstTask).rejects.toThrow("boom");
    await expect(secondTask).resolves.toBe("ok");
  });

  it("disables dependent queries only while the queue is busy", async () => {
    let resolveRunning!: () => void;
    const running = new Promise<void>((resolve) => {
      resolveRunning = resolve;
    });

    const queryEnabledHook = renderHook(({ enabled }) => useMutationAwareQueryEnabled(enabled), {
      initialProps: { enabled: true },
    });

    expect(queryEnabledHook.result.current).toBe(true);

    const pendingTask = enqueueMutation("Long mutation", async () => {
      await running;
    });

    await waitFor(() => expect(queryEnabledHook.result.current).toBe(false));

    queryEnabledHook.rerender({ enabled: false });
    expect(queryEnabledHook.result.current).toBe(false);

    resolveRunning();
    await pendingTask;

    queryEnabledHook.rerender({ enabled: true });
    await waitFor(() => expect(queryEnabledHook.result.current).toBe(true));
  });
});
