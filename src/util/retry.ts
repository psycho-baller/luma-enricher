import { RateLimitedError } from "../luma/errors.js";
import { sleep } from "./time.js";

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitedError) return true;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: number }).status);
    return status === 429 || status >= 500;
  }
  const code =
    typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND";
}

export function computeRetryDelayMs(
  attempt: number,
  options: Required<Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "jitter">>,
  retryAfterMs?: number,
): number {
  if (retryAfterMs !== undefined) return Math.min(retryAfterMs, options.maxDelayMs);
  const exponential = Math.min(options.baseDelayMs * 2 ** attempt, options.maxDelayMs);
  if (!options.jitter) return exponential;
  return Math.floor(Math.random() * exponential);
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const resolved = {
    attempts: options.attempts ?? 4,
    baseDelayMs: options.baseDelayMs ?? 400,
    maxDelayMs: options.maxDelayMs ?? 8_000,
    jitter: options.jitter ?? true,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < resolved.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === resolved.attempts - 1 || !isRetryableError(error)) {
        throw error;
      }
      const retryAfterMs = error instanceof RateLimitedError ? error.retryAfterMs : undefined;
      const delayMs = computeRetryDelayMs(attempt, resolved, retryAfterMs);
      options.onRetry?.(error, attempt + 1, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
