import { titleCase } from "./utils";

export function toolDisplayName(tool: string) {
  switch (tool) {
    case "claude":
      return "Claude Code";
    case "codex":
      return "Codex CLI";
    case "gemini":
      return "Gemini CLI";
    default:
      return titleCase(tool);
  }
}
