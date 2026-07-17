import { toolDisplayName } from "./tool-display";
import {
  SUPPORTED_TOOLS,
  isSupportedTool,
  toolApiKeyEnvVar,
  toolShortName,
  toolSupportsEditableStateModes,
  toolSupportsSystemKeyringCredentials,
} from "./tool-registry";

describe("toolDisplayName", () => {
  it("returns branded names for supported tools", () => {
    expect(toolDisplayName("claude")).toBe("Claude Code");
    expect(toolDisplayName("codex")).toBe("Codex CLI");
    expect(toolDisplayName("gemini")).toBe("Gemini CLI");
    expect(toolDisplayName("antigravity")).toBe("Antigravity CLI");
    expect(toolDisplayName("agy")).toBe("Antigravity CLI");
  });

  it("falls back to title case for unknown tools", () => {
    expect(toolDisplayName("custom tool")).toBe("Custom Tool");
  });

  it("shares supported tool metadata through the registry", () => {
    expect(SUPPORTED_TOOLS).toEqual(["claude", "codex", "gemini", "antigravity"]);
    expect(isSupportedTool("claude")).toBe(true);
    expect(isSupportedTool("agy")).toBe(true);
    expect(isSupportedTool("custom")).toBe(false);
    expect(toolApiKeyEnvVar("claude")).toBe("ANTHROPIC_API_KEY");
    expect(toolApiKeyEnvVar("custom")).toBe("API_KEY");
    expect(toolShortName("gemini")).toBe("Gemini");
    expect(toolShortName("agy")).toBe("Antigravity");
    expect(toolSupportsEditableStateModes("gemini")).toBe(false);
    expect(toolSupportsEditableStateModes("agy")).toBe(false);
    expect(toolSupportsEditableStateModes("claude")).toBe(true);
    expect(toolSupportsSystemKeyringCredentials("gemini")).toBe(false);
    expect(toolSupportsSystemKeyringCredentials("codex")).toBe(true);
    expect(toolSupportsSystemKeyringCredentials("antigravity")).toBe(true);
  });
});
