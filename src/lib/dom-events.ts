export function eventTargetWithinSelector(
  target: EventTarget | null,
  selector: string,
) {
  return typeof Element !== "undefined" &&
    target instanceof Element &&
    Boolean(target.closest(selector));
}

export function eventTargetIsEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}
