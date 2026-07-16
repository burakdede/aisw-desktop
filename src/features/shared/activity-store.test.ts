import { describe, expect, it } from "vitest";
import {
  ACTIVITY_STORE_KEY,
  ACTIVITY_TIMELINE_LIMIT,
  limitActivityTimeline,
} from "./activity-store";

describe("activity-store", () => {
  it("shares stable activity persistence constants", () => {
    expect(ACTIVITY_STORE_KEY).toBe("ai-switch.desktop.activity-log");
    expect(ACTIVITY_TIMELINE_LIMIT).toBe(100);
  });

  it("caps activity timeline arrays to the shared limit", () => {
    const values = Array.from({ length: 105 }, (_, index) => index);
    expect(limitActivityTimeline(values)).toHaveLength(100);
    expect(limitActivityTimeline(values)[0]).toBe(0);
    expect(limitActivityTimeline(values)[99]).toBe(99);
  });
});
