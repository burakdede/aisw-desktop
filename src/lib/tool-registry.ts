import { titleCase } from "./utils";

export const SUPPORTED_TOOLS = ["claude", "codex", "gemini"] as const;
export type SupportedTool = (typeof SUPPORTED_TOOLS)[number];

const SUPPORTED_TOOL_SET = new Set<string>(SUPPORTED_TOOLS);
const DEFAULT_TOOL_API_KEY_ENV_VAR = "API_KEY";
const DEFAULT_INSTALL_GUIDE_URL = "https://www.npmjs.com/";

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

function toolMetadata(tool: string) {
  return isSupportedTool(tool) ? TOOL_METADATA[tool] : null;
}

export function toolDisplayName(tool: string) {
  return toolMetadata(tool)?.displayName ?? titleCase(tool);
}

export function toolShortName(tool: string) {
  return toolMetadata(tool)?.shortName ?? toolDisplayName(tool);
}

export function toolBinaryName(tool: string) {
  return toolMetadata(tool)?.binaryName ?? tool;
}

export function toolApiKeyEnvVar(tool: string) {
  return toolMetadata(tool)?.apiKeyEnvVar ?? DEFAULT_TOOL_API_KEY_ENV_VAR;
}

export function installCommandForTool(tool: string) {
  return toolMetadata(tool)?.installCommand ?? `install ${tool}`;
}

export function installGuideUrlForTool(tool: string) {
  return toolMetadata(tool)?.installGuideUrl ?? DEFAULT_INSTALL_GUIDE_URL;
}

export function toolSupportsEditableStateModes(tool: string) {
  return toolMetadata(tool)?.supportsEditableStateModes ?? true;
}

export function toolSupportsSystemKeyringCredentials(tool: string) {
  return toolMetadata(tool)?.supportsSystemKeyringCredentials ?? true;
}
