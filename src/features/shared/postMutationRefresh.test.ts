import { describe, expect, it, vi } from "vitest";
import {
  invalidatePostMutationQueries,
  POST_MUTATION_QUERY_KEYS,
} from "./postMutationRefresh";

describe("postMutationRefresh", () => {
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

    await invalidatePostMutationQueries({
      invalidateQueries,
    } as unknown as Parameters<typeof invalidatePostMutationQueries>[0]);

    expect(invalidateQueries.mock.calls).toEqual(
      POST_MUTATION_QUERY_KEYS.map((queryKey) => [{ queryKey }]),
    );
  });
});
