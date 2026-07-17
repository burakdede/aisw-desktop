import {
  buildKeyedRecord,
  countLabel,
  findMatchingItem,
  hasMatchingSelection,
  itemAtIndexOrNull,
  itemKeyOrNull,
  humanizeIdentifierLabel,
  normalizeSearchText,
  normalizeIdentifierLabel,
  normalizeWordKey,
  pluralChoice,
  pluralSuffix,
  resolvePriorityItem,
  resolvePreferredSelectionItem,
  resolvePreferredSelectionValue,
  resolvePreferredSelectionValueOrEmpty,
  resolveSelectionItem,
  resolveSelectionValue,
  resolveSelectionValueOrEmpty,
  stringRecordValue,
  trimmedStringOrNull,
  titleCase,
} from "./utils";

describe("utils", () => {
  it("formats title case values", () => {
    expect(titleCase("hello_world-test")).toBe("Hello World Test");
  });

  it("shares identifier normalization helpers", () => {
    expect(normalizeIdentifierLabel("  system_keyring-test  ")).toBe("system keyring test");
    expect(normalizeIdentifierLabel("  system_keyring-test  ", { lowercase: true })).toBe(
      "system keyring test",
    );
    expect(normalizeIdentifierLabel("   ")).toBe("");
    expect(humanizeIdentifierLabel("service_account")).toBe("Service Account");
    expect(humanizeIdentifierLabel("RUNTIME_OVERRIDE", { lowercase: true })).toBe(
      "Runtime Override",
    );
  });

  it("shares lowercase search and key normalization helpers", () => {
    expect(normalizeSearchText("  Personal Codex  ")).toBe("personal codex");
    expect(normalizeSearchText(undefined)).toBe("");
    expect(normalizeWordKey("  Repair Permissions  ")).toBe("repair_permissions");
  });

  it("shares pluralization helpers", () => {
    expect(pluralSuffix(1)).toBe("");
    expect(pluralSuffix(2)).toBe("s");
    expect(pluralChoice(1, "is", "are")).toBe("is");
    expect(pluralChoice(3, "is", "are")).toBe("are");
    expect(countLabel(1, "tool")).toBe("1 tool");
    expect(countLabel(2, "tool")).toBe("2 tools");
    expect(countLabel(2, "safe fix", "safe fixes")).toBe("2 safe fixes");
  });

  it("normalizes empty and whitespace-only strings to null", () => {
    expect(trimmedStringOrNull(undefined)).toBeNull();
    expect(trimmedStringOrNull(null)).toBeNull();
    expect(trimmedStringOrNull("")).toBeNull();
    expect(trimmedStringOrNull("   ")).toBeNull();
    expect(trimmedStringOrNull("  work  ")).toBe("work");
  });

  it("builds typed records from fixed key lists", () => {
    expect(
      buildKeyedRecord(["claude", "codex"] as const, (tool) => `${tool}-profile`),
    ).toEqual({
      claude: "claude-profile",
      codex: "codex-profile",
    });
  });

  it("reads keyed string records with shared fallbacks", () => {
    expect(stringRecordValue({ claude: "personal" }, "claude")).toBe("personal");
    expect(stringRecordValue({ claude: "personal" }, "codex")).toBe("");
    expect(stringRecordValue({ claude: "personal" }, "codex", "release")).toBe("release");
    expect(stringRecordValue(null, "codex")).toBe("");
  });

  it("shares keyed selection helpers", () => {
    const items = [
      { key: "first", value: 1 },
      { key: "second", value: 2 },
    ];
    const noItems: typeof items = [];

    expect(hasMatchingSelection("second", items, (item) => item.key)).toBe(true);
    expect(hasMatchingSelection("missing", items, (item) => item.key)).toBe(false);
    expect(hasMatchingSelection(null, items, (item) => item.key)).toBe(false);

    expect(resolveSelectionValue("second", items, (item) => item.key)).toBe("second");
    expect(resolveSelectionValue("missing", items, (item) => item.key)).toBe("first");
    expect(resolveSelectionValue(undefined, items, (item) => item.key)).toBe("first");
    expect(resolveSelectionValue(null, noItems, (item) => item.key)).toBeNull();
    expect(resolveSelectionValueOrEmpty("second", items, (item) => item.key)).toBe("second");
    expect(resolveSelectionValueOrEmpty(null, noItems, (item) => item.key)).toBe("");

    expect(resolveSelectionItem("second", items, (item) => item.key)).toEqual(items[1]);
    expect(resolveSelectionItem("missing", items, (item) => item.key)).toEqual(items[0]);
    expect(resolveSelectionItem(null, items, (item) => item.key)).toEqual(items[0]);
    expect(resolveSelectionItem(undefined, noItems, (item) => item.key)).toBeNull();
    expect(resolvePriorityItem(items, [(item) => item.key === "second"])).toEqual(items[1]);
    expect(
      resolvePriorityItem(items, [
        (item) => item.key === "missing",
        (item) => item.key === "second",
      ]),
    ).toEqual(items[1]);
    expect(resolvePriorityItem(items, [(item) => item.key === "missing"])).toEqual(items[0]);
    expect(resolvePriorityItem(noItems, [(item) => item.key === "missing"])).toBeNull();
    expect(findMatchingItem("second", items, (item) => item.key)).toEqual(items[1]);
    expect(findMatchingItem("missing", items, (item) => item.key)).toBeNull();
    expect(findMatchingItem(null, items, (item) => item.key)).toBeNull();
    expect(itemAtIndexOrNull(items, 1)).toEqual(items[1]);
    expect(itemAtIndexOrNull(items, -1)).toBeNull();
    expect(itemAtIndexOrNull(items, 9)).toBeNull();
    expect(itemKeyOrNull(items[1], (item) => item.key)).toBe("second");
    expect(itemKeyOrNull(null, (item: (typeof items)[number]) => item.key)).toBeNull();

    expect(resolvePreferredSelectionValue("second", "first", items, (item) => item.key)).toBe(
      "second",
    );
    expect(resolvePreferredSelectionValue("missing", "second", items, (item) => item.key)).toBe(
      "second",
    );
    expect(resolvePreferredSelectionValue("missing", "unknown", items, (item) => item.key)).toBe(
      "first",
    );
    expect(resolvePreferredSelectionValue(null, null, noItems, (item) => item.key)).toBeNull();
    expect(
      resolvePreferredSelectionValueOrEmpty("missing", "second", items, (item) => item.key),
    ).toBe("second");
    expect(resolvePreferredSelectionValueOrEmpty(null, null, noItems, (item) => item.key)).toBe(
      "",
    );

    expect(resolvePreferredSelectionItem("second", "first", items, (item) => item.key)).toEqual(
      items[1],
    );
    expect(resolvePreferredSelectionItem("missing", "second", items, (item) => item.key)).toEqual(
      items[1],
    );
    expect(resolvePreferredSelectionItem("missing", "unknown", items, (item) => item.key)).toEqual(
      items[0],
    );
    expect(resolvePreferredSelectionItem(null, null, noItems, (item) => item.key)).toBeNull();
  });
});
