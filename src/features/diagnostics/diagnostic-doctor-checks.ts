import {
  normalizeResolvedCheckStatus,
  type ResolvedCheckStatus,
} from "../../lib/check-status";
import { asArray, asObject, asOptionalString } from "../../lib/parse-guards";

export type DoctorReportCheck = {
  name: string;
  detail: string;
  status: ResolvedCheckStatus;
  normalizedName: string;
  normalizedDetail: string;
};

export type ParsedDoctorCheck = DoctorReportCheck & {
  status: Extract<ResolvedCheckStatus, "warn" | "fail">;
};

export function parseDoctorReportChecks(
  doctor: Record<string, unknown> | undefined,
  options?: {
    defaultDetail?: string;
    detailTransform?: (detail: string) => string;
    defaultStatus?: ResolvedCheckStatus;
  },
) {
  const defaultStatus = options?.defaultStatus ?? "warn";

  return asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check))
    .map((check) => buildDoctorReportCheck(check, options, defaultStatus));
}

export function parseDoctorChecks(
  doctor: Record<string, unknown> | undefined,
  options?: {
    defaultDetail?: string;
    detailTransform?: (detail: string) => string;
    defaultStatus?: Extract<ResolvedCheckStatus, "warn" | "fail">;
  },
) {
  return parseDoctorReportChecks(doctor, options).filter(
    (check): check is ParsedDoctorCheck =>
      check.status === "warn" || check.status === "fail",
  );
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

function buildDoctorReportCheck(
  check: Record<string, unknown>,
  options:
    | {
        defaultDetail?: string;
        detailTransform?: (detail: string) => string;
        defaultStatus?: ResolvedCheckStatus;
      }
    | undefined,
  defaultStatus: ResolvedCheckStatus,
) {
  const rawDetail = asOptionalString(check.detail) ?? options?.defaultDetail ?? "";
  const detail = options?.detailTransform ? options.detailTransform(rawDetail) : rawDetail;

  return {
    name: asOptionalString(check.name) ?? "",
    detail,
    status: normalizeResolvedCheckStatus(check.status, defaultStatus),
    normalizedName: (asOptionalString(check.name) ?? "").toLowerCase(),
    normalizedDetail: detail.toLowerCase(),
  } satisfies DoctorReportCheck;
}
