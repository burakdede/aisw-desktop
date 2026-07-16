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

export type DiagnosticTitlePattern = keyof typeof DIAGNOSTIC_TITLE_PATTERNS;

export function normalizeDiagnosticTitle(title: string | null | undefined) {
  return title?.trim().toLowerCase() ?? "";
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
