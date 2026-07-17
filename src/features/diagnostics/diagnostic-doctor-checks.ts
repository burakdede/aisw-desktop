import {
  isAttentionCheckStatus,
  normalizeResolvedCheckStatus,
  type AttentionCheckStatus,
  type ResolvedCheckStatus,
} from "../../lib/check-status";
import type { DoctorReport } from "../../lib/schemas";
import {
  asArray,
  asObject,
  asOptionalString,
  asOptionalStringOr,
  type UnknownRecord,
} from "../../lib/parse-guards";

export type DoctorReportCheck = {
  name: string;
  detail: string;
  status: ResolvedCheckStatus;
  normalizedName: string;
  normalizedDetail: string;
};

export type ParsedDoctorCheck = DoctorReportCheck & {
  status: AttentionCheckStatus;
};

export function parseDoctorReportChecks(
  doctor: DoctorReport | undefined,
  options?: {
    defaultDetail?: string;
    detailTransform?: (detail: string) => string;
    defaultStatus?: ResolvedCheckStatus;
  },
) {
  const defaultStatus = options?.defaultStatus ?? "warn";

  return asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is UnknownRecord => Boolean(check))
    .map((check) => buildDoctorReportCheck(check, options, defaultStatus));
}

export function parseDoctorChecks(
  doctor: DoctorReport | undefined,
  options?: {
    defaultDetail?: string;
    detailTransform?: (detail: string) => string;
    defaultStatus?: AttentionCheckStatus;
  },
) {
  return parseDoctorReportChecks(doctor, options).filter(
    (check): check is ParsedDoctorCheck => isAttentionCheckStatus(check.status),
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
  check: UnknownRecord,
  options:
    | {
        defaultDetail?: string;
        detailTransform?: (detail: string) => string;
        defaultStatus?: ResolvedCheckStatus;
      }
    | undefined,
  defaultStatus: ResolvedCheckStatus,
) {
  const rawDetail = asOptionalStringOr(check.detail, options?.defaultDetail ?? "");
  const detail = options?.detailTransform ? options.detailTransform(rawDetail) : rawDetail;
  const name = asOptionalStringOr(check.name, "");

  return {
    name,
    detail,
    status: normalizeResolvedCheckStatus(check.status, defaultStatus),
    normalizedName: name.toLowerCase(),
    normalizedDetail: detail.toLowerCase(),
  } satisfies DoctorReportCheck;
}
