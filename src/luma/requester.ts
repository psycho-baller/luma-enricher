import { AuthExpiredError, LumaApiError, NetworkError, RateLimitedError } from "./errors.js";

export interface LumaRequester {
  getJson<T>(url: string): Promise<T>;
  postJson<T>(url: string, body?: unknown): Promise<T>;
}

export class FetchRequester implements LumaRequester {
  constructor(private readonly headers: Record<string, string> = {}) {}

  async getJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...this.headers,
        },
      });
    } catch (error) {
      throw new NetworkError(`network failure while requesting ${url}`, error);
    }

    return this.handleResponse<T>(response, url);
  }

  async postJson<T>(url: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      const options: RequestInit = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...this.headers,
        },
      };
      if (body !== undefined) {
        options.body = JSON.stringify(body);
      }
      response = await fetch(url, options);
    } catch (error) {
      throw new NetworkError(`network failure while requesting ${url}`, error);
    }

    return this.handleResponse<T>(response, url);
  }

  private async handleResponse<T>(response: Response, url: string): Promise<T> {
    if (response.status === 401) throw new AuthExpiredError();
    const body = response.ok ? undefined : await response.text();
    if (response.status === 429) {
      throw new RateLimitedError({
        message: `Luma rate-limited request to ${url}`,
        url,
        body,
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      });
    }
    if (!response.ok) {
      throw new LumaApiError({
        status: response.status,
        message: `Luma API request failed: ${response.status} ${response.statusText}`,
        url,
        body,
      });
    }

    return (await response.json()) as T;
  }
}

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return undefined;
}
