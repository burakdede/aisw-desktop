export const DATE_UNAVAILABLE_LABEL = "Date Unavailable";

export function parseStoredDate(value: string) {
  const isoDate = Date.parse(value);
  if (!Number.isNaN(isoDate)) {
    return new Date(isoDate);
  }

  const compactMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  if (!compactMatch) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = compactMatch;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function formatDateTimeWithZone(value: string) {
  const date = parseStoredDate(value);
  if (!date) {
    return DATE_UNAVAILABLE_LABEL;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
