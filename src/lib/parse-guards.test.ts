import { describe, expect, it } from "vitest";
import {
  asArray,
  asNonEmptyString,
  asNumber,
  asObject,
  asOptionalString,
  asString,
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
    expect(asNumber(12)).toBe(12);
    expect(asNumber("12", 7)).toBe(7);
  });
});
