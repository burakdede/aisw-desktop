import { titleCase } from "./utils";

export const SUPPORTED_TOOLS = ["claude", "codex", "gemini", "antigravity"] as const;
export type SupportedTool = (typeof SUPPORTED_TOOLS)[number];

const SUPPORTED_TOOL_SET = new Set<string>(SUPPORTED_TOOLS);
const TOOL_ALIAS_MAP: Record<string, SupportedTool> = {
  agy: "antigravity",
};
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
  antigravity: {
    apiKeyEnvVar: DEFAULT_TOOL_API_KEY_ENV_VAR,
    binaryName: "agy",
    displayName: "Antigravity CLI",
    installCommand: "install agy",
    installGuideUrl: DEFAULT_INSTALL_GUIDE_URL,
    shortName: "Antigravity",
    supportsEditableStateModes: false,
    supportsSystemKeyringCredentials: true,
  },
};

export function canonicalToolId(tool: string) {
  return TOOL_ALIAS_MAP[tool] ?? tool;
}

export function isSupportedTool(tool: string): tool is SupportedTool {
  return SUPPORTED_TOOL_SET.has(canonicalToolId(tool));
}

function toolMetadata(tool: string) {
  const canonical = canonicalToolId(tool);
  return isSupportedTool(canonical) ? TOOL_METADATA[canonical] : null;
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
