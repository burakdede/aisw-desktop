export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function pluralSuffix(count: number) {
  return count === 1 ? "" : "s";
}

export function pluralChoice<T>(count: number, singular: T, plural: T) {
  return count === 1 ? singular : plural;
}

export function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${pluralChoice(count, singular, plural)}`;
}

export function buildKeyedRecord<const Key extends string, Value>(
  keys: readonly Key[],
  createValue: (key: Key) => Value,
) {
  const record = {} as Record<Key, Value>;
  keys.forEach((key) => {
    record[key] = createValue(key);
  });
  return record;
}
