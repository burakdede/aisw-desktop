import { describe, expect, it } from "vitest";
import {
  COMMAND_RESULT_GLOBAL_IDS,
  isCommandResultGlobalId,
  parseCommandResultScope,
} from "./command-result-scope";

describe("command-result-scope", () => {
  it("parses tray event and persisted timeline scope shapes", () => {
    expect(
      parseCommandResultScope({
        scope: "tool",
        tool: "claude",
      }),
    ).toEqual({
      type: "tool",
      tool: "claude",
    });

    expect(
      parseCommandResultScope({
        type: "global",
        id: COMMAND_RESULT_GLOBAL_IDS.workspace,
      }),
    ).toEqual({
      type: "global",
      id: COMMAND_RESULT_GLOBAL_IDS.workspace,
    });
  });

  it("rejects unsupported command-result scopes", () => {
    expect(isCommandResultGlobalId(COMMAND_RESULT_GLOBAL_IDS.workspace)).toBe(true);
    expect(isCommandResultGlobalId("unknown")).toBe(false);
    expect(
      parseCommandResultScope({
        scope: "global",
        id: "unknown",
      }),
    ).toBeNull();
    expect(
      parseCommandResultScope({
        type: "tool",
      }),
    ).toBeNull();
    expect(parseCommandResultScope(null)).toBeNull();
  });
});
