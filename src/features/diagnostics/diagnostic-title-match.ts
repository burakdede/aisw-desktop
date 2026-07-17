import { normalizeSearchText } from "../../lib/utils";
import { isSupportedTool } from "../../lib/tool-registry";

const DIAGNOSTIC_TITLE_PATTERNS = {
  liveMismatch: ["live mismatch"],
  profileMissing: ["profile missing"],
  permission: ["permission"],
  keyring: ["keyring"],
  oauth: ["oauth"],
  shell: ["shell"],
  project: ["project"],
  missing: ["missing"],
  setup: ["setup"],
} as const;
const DIAGNOSTIC_TOOL_PREFIX = "tool/";

export type DiagnosticTitlePattern = keyof typeof DIAGNOSTIC_TITLE_PATTERNS;

export function normalizeDiagnosticTitle(title: string | null | undefined) {
  return normalizeSearchText(title);
}

export function diagnosticTitleHas(
  title: string | null | undefined,
  pattern: DiagnosticTitlePattern,
) {
  const normalized = normalizeDiagnosticTitle(title);
  return DIAGNOSTIC_TITLE_PATTERNS[pattern].some((entry) => normalized.includes(entry));
}

export function diagnosticTitleHasAny(
  title: string | null | undefined,
  patterns: readonly DiagnosticTitlePattern[],
) {
  return patterns.some((pattern) => diagnosticTitleHas(title, pattern));
}

export function diagnosticTitleTool(title: string | null | undefined) {
  const normalized = normalizeDiagnosticTitle(title);
  const candidate = normalized.startsWith(DIAGNOSTIC_TOOL_PREFIX)
    ? normalized.slice(DIAGNOSTIC_TOOL_PREFIX.length)
    : normalized;
  return isSupportedTool(candidate) ? candidate : null;
}
