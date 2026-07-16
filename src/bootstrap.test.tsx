import { describe, expect, it } from "vitest";
import { normalizeFatalReport } from "./bootstrap";

describe("normalizeFatalReport", () => {
  it("preserves error messages and stacks", () => {
    const error = new Error("boom");
    error.stack = "stack trace";

    expect(normalizeFatalReport("startup", error)).toEqual({
      phase: "startup",
      message: "boom",
      stack: "stack trace",
    });
  });

  it("normalizes string errors", () => {
    expect(normalizeFatalReport("runtime", "failed")).toEqual({
      phase: "runtime",
      message: "failed",
    });
  });

  it("falls back for unknown values", () => {
    expect(normalizeFatalReport("runtime", { nope: true })).toEqual({
      phase: "runtime",
      message: "Unknown application error.",
    });
  });
});
