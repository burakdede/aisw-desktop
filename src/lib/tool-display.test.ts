import { toolDisplayName } from "./tool-display";
import {
  SUPPORTED_TOOLS,
  isSupportedTool,
  toolShortName,
  toolSupportsEditableStateModes,
  toolSupportsSystemKeyringCredentials,
} from "./tool-registry";

describe("toolDisplayName", () => {
  it("returns branded names for supported tools", () => {
    expect(toolDisplayName("claude")).toBe("Claude Code");
    expect(toolDisplayName("codex")).toBe("Codex CLI");
    expect(toolDisplayName("gemini")).toBe("Gemini CLI");
  });

  it("falls back to title case for unknown tools", () => {
    expect(toolDisplayName("custom tool")).toBe("Custom Tool");
  });

  it("shares supported tool metadata through the registry", () => {
    expect(SUPPORTED_TOOLS).toEqual(["claude", "codex", "gemini"]);
    expect(isSupportedTool("claude")).toBe(true);
    expect(isSupportedTool("custom")).toBe(false);
    expect(toolShortName("gemini")).toBe("Gemini");
    expect(toolSupportsEditableStateModes("gemini")).toBe(false);
    expect(toolSupportsEditableStateModes("claude")).toBe(true);
    expect(toolSupportsSystemKeyringCredentials("gemini")).toBe(false);
    expect(toolSupportsSystemKeyringCredentials("codex")).toBe(true);
  });
});
