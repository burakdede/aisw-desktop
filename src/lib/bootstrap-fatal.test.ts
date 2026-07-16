import { describe, expect, it } from "vitest";
import {
  bootstrapConsoleScope,
  fatalPhaseBody,
  FATAL_PHASES,
  UNKNOWN_APPLICATION_ERROR_MESSAGE,
} from "./bootstrap-fatal";

describe("bootstrap-fatal", () => {
  it("shares fatal phases and fallback copy", () => {
    expect(FATAL_PHASES).toEqual({
      startup: "startup",
      runtime: "runtime",
    });
    expect(UNKNOWN_APPLICATION_ERROR_MESSAGE).toBe("Unknown application error.");
  });

  it("builds the bootstrap console scope", () => {
    expect(bootstrapConsoleScope(FATAL_PHASES.startup)).toBe("[bootstrap:startup]");
    expect(bootstrapConsoleScope(FATAL_PHASES.runtime)).toBe("[bootstrap:runtime]");
  });

  it("describes startup and runtime fatal bodies", () => {
    expect(fatalPhaseBody(FATAL_PHASES.startup)).toBe(
      "A startup error prevented the desktop app from rendering.",
    );
    expect(fatalPhaseBody(FATAL_PHASES.runtime)).toBe(
      "A runtime error interrupted the current view.",
    );
  });
});
