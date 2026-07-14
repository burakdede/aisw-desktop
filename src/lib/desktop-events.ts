export type DesktopEventHandler<T = unknown> = {
  event: string;
  handler: (payload: T) => void;
};

export type DesktopEventListener = <T>(
  event: string,
  handler: (payload: T) => void,
) => Promise<(() => void) | void> | (() => void) | void;

export function subscribeDesktopEvents(
  definitions: DesktopEventHandler[],
  listen: DesktopEventListener,
) {
  let active = true;
  const disposers: Array<() => void> = [];

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

      dispose();
    });
  }

  return () => {
    active = false;
    for (const dispose of disposers) {
      dispose();
    }
  };
}
