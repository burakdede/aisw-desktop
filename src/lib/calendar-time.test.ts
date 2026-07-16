import { describe, expect, it } from "vitest";
import { DAY_IN_MS, calendarDayDifference, calendarDayStarts } from "./calendar-time";

describe("calendar-time", () => {
  it("shares stable calendar timing constants", () => {
    expect(DAY_IN_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("resolves day boundaries and day differences", () => {
    const now = new Date("2026-07-16T15:45:00Z");
    const expectedTodayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();

    expect(calendarDayStarts(now)).toEqual({
      todayStart: expectedTodayStart,
      yesterdayStart: expectedTodayStart - DAY_IN_MS,
    });
    expect(calendarDayDifference(new Date("2026-07-16T08:00:00Z"), now)).toBe(0);
    expect(calendarDayDifference(new Date("2026-07-15T08:00:00Z"), now)).toBe(1);
    expect(calendarDayDifference(new Date("2026-07-10T08:00:00Z"), now)).toBe(6);
  });
});
