import { describe, expect, it } from "vitest";
import type { AppBootstrap, AppSnapshot } from "../../lib/schemas";
import { makeRuntimeToolCapabilities } from "../../test-support/runtime-tool-capabilities";
import {
  DEFAULT_EDITABLE_STATE_MODE,
  EDITABLE_STATE_MODES,
  fixedStateModeDescription,
  isEditableStateMode,
  resolvePreferredEditableStateMode,
  resolveGlobalStateMode,
  resolveStateModeRequest,
  stateModeDescription,
  stateModeLabel,
  supportedStateModes,
} from "./state-modes";

type ToolCapabilities = NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];

describe("state-modes", () => {
  it("shares editable state mode ids and defaults", () => {
    expect(EDITABLE_STATE_MODES).toEqual(["isolated", "shared"]);
    expect(DEFAULT_EDITABLE_STATE_MODE).toBe("isolated");
    expect(stateModeLabel("system_keyring")).toBe("System Keyring");
    expect(stateModeDescription(DEFAULT_EDITABLE_STATE_MODE)).toBe(
      "Separate config, history, and extensions for this profile.",
    );
    expect(stateModeDescription("portable")).toBe(
      "Use the runtime-supported state handling for this profile.",
    );
  });

  it("normalizes supported and preferred state modes", () => {
    const toolCapabilities: ToolCapabilities = makeRuntimeToolCapabilities({
      claude: {
        auth_methods: [],
        state_modes: ["shared", "isolated", "shared", "unsupported"],
        credential_backends: [],
      },
      gemini: {
        auth_methods: [],
        state_modes: ["isolated"],
        credential_backends: [],
      },
      antigravity: {
        auth_methods: [],
        state_modes: [],
        credential_backends: [],
      },
    });

    expect(supportedStateModes("claude", toolCapabilities)).toEqual(["shared", "isolated"]);
    expect(supportedStateModes("gemini", toolCapabilities)).toEqual(["isolated"]);
    expect(supportedStateModes("antigravity", toolCapabilities)).toEqual([]);
    expect(isEditableStateMode("shared")).toBe(true);
    expect(isEditableStateMode("portable")).toBe(false);
    expect(resolvePreferredEditableStateMode(["shared", "isolated"], "shared")).toBe("shared");
    expect(resolvePreferredEditableStateMode(["shared", "isolated"], "portable")).toBe("shared");
    expect(resolvePreferredEditableStateMode([], "shared")).toBeNull();
    expect(resolveStateModeRequest("claude", toolCapabilities, "shared")).toBe("shared");
    expect(resolveStateModeRequest("claude", toolCapabilities, "portable")).toBe("shared");
    expect(resolveStateModeRequest("gemini", toolCapabilities, "shared")).toBe("isolated");
    expect(resolveStateModeRequest("antigravity", toolCapabilities, "shared")).toBeNull();
  });

  it("resolves the global state mode across editable tools", () => {
    const snapshot = {
      statuses: [
        { tool: "claude", state_mode: "shared" },
        { tool: "codex", state_mode: "shared" },
      ],
    } as AppSnapshot;

    expect(resolveGlobalStateMode(snapshot)).toBe("shared");
    expect(
      resolveGlobalStateMode({
        statuses: [
          { tool: "claude", state_mode: "shared" },
          { tool: "codex", state_mode: "isolated" },
        ],
      } as AppSnapshot),
    ).toBe(DEFAULT_EDITABLE_STATE_MODE);
    expect(
      resolveGlobalStateMode({ statuses: [{ tool: "gemini", state_mode: "isolated" }] } as AppSnapshot),
    ).toBe(DEFAULT_EDITABLE_STATE_MODE);
    expect(
      resolveGlobalStateMode({ statuses: [{ tool: "antigravity", state_mode: null }] } as AppSnapshot),
    ).toBe(DEFAULT_EDITABLE_STATE_MODE);
    expect(fixedStateModeDescription("gemini")).toBe(
      "Gemini CLI keeps authentication and local state together.",
    );
  });
});
