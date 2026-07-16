export const ACTIVITY_STORE_KEY = "ai-switch.desktop.activity-log";
export const ACTIVITY_TIMELINE_LIMIT = 100;

export function limitActivityTimeline<Entry>(entries: Entry[]) {
  return entries.slice(0, ACTIVITY_TIMELINE_LIMIT);
}
