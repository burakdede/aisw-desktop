import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  commandForCurrentPlatform,
  installCommandForTool,
  installGuideUrlForTool,
  openExternalGuide,
  toolBinaryName,
} from "./tool-guidance";

describe("tool guidance helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns install commands and guide URLs for supported tools", () => {
    expect(installCommandForTool("claude")).toBe("npm install -g @anthropic-ai/claude-code");
    expect(installCommandForTool("codex")).toBe("npm install -g @openai/codex");
    expect(installCommandForTool("gemini")).toBe("npm install -g @google/gemini-cli");
    expect(installCommandForTool("custom-tool")).toBe("install custom-tool");

    expect(installGuideUrlForTool("claude")).toContain("@anthropic-ai/claude-code");
    expect(installGuideUrlForTool("codex")).toContain("@openai/codex");
    expect(installGuideUrlForTool("gemini")).toContain("@google/gemini-cli");
    expect(installGuideUrlForTool("custom-tool")).toBe("https://www.npmjs.com/");
  });

  it("returns expected binary names and platform commands", () => {
    expect(toolBinaryName("claude")).toBe("claude");
    expect(toolBinaryName("codex")).toBe("codex");
    expect(toolBinaryName("gemini")).toBe("gemini");
    expect(toolBinaryName("custom-tool")).toBe("custom-tool");

    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh)");
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
    expect(commandForCurrentPlatform("codex", "verify")).toBe("codex --version");
    expect(commandForCurrentPlatform("codex", "path")).toBe("which codex");

    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0)");
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("Win32");
    expect(commandForCurrentPlatform("codex", "path")).toBe("where codex");
  });

  it("opens external guides only when window.open is available", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    openExternalGuide("https://example.com/help");
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/help",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
