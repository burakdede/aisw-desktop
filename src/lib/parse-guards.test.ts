import { describe, expect, it } from "vitest";
import {
  asArray,
  asObjectArray,
  asFiniteNumber,
  asNonEmptyString,
  asNumber,
  emptyStringToNull,
  nullishToEmptyString,
  nullishToNull,
  nullishToUndefined,
  asObject,
  asOptionalString,
  asOptionalStringField,
  asOptionalStringFieldOr,
  asOptionalStringOr,
  asString,
  isOneOf,
  normalizeOneOf,
  parseJsonObject,
} from "./parse-guards";

describe("parse-guards", () => {
  it("shares stable parsing fallbacks", () => {
    expect(asObject({ value: true })).toEqual({ value: true });
    expect(asObject(["invalid"])).toBeUndefined();
    expect(asArray(["value"])).toEqual(["value"]);
    expect(asArray("invalid")).toEqual([]);
    expect(asObjectArray([{ value: true }, "invalid", { count: 2 }])).toEqual([
      { value: true },
      { count: 2 },
    ]);
    expect(asObjectArray("invalid")).toEqual([]);
    expect(asString("value")).toBe("value");
    expect(asString(42, "fallback")).toBe("fallback");
    expect(asNonEmptyString("value")).toBe("value");
    expect(asNonEmptyString("", "fallback")).toBe("fallback");
    expect(asOptionalString("value")).toBe("value");
    expect(asOptionalString(42)).toBeUndefined();
    expect(asOptionalStringField({ value: "field" }, "value")).toBe("field");
    expect(asOptionalStringField({ value: 42 }, "value")).toBeUndefined();
    expect(asOptionalStringOr("value", "fallback")).toBe("value");
    expect(asOptionalStringOr(42, "fallback")).toBe("fallback");
    expect(asOptionalStringFieldOr({ value: "field" }, "value", "fallback")).toBe("field");
    expect(asOptionalStringFieldOr({ value: 42 }, "value", "fallback")).toBe("fallback");
    expect(nullishToEmptyString("value")).toBe("value");
    expect(nullishToEmptyString(null)).toBe("");
    expect(nullishToEmptyString(undefined)).toBe("");
    expect(emptyStringToNull("value")).toBe("value");
    expect(emptyStringToNull("")).toBeNull();
    expect(emptyStringToNull(null)).toBeNull();
    expect(emptyStringToNull(undefined)).toBeNull();
    expect(nullishToNull("value")).toBe("value");
    expect(nullishToNull(null)).toBeNull();
    expect(nullishToNull(undefined)).toBeNull();
    expect(nullishToUndefined("value")).toBe("value");
    expect(nullishToUndefined(null)).toBeUndefined();
    expect(nullishToUndefined(undefined)).toBeUndefined();
    expect(asNumber(12)).toBe(12);
    expect(asNumber("12", 7)).toBe(7);
    expect(asFiniteNumber(12)).toBe(12);
    expect(asFiniteNumber(Number.NaN)).toBeUndefined();
    expect(asFiniteNumber("12")).toBeUndefined();
    expect(parseJsonObject("{\"value\":true}")).toEqual({ value: true });
    expect(parseJsonObject("[1,2,3]")).toBeUndefined();
    expect(parseJsonObject("{bad json")).toBeUndefined();
    expect(isOneOf(["stable", "beta"] as const, "stable")).toBe(true);
    expect(isOneOf(["stable", "beta"] as const, "nightly")).toBe(false);
    expect(normalizeOneOf(["stable", "beta"] as const, "beta", "stable")).toBe("beta");
    expect(normalizeOneOf(["stable", "beta"] as const, "nightly", "stable")).toBe("stable");
  });
});
