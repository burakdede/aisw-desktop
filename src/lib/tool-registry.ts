import { titleCase } from "./utils";

export const SUPPORTED_TOOLS = ["claude", "codex", "gemini"] as const;
export type SupportedTool = (typeof SUPPORTED_TOOLS)[number];

const SUPPORTED_TOOL_SET = new Set<string>(SUPPORTED_TOOLS);

const TOOL_METADATA: Record<
  SupportedTool,
  {
    apiKeyEnvVar: string;
    binaryName: string;
    displayName: string;
    installCommand: string;
    installGuideUrl: string;
    shortName: string;
    supportsEditableStateModes: boolean;
    supportsSystemKeyringCredentials: boolean;
  }
> = {
  claude: {
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    binaryName: "claude",
    displayName: "Claude Code",
    installCommand: "npm install -g @anthropic-ai/claude-code",
    installGuideUrl: "https://www.npmjs.com/package/@anthropic-ai/claude-code",
    shortName: "Claude",
    supportsEditableStateModes: true,
    supportsSystemKeyringCredentials: true,
  },
  codex: {
    apiKeyEnvVar: "OPENAI_API_KEY",
    binaryName: "codex",
    displayName: "Codex CLI",
    installCommand: "npm install -g @openai/codex",
    installGuideUrl: "https://www.npmjs.com/package/@openai/codex",
    shortName: "Codex",
    supportsEditableStateModes: true,
    supportsSystemKeyringCredentials: true,
  },
  gemini: {
    apiKeyEnvVar: "GEMINI_API_KEY",
    binaryName: "gemini",
    displayName: "Gemini CLI",
    installCommand: "npm install -g @google/gemini-cli",
    installGuideUrl: "https://www.npmjs.com/package/@google/gemini-cli",
    shortName: "Gemini",
    supportsEditableStateModes: false,
    supportsSystemKeyringCredentials: false,
  },
};

export function isSupportedTool(tool: string): tool is SupportedTool {
  return SUPPORTED_TOOL_SET.has(tool);
}

export function toolDisplayName(tool: string) {
  return isSupportedTool(tool) ? TOOL_METADATA[tool].displayName : titleCase(tool);
}

export function toolShortName(tool: string) {
  return isSupportedTool(tool) ? TOOL_METADATA[tool].shortName : toolDisplayName(tool);
}

export function toolBinaryName(tool: string) {
  return isSupportedTool(tool) ? TOOL_METADATA[tool].binaryName : tool;
}

export function toolApiKeyEnvVar(tool: string) {
  return isSupportedTool(tool) ? TOOL_METADATA[tool].apiKeyEnvVar : "API_KEY";
}

export function installCommandForTool(tool: string) {
  return isSupportedTool(tool) ? TOOL_METADATA[tool].installCommand : `install ${tool}`;
}

export function installGuideUrlForTool(tool: string) {
  return isSupportedTool(tool) ? TOOL_METADATA[tool].installGuideUrl : "https://www.npmjs.com/";
}

export function toolSupportsEditableStateModes(tool: string) {
  return !isSupportedTool(tool) || TOOL_METADATA[tool].supportsEditableStateModes;
}

export function toolSupportsSystemKeyringCredentials(tool: string) {
  return !isSupportedTool(tool) || TOOL_METADATA[tool].supportsSystemKeyringCredentials;
}
