import { toolDisplayName } from "./tool-display";

describe("toolDisplayName", () => {
  it("returns branded names for supported tools", () => {
    expect(toolDisplayName("claude")).toBe("Claude Code");
    expect(toolDisplayName("codex")).toBe("Codex CLI");
    expect(toolDisplayName("gemini")).toBe("Gemini CLI");
  });

  it("falls back to title case for unknown tools", () => {
    expect(toolDisplayName("custom tool")).toBe("Custom Tool");
  });
});
