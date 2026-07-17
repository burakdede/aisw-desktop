import { describe, expect, it } from "vitest";
import {
  asArray,
  asFiniteNumber,
  asNonEmptyString,
  asNumber,
  asObject,
  asOptionalString,
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
    expect(asString("value")).toBe("value");
    expect(asString(42, "fallback")).toBe("fallback");
    expect(asNonEmptyString("value")).toBe("value");
    expect(asNonEmptyString("", "fallback")).toBe("fallback");
    expect(asOptionalString("value")).toBe("value");
    expect(asOptionalString(42)).toBeUndefined();
    expect(asOptionalStringOr("value", "fallback")).toBe("value");
    expect(asOptionalStringOr(42, "fallback")).toBe("fallback");
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
