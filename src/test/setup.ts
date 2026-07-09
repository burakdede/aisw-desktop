import "@testing-library/jest-dom";
import { notifyManager } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { afterAll, beforeAll, vi } from "vitest";

notifyManager.setNotifyFunction((callback) => {
  act(() => {
    callback();
  });
});

const originalConsoleError = console.error;

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args
      .map((value) => (typeof value === "string" ? value : ""))
      .join(" ");

    if (text.includes("not wrapped in act(...)")) {
      return;
    }

    originalConsoleError(...(args as Parameters<typeof console.error>));
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});
