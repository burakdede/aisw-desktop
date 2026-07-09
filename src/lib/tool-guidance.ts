export function installCommandForTool(tool: string) {
  switch (tool) {
    case "claude":
      return "npm install -g @anthropic-ai/claude-code";
    case "codex":
      return "npm install -g @openai/codex";
    case "gemini":
      return "npm install -g @google/gemini-cli";
    default:
      return `install ${tool}`;
  }
}

export function installGuideUrlForTool(tool: string) {
  switch (tool) {
    case "claude":
      return "https://www.npmjs.com/package/@anthropic-ai/claude-code";
    case "codex":
      return "https://www.npmjs.com/package/@openai/codex";
    case "gemini":
      return "https://www.npmjs.com/package/@google/gemini-cli";
    default:
      return "https://www.npmjs.com/";
  }
}

export function toolBinaryName(tool: string) {
  switch (tool) {
    case "claude":
      return "claude";
    case "codex":
      return "codex";
    case "gemini":
      return "gemini";
    default:
      return tool;
  }
}

export function commandForCurrentPlatform(binary: string, kind: "verify" | "path") {
  const platform = typeof navigator === "undefined" ? "" : `${navigator.userAgent} ${navigator.platform}`;
  const isWindows = /Windows/i.test(platform);
  if (kind === "verify") {
    return `${binary} --version`;
  }
  return isWindows ? `where ${binary}` : `which ${binary}`;
}

export function openExternalGuide(url: string) {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
