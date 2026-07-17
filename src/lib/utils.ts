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

export function hasMatchingSelection<T>(
  selection: string | null | undefined,
  items: readonly T[],
  getKey: (item: T) => string,
): boolean {
  return typeof selection === "string" && items.some((item) => getKey(item) === selection);
}

export function resolveSelectionValue<T>(
  selection: string | null | undefined,
  items: readonly T[],
  getKey: (item: T) => string,
): string | null {
  if (typeof selection === "string" && hasMatchingSelection(selection, items, getKey)) {
    return selection;
  }

  return items[0] ? getKey(items[0]) : null;
}

export function resolveSelectionItem<T>(
  selection: string | null | undefined,
  items: readonly T[],
  getKey: (item: T) => string,
): T | null {
  if (!items.length) {
    return null;
  }

  if (!selection) {
    return items[0] ?? null;
  }

  return items.find((item) => getKey(item) === selection) ?? items[0] ?? null;
}

export function resolvePriorityItem<T>(
  items: readonly T[],
  predicates: ReadonlyArray<(item: T) => boolean>,
): T | null {
  for (const predicate of predicates) {
    const match = items.find((item) => predicate(item));
    if (match) {
      return match;
    }
  }

  return items[0] ?? null;
}

export function findMatchingItem<T>(
  selection: string | null | undefined,
  items: readonly T[],
  getKey: (item: T) => string,
): T | null {
  if (typeof selection !== "string") {
    return null;
  }

  return items.find((item) => getKey(item) === selection) ?? null;
}

export function resolvePreferredSelectionValue<T>(
  selection: string | null | undefined,
  preferredSelection: string | null | undefined,
  items: readonly T[],
  getKey: (item: T) => string,
): string | null {
  if (typeof selection === "string" && hasMatchingSelection(selection, items, getKey)) {
    return selection;
  }

  return resolveSelectionValue(preferredSelection, items, getKey);
}

export function resolvePreferredSelectionItem<T>(
  selection: string | null | undefined,
  preferredSelection: string | null | undefined,
  items: readonly T[],
  getKey: (item: T) => string,
): T | null {
  const nextSelection = resolvePreferredSelectionValue(
    selection,
    preferredSelection,
    items,
    getKey,
  );

  return resolveSelectionItem(nextSelection, items, getKey);
}
