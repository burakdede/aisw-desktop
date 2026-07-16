import { disposeSafely } from "./async-dispose";

describe("disposeSafely", () => {
  it("runs synchronous cleanup", () => {
    const dispose = vi.fn();

    disposeSafely(dispose);

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("waits for async cleanup without surfacing rejections", async () => {
    const dispose = vi.fn().mockRejectedValue(new Error("cleanup failed"));

    disposeSafely(dispose);
    await Promise.resolve();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
