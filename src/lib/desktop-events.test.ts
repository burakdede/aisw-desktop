import { subscribeDesktopEvents, type DesktopEventListener } from "./desktop-events";

describe("subscribeDesktopEvents", () => {
  it("registers every event and invokes matching handlers", async () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    const listen: DesktopEventListener = vi.fn((event, handler) => {
      handlers.set(event, handler as (payload: unknown) => void);
      return () => {
        handlers.delete(event);
      };
    });
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const dispose = subscribeDesktopEvents(
      [
        { event: "first", handler: firstHandler },
        { event: "second", handler: secondHandler },
      ],
      listen,
    );

    expect(listen).toHaveBeenCalledTimes(2);

    handlers.get("first")?.({ ok: true });
    handlers.get("second")?.({ ok: false });

    expect(firstHandler).toHaveBeenCalledWith({ ok: true });
    expect(secondHandler).toHaveBeenCalledWith({ ok: false });

    dispose();
  });

  it("ignores events after cleanup and disposes late async subscriptions", async () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    const disposeSpy = vi.fn();
    let releaseDispose: ((value: () => void) => void) | undefined;
    const listen: DesktopEventListener = vi.fn(
      (event, handler) =>
        new Promise<() => void>((resolve) => {
          handlers.set(event, handler as (payload: unknown) => void);
          releaseDispose = resolve;
        }),
    );
    const handler = vi.fn();

    const dispose = subscribeDesktopEvents([{ event: "late", handler }], listen);
    dispose();

    handlers.get("late")?.({ ok: true });
    expect(handler).not.toHaveBeenCalled();

    releaseDispose?.(disposeSpy);
    await Promise.resolve();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
