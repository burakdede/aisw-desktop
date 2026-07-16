export type AsyncDispose = () => void | Promise<void>;

export function disposeSafely(dispose?: AsyncDispose | null) {
  if (!dispose) {
    return;
  }

  void Promise.resolve(dispose()).catch(() => {
    // Cleanup failures should not take down the active renderer.
  });
}
