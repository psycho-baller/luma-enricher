import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type APIResponse, type BrowserContext, chromium } from "playwright";
import { AuthExpiredError, LumaApiError, NetworkError, RateLimitedError } from "./errors.js";
import type { LumaRequester } from "./requester.js";
import { parseRetryAfter } from "./requester.js";

export type OpenSessionOptions = {
  headless: boolean;
};

export class LumaSession implements LumaRequester {
  private context: BrowserContext | null = null;
  private openPromise: Promise<BrowserContext> | null = null;

  constructor(readonly profileDir: string = defaultProfileDir()) {}

  async open(options: OpenSessionOptions): Promise<BrowserContext> {
    if (this.context) return this.context;
    if (this.openPromise) return this.openPromise;

    this.openPromise = (async () => {
      await mkdir(this.profileDir, { recursive: true, mode: 0o700 });
      await chmod(this.profileDir, 0o700);

      this.context = await chromium.launchPersistentContext(this.profileDir, {
        headless: options.headless,
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        args: ["--disable-blink-features=AutomationControlled"],
        ignoreDefaultArgs: ["--enable-automation"],
      });
      return this.context;
    })();

    try {
      return await this.openPromise;
    } finally {
      this.openPromise = null;
    }
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.openPromise = null;
  }

  async getCookiesHeader(): Promise<string> {
    const context = await this.open({ headless: true });
    const cookies = await context.cookies();
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  async getJson<T>(url: string): Promise<T> {
    const cookieHeader = await this.getCookiesHeader();
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Cookie: cookieHeader,
        },
      });
    } catch (error) {
      throw new NetworkError(`network failure while requesting ${url}`, error);
    }

    return this.handleResponse<T>(response, url);
  }

  async postJson<T>(url: string, body?: unknown): Promise<T> {
    const cookieHeader = await this.getCookiesHeader();
    let response: Response;
    try {
      const options: RequestInit = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Cookie: cookieHeader,
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

export function defaultProfileDir(): string {
  const home = process.env.LUMA_ENRICHER_HOME;
  return home ? join(home, "profile") : join(homedir(), ".luma-enricher", "profile");
}
