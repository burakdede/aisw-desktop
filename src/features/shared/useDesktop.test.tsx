import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppBootstrap } from "../../lib/schemas";
import { DesktopCommandError } from "../../lib/tauri";
import { resetMutationQueueForTests } from "./mutationQueue";
import { useDesktop } from "./useDesktop";

const { getBootstrapMock, getSnapshotMock, runInitMock } = vi.hoisted(() => ({
  getBootstrapMock: vi.fn(),
  getSnapshotMock: vi.fn(),
  runInitMock: vi.fn(),
}));

vi.mock("../../lib/client", () => ({
  getBootstrap: getBootstrapMock,
  getSnapshot: getSnapshotMock,
  runInit: runInitMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const bootstrap: AppBootstrap = {
  settings: {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {},
    profile_sets: [],
  },
  runtime_status: {
    compatible: true,
    issues: [],
    resolved_path: "/Applications/AI Switcher.app/Contents/Resources/aisw",
    version: {
      version: "0.3.7",
      cli_api_version: 1,
      json_schema_version: 1,
      progress_schema_version: 1,
    },
    capabilities: {
      features: {
        mutation_json: true,
      },
      tools: {},
    },
    inventory: {
      bundled_path: "/Applications/AI Switcher.app/Contents/Resources/aisw",
      system_path: "/opt/homebrew/bin/aisw",
      configured_path: null,
    },
  },
  snapshot: {
    statuses: [],
    profiles: {},
    contexts: [],
  },
};

describe("useDesktop", () => {
  beforeEach(() => {
    resetMutationQueueForTests();
    getBootstrapMock.mockReset();
    getSnapshotMock.mockReset();
    runInitMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries bootstrap when the desktop runtime appears late", async () => {
    vi.useFakeTimers();
    getBootstrapMock
      .mockRejectedValueOnce(
        new DesktopCommandError("AI Switcher desktop runtime is unavailable.", {
          kind: "runtime_unavailable",
        }),
      )
      .mockResolvedValueOnce(bootstrap);
    getSnapshotMock.mockResolvedValue(bootstrap.snapshot);

    const { result } = renderHook(() => useDesktop(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    expect(getBootstrapMock).toHaveBeenCalledTimes(2);
    expect(result.current.bootstrap.data?.runtime_status.compatible).toBe(true);
  });
});
