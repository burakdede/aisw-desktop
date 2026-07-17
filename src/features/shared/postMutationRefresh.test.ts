import { describe, expect, it, vi } from "vitest";
import {
  CORE_DESKTOP_QUERY_KEYS,
  DESKTOP_DIAGNOSTIC_QUERY_KEYS,
  invalidateCoreDesktopQueries,
  invalidateDesktopQueries,
  invalidateDiagnosticDesktopQueries,
  invalidatePostMutationQueries,
  invalidateSnapshotDesktopQueries,
  POST_MUTATION_QUERY_KEYS,
  SNAPSHOT_DESKTOP_QUERY_KEYS,
  type PostMutationQueryInvalidator,
} from "./postMutationRefresh";

describe("postMutationRefresh", () => {
  it("invalidates arbitrary desktop query-key groups in order", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient: PostMutationQueryInvalidator = { invalidateQueries };

    await invalidateDesktopQueries(queryClient, SNAPSHOT_DESKTOP_QUERY_KEYS);

    expect(invalidateQueries.mock.calls).toEqual(
      SNAPSHOT_DESKTOP_QUERY_KEYS.map((queryKey) => [{ queryKey }]),
    );
  });

  it("shares the post-mutation query refresh contract", async () => {
    expect(POST_MUTATION_QUERY_KEYS).toEqual([
      ["bootstrap"],
      ["snapshot"],
      ["doctor"],
      ["verify"],
      ["backups"],
      ["init"],
      ["workspace-status"],
      ["project-bindings"],
    ]);

    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    const queryClient: PostMutationQueryInvalidator = {
      invalidateQueries,
    };

    await invalidatePostMutationQueries(queryClient);

    expect(invalidateQueries.mock.calls).toEqual(
      POST_MUTATION_QUERY_KEYS.map((queryKey) => [{ queryKey }]),
    );
  });

  it("shares the core, diagnostics, and snapshot invalidation contracts", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient: PostMutationQueryInvalidator = { invalidateQueries };

    await invalidateCoreDesktopQueries(queryClient);
    expect(invalidateQueries.mock.calls).toEqual(
      CORE_DESKTOP_QUERY_KEYS.map((queryKey) => [{ queryKey }]),
    );

    invalidateQueries.mockClear();
    await invalidateDiagnosticDesktopQueries(queryClient);
    expect(invalidateQueries.mock.calls).toEqual(
      DESKTOP_DIAGNOSTIC_QUERY_KEYS.map((queryKey) => [{ queryKey }]),
    );

    invalidateQueries.mockClear();
    await invalidateSnapshotDesktopQueries(queryClient);
    expect(invalidateQueries.mock.calls).toEqual(
      SNAPSHOT_DESKTOP_QUERY_KEYS.map((queryKey) => [{ queryKey }]),
    );
  });
});
