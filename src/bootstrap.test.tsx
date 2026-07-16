import { describe, expect, it } from "vitest";
import { normalizeFatalReport } from "./bootstrap";
import { FATAL_PHASES, UNKNOWN_APPLICATION_ERROR_MESSAGE } from "./lib/bootstrap-fatal";

describe("normalizeFatalReport", () => {
  it("preserves error messages and stacks", () => {
    const error = new Error("boom");
    error.stack = "stack trace";

    expect(normalizeFatalReport(FATAL_PHASES.startup, error)).toEqual({
      phase: FATAL_PHASES.startup,
      message: "boom",
      stack: "stack trace",
    });
  });

  it("normalizes string errors", () => {
    expect(normalizeFatalReport(FATAL_PHASES.runtime, "failed")).toEqual({
      phase: FATAL_PHASES.runtime,
      message: "failed",
    });
  });

  it("falls back for unknown values", () => {
    expect(normalizeFatalReport(FATAL_PHASES.runtime, { nope: true })).toEqual({
      phase: FATAL_PHASES.runtime,
      message: UNKNOWN_APPLICATION_ERROR_MESSAGE,
    });
  });
});
