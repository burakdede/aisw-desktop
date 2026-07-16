import { buildKeyedRecord, countLabel, pluralChoice, pluralSuffix, titleCase } from "./utils";

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
});
