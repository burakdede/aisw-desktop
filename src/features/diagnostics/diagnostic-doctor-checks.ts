import type { ResolvedCheckStatus } from "../../lib/check-status";

export type ParsedDoctorCheck = {
  name: string;
  detail: string;
  status: Extract<ResolvedCheckStatus, "warn" | "fail">;
  normalizedName: string;
  normalizedDetail: string;
};

export function parseDoctorChecks(
  doctor: Record<string, unknown> | undefined,
  options?: {
    defaultDetail?: string;
    detailTransform?: (detail: string) => string;
    defaultStatus?: Extract<ResolvedCheckStatus, "warn" | "fail">;
  },
) {
  const defaultStatus = options?.defaultStatus ?? "warn";

  return asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check))
    .map((check) => {
      const rawDetail = asStringValue(check.detail) ?? options?.defaultDetail ?? "";
      const detail = options?.detailTransform ? options.detailTransform(rawDetail) : rawDetail;

      return {
        name: asStringValue(check.name) ?? "",
        detail,
        status: (asStringValue(check.status) as Extract<ResolvedCheckStatus, "warn" | "fail"> | undefined)
          ?? defaultStatus,
        normalizedName: (asStringValue(check.name) ?? "").toLowerCase(),
        normalizedDetail: detail.toLowerCase(),
      } satisfies ParsedDoctorCheck;
    });
}

export function doctorCheckHasKeyword(
  check: Pick<ParsedDoctorCheck, "normalizedName" | "normalizedDetail">,
  keyword: string,
) {
  return check.normalizedName.includes(keyword) || check.normalizedDetail.includes(keyword);
}

export function doctorCheckNameHasAll(
  check: Pick<ParsedDoctorCheck, "normalizedName">,
  keywords: readonly string[],
) {
  return keywords.every((keyword) => check.normalizedName.includes(keyword));
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
