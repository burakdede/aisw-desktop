import { describe, expect, it } from "vitest";
import { formatMessageWithRemediation } from "./remediation-text";

describe("remediation-text", () => {
  it("appends remediation only when it is present", () => {
    expect(formatMessageWithRemediation("Switch complete.")).toBe("Switch complete.");
    expect(formatMessageWithRemediation("Switch failed.", "Retry.")).toBe(
      "Switch failed. Remediation: Retry.",
    );
    expect(formatMessageWithRemediation("Switch failed.", null)).toBe("Switch failed.");
  });
});
