import { describe, expect, it } from "vitest";
import {
  clipboardCopiedMessage,
  clipboardUnavailableManualMessage,
  DATE_UNAVAILABLE_LABEL,
  DEFAULT_ACTION_FAILURE_MESSAGE,
  openedItemMessage,
  savedItemMessage,
} from "./display-copy";

describe("display-copy", () => {
  it("shares common fallback and clipboard copy text", () => {
    expect(DATE_UNAVAILABLE_LABEL).toBe("Date Unavailable");
    expect(DEFAULT_ACTION_FAILURE_MESSAGE).toBe("AI Switch could not complete that action.");
    expect(clipboardUnavailableManualMessage("the setup step")).toBe(
      "Clipboard access is unavailable. Copy the setup step manually.",
    );
    expect(clipboardUnavailableManualMessage("backup id", "backup-123")).toBe(
      "Clipboard access is unavailable. Copy backup id backup-123 manually.",
    );
    expect(clipboardCopiedMessage("verify step")).toBe("Copied verify step.");
    expect(clipboardCopiedMessage("bundle path", "/tmp/report.zip")).toBe(
      "Copied bundle path /tmp/report.zip.",
    );
    expect(savedItemMessage("support.zip")).toBe("Saved support.zip.");
    expect(openedItemMessage("/tmp/aisw")).toBe("Opened /tmp/aisw.");
  });
});
