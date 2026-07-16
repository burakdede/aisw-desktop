import { describe, expect, it } from "vitest";
import {
  DESKTOP_BOOTSTRAP_RETRY_BASE_DELAY_MS,
  DESKTOP_BOOTSTRAP_RETRY_LIMIT,
  DESKTOP_BOOTSTRAP_RETRY_MAX_DELAY_MS,
  DESKTOP_RUNTIME_WAIT_INTERVAL_MS,
  DESKTOP_RUNTIME_WAIT_TIMEOUT_MS,
  QUICK_SWITCH_FOCUS_DELAY_MS,
  WINDOW_STATE_PERSIST_DELAY_MS,
  desktopBootstrapRetryDelay,
} from "./desktop-timing";

describe("desktop-timing", () => {
  it("shares stable desktop timing constants", () => {
    expect(DESKTOP_RUNTIME_WAIT_TIMEOUT_MS).toBe(1000);
    expect(DESKTOP_RUNTIME_WAIT_INTERVAL_MS).toBe(20);
    expect(DESKTOP_BOOTSTRAP_RETRY_LIMIT).toBe(3);
    expect(DESKTOP_BOOTSTRAP_RETRY_BASE_DELAY_MS).toBe(250);
    expect(DESKTOP_BOOTSTRAP_RETRY_MAX_DELAY_MS).toBe(750);
    expect(WINDOW_STATE_PERSIST_DELAY_MS).toBe(160);
    expect(QUICK_SWITCH_FOCUS_DELAY_MS).toBe(40);
  });

  it("caps bootstrap retry delay at the shared maximum", () => {
    expect(desktopBootstrapRetryDelay(1)).toBe(250);
    expect(desktopBootstrapRetryDelay(2)).toBe(500);
    expect(desktopBootstrapRetryDelay(3)).toBe(750);
    expect(desktopBootstrapRetryDelay(4)).toBe(750);
  });
});
