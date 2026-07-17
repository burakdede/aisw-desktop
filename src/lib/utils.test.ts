import {
  buildKeyedRecord,
  countLabel,
  findMatchingItem,
  hasMatchingSelection,
  pluralChoice,
  pluralSuffix,
  resolvePreferredSelectionItem,
  resolvePreferredSelectionValue,
  resolveSelectionItem,
  resolveSelectionValue,
  titleCase,
} from "./utils";

describe("utils", () => {
  it("formats title case values", () => {
    expect(titleCase("hello_world-test")).toBe("Hello World Test");
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

  it("builds typed records from fixed key lists", () => {
    expect(
      buildKeyedRecord(["claude", "codex"] as const, (tool) => `${tool}-profile`),
    ).toEqual({
      claude: "claude-profile",
      codex: "codex-profile",
    });
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

    expect(resolveSelectionItem("second", items, (item) => item.key)).toEqual(items[1]);
    expect(resolveSelectionItem("missing", items, (item) => item.key)).toEqual(items[0]);
    expect(resolveSelectionItem(null, items, (item) => item.key)).toEqual(items[0]);
    expect(resolveSelectionItem(undefined, noItems, (item) => item.key)).toBeNull();
    expect(findMatchingItem("second", items, (item) => item.key)).toEqual(items[1]);
    expect(findMatchingItem("missing", items, (item) => item.key)).toBeNull();
    expect(findMatchingItem(null, items, (item) => item.key)).toBeNull();

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
