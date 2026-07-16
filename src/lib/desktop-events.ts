import { disposeSafely, type AsyncDispose } from "./async-dispose";

export type DesktopEventHandler<T = unknown> = {
  event: string;
  handler: (payload: T) => void;
};

export type DesktopEventListener = <T>(
  event: string,
  handler: (payload: T) => void,
) => Promise<AsyncDispose | void> | AsyncDispose | void;

export function subscribeDesktopEvents(
  definitions: DesktopEventHandler[],
  listen: DesktopEventListener,
) {
  let active = true;
  const disposers: AsyncDispose[] = [];

  for (const definition of definitions) {
    void Promise.resolve(
      listen(definition.event, (payload) => {
        if (!active) {
          return;
        }
        definition.handler(payload);
      }),
    ).then((dispose) => {
      if (typeof dispose !== "function") {
        return;
      }

      if (active) {
        disposers.push(dispose);
        return;
      }

      disposeSafely(dispose);
    }).catch(() => {
      // Keep the renderer interactive even when a native event subscription fails.
    });
  }

  return () => {
    active = false;
    for (const dispose of disposers) {
      disposeSafely(dispose);
    }
  };
}
