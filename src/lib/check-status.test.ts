import { describe, expect, it } from "vitest";
import {
  CHECK_STATUSES,
  CHECK_STATUS_SYMBOLS,
  checkStatusSymbol,
  countCheckStatuses,
  normalizeCheckStatus,
  normalizeResolvedCheckStatus,
  summarizeCheckStatus,
} from "./check-status";

describe("check-status", () => {
  it("shares supported status values and symbols", () => {
    expect(CHECK_STATUSES).toEqual(["pass", "warn", "fail", "unknown"]);
    expect(CHECK_STATUS_SYMBOLS).toEqual({
      pass: "✓",
      warn: "!",
      fail: "✕",
      unknown: "?",
    });
    expect(checkStatusSymbol("warn")).toBe("!");
  });

  it("normalizes raw statuses", () => {
    expect(normalizeCheckStatus("pass")).toBe("pass");
    expect(normalizeCheckStatus("bad")).toBe("unknown");
    expect(normalizeCheckStatus("bad", "warn")).toBe("warn");
    expect(normalizeResolvedCheckStatus("unknown")).toBe("pass");
    expect(normalizeResolvedCheckStatus("bad", "warn")).toBe("warn");
  });

  it("counts and summarizes statuses", () => {
    expect(countCheckStatuses(["pass", "warn", "fail", "unknown", "bad"])).toEqual({
      total: 5,
      pass: 1,
      warn: 1,
      fail: 1,
      unknown: 2,
    });
    expect(summarizeCheckStatus({ total: 3, pass: 2, warn: 0, fail: 0 })).toBe("pass");
    expect(summarizeCheckStatus({ total: 2, pass: 1, warn: 1, fail: 0 })).toBe("warn");
    expect(summarizeCheckStatus({ total: 1, pass: 0, warn: 0, fail: 1 })).toBe("fail");
    expect(summarizeCheckStatus({ total: 0, pass: 0, warn: 0, fail: 0 })).toBe("unknown");
  });
});
