import { describe, expect, it } from "vitest";
import {
  DATE_UNAVAILABLE_LABEL,
  formatDateTimeWithZone,
  parseStoredDate,
} from "./date-format";

describe("date-format", () => {
  it("parses ISO and compact stored timestamps", () => {
    expect(parseStoredDate("2026-07-15T13:30:00Z")?.toISOString()).toBe("2026-07-15T13:30:00.000Z");
    expect(parseStoredDate("20260715T133000Z")?.toISOString()).toBe("2026-07-15T13:30:00.000Z");
  });

  it("returns a shared fallback for invalid stored timestamps", () => {
    expect(parseStoredDate("not-a-date")).toBeNull();
    expect(formatDateTimeWithZone("not-a-date")).toBe(DATE_UNAVAILABLE_LABEL);
  });
});
