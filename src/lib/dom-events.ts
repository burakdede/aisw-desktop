export function eventTargetWithinSelector(
  target: EventTarget | null,
  selector: string,
) {
  return typeof Element !== "undefined" &&
    target instanceof Element &&
    Boolean(target.closest(selector));
}
