import { describe, expect, it, vi } from "vitest";
import { RateLimitedError } from "../../src/luma/errors.js";
import { computeRetryDelayMs, withRetry } from "../../src/util/retry.js";

describe("retry", () => {
  it("honors Retry-After before exponential backoff", () => {
    expect(
      computeRetryDelayMs(0, { baseDelayMs: 400, maxDelayMs: 8_000, jitter: false }, 2_000),
    ).toBe(2_000);
  });

  it("retries rate limits", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitedError({ message: "slow down", retryAfterMs: 1 }))
      .mockResolvedValue("ok");

    await expect(withRetry(fn, { jitter: false })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("bad input"));
    await expect(withRetry(fn)).rejects.toThrow("bad input");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
