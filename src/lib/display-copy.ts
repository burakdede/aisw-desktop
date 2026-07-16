export const BACKEND_UNAVAILABLE_LABEL = "Backend Unavailable";
export const DATE_UNAVAILABLE_LABEL = "Date Unavailable";
export const DEFAULT_ACTION_FAILURE_MESSAGE = "AI Switch could not complete that action.";
export const NOT_AVAILABLE_LABEL = "Not Available";
export const NOT_FOUND_LABEL = "Not found";
export const NOT_SET_LABEL = "Not set";
export const VERIFICATION_REQUIRED_LABEL = "Verification Required";

export function clipboardUnavailableManualMessage(subject: string, value?: string) {
  return value
    ? `Clipboard access is unavailable. Copy ${subject} ${value} manually.`
    : `Clipboard access is unavailable. Copy ${subject} manually.`;
}

export function clipboardCopiedMessage(subject: string, value?: string) {
  return value ? `Copied ${subject} ${value}.` : `Copied ${subject}.`;
}

export function savedItemMessage(item: string) {
  return `Saved ${item}.`;
}

export function openedItemMessage(item: string) {
  return `Opened ${item}.`;
}

export function inspectItemLabel(item: string) {
  return `Inspect ${item}`;
}

export function moreActionsLabel(item: string) {
  return `More actions for ${item}`;
}

export function quotedActionHeading(action: string, item: string) {
  return `${action} “${item}”?`;
}

export function noSelectionHeading(subject: string) {
  return `No ${subject} selected`;
}
